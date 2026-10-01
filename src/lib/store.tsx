import {syncState} from './sync-state';
import { collaborationActions } from './collaboration-actions';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { collection, doc, onSnapshot, query, orderBy, limit, runTransaction, serverTimestamp, getDocs, startAfter } from 'firebase/firestore';
import { useAuth } from './auth';
import { db } from './database';
import type { Entry, Review, Workspace, Activity, Assignment, TeamMember, Reply, Decision, TrashItem } from './types';
import { blankText } from './types';
import { registerCurrentMember } from './member-directory';
import { eligiblePic, memberLabel, assignmentTitle } from './assignment';
import { entryError, reviewError } from './helpers';
import { canManageEntry } from './questions';
import { validEntryScope } from './question-hub';
interface Store {
  syncStatus:string;lastSyncedAt:string;hasOlderActivities:boolean;loadOlderActivities:()=>Promise<void>;
  saveReply:(r:Reply)=>Promise<void>;deleteReply:(r:Reply)=>Promise<void>;
  acceptReply:(questionId:string,replyId:string,version:number)=>Promise<void>;
  saveDecision:(d:Decision)=>Promise<void>;restoreTrash:(t:TrashItem)=>Promise<void>;restorePrevious:(e:Activity)=>Promise<void>;
data:Workspace|null;loading:boolean;error:string;online:boolean;retry:()=>void;saveEntry:(entry:Entry)=>Promise<void>;deleteEntry:(entry:Entry)=>Promise<void>;saveReview:(review:Review)=>Promise<void>; saveAssignment:(id:string,uid:string,version:number)=>Promise<void>; directoryError:string;}
const Context=createContext<Store|null>(null);
const base='workspaces/weride';
const cacheKey=import.meta.env.DEV?'weride.local-preview.v1':'';
const decode=(value:unknown):unknown=>{
  if(value&&typeof value==='object'&&'toDate' in value && typeof value.toDate==='function')return value.toDate().toISOString();
  if(Array.isArray(value))return value.map(decode);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v)]));
  return value;
};
export function WorkspaceProvider({children}:{children:ReactNode}) {
  const {member,preview}=useAuth();const [data,setData]=useState<Workspace|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[online,setOnline]=useState(navigator.onLine),[reload,setReload]=useState(0);
  const [directoryError,setDirectoryError]=useState('');
  const [serverReady,setServerReady]=useState(false),[lastSyncedAt,setLastSyncedAt]=useState('');
  const [writeFault,setWriteFault]=useState(''),[pending,setPending]=useState(0),[metadataPending,setMetadataPending]=useState(false);
  const [hasOlderActivities,setHasOlderActivities]=useState(false);
  const activityCursor=useRef<QueryDocumentSnapshot|null>(null),older=useRef<Activity[]>([]);
  const syncStatus=syncState({preview,online,error:Boolean(error),writeFault:Boolean(writeFault),pending:pending>0||metadataPending,serverReady});
  const ref=useRef(data);ref.current=data;
  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
  useEffect(()=>{
    if(!member)return;let alive=true;setLoading(true);setError('');setDirectoryError('');setData(null);setServerReady(false);setWriteFault('');activityCursor.current=null;older.current=[];
    if(import.meta.env.DEV&&preview){
      (async()=>{try{const response=await fetch('/__dev/seed');if(!response.ok)throw new Error('fixture');const seed=await response.json();let loaded={...seed,reviews:[],activities:[],assignments:[],replies:[],resolutions:[],decisions:[],trash:[],members:seed.members||[]} as Workspace;try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');if(cached?.schemaVersion===1&&Array.isArray(cached.entries)&&cached.project?.id==='weride')loaded={...cached,reviewContext:seed.reviewContext||null,members:seed.members||[],assignments:cached.assignments||[]};}catch{/* Start clean if storage is corrupt. */}if(alive){setData(loaded);setLoading(false);}}catch{if(alive){setError('loadError');setLoading(false);}}})();
      return()=>{alive=false;};
    }
    if(!db){setError('loadError');setLoading(false);return;}
    void registerCurrentMember(member).catch(()=>{if(alive)setDirectoryError('picDirectoryError');});
    const loaded:Partial<Workspace>={schemaVersion:1},ready=new Set<string>();
    const metadata=new Map<string,{fromCache:boolean;hasPendingWrites:boolean}>();
    const update=(key:string,value:unknown,meta:{fromCache:boolean;hasPendingWrites:boolean})=>{
      if(!alive)return;Object.assign(loaded,{[key]:value});ready.add(key);metadata.set(key,meta);
      setMetadataPending([...metadata.values()].some(m=>m.hasPendingWrites));
      setServerReady(metadata.size===12&&[...metadata.values()].every(m=>!m.fromCache));
      if(!meta.fromCache)setLastSyncedAt(new Date().toISOString());
      if(ready.size===12){
        const activities=[...new Map([...(loaded.activities||[]),...older.current].map(e=>[e.id,e])).values()].sort((a,b)=>b.at.localeCompare(a.at));
        const next={...loaded,activities} as Workspace;ref.current=next;setData(next);setLoading(false);
      }
    };
    const fail=()=>{if(alive){setError('loadError');setServerReady(false);setLoading(false);}};
    const stops=[
      onSnapshot(doc(db,base),{includeMetadataChanges:true},snap=>{if(!snap.exists()){fail();return;}update('project',decode(snap.data()),snap.metadata);},fail),
      onSnapshot(doc(db,base,'context','ai-review'),{includeMetadataChanges:true},snap=>update('reviewContext',snap.exists()?decode(snap.data()):null,snap.metadata),fail),
      ...['members','assignments','requirements','entries','reviews','replies','resolutions','decisions','trash'].map(key=>
        onSnapshot(collection(db!,base,key),{includeMetadataChanges:true},snap=>{
          const items=snap.docs.map(d=>decode(d.data()));
          if(key==='requirements')(items as Workspace['requirements']).sort((a,b)=>a.order-b.order);
          update(key,items,snap.metadata);
        },fail)),
      onSnapshot(query(collection(db,base,'activities'),orderBy('at','desc'),limit(100)),{includeMetadataChanges:true},snap=>{
        if(!older.current.length){activityCursor.current=snap.docs.at(-1)||null;setHasOlderActivities(snap.size===100);}
        update('activities',snap.docs.map(d=>({...decode(d.data()) as Activity,id:d.id})),snap.metadata);
      },fail),
    ];
    return()=>{alive=false;stops.forEach(fn=>fn());};
  },[member?.uid,preview,reload]);
  const localCommit=(next:Workspace)=>{localStorage.setItem(cacheKey,JSON.stringify(next));ref.current=next;setData(next);};
  const modify=async(action:'create'|'update'|'delete'|'review',item:Entry|Review)=>{
    if(!member||!ref.current||(!preview&&!online))throw new Error('writeError');
    const isReview=action==='review',currentData=ref.current;const now=new Date().toISOString();
    const existing=isReview?currentData.reviews.find(x=>x.id===item.id):currentData.entries.find(x=>x.id===item.id);
    if((existing?.version||0)!==item.version)throw new Error('conflict');
    if(!isReview&&existing&&!canManageEntry(existing as Entry,member.uid))throw new Error('qaOnlyAuthor');
    if(!isReview&&!validEntryScope(item as Entry,currentData.requirements))throw new Error('qhScopeInvalid');
    if(!isReview&&existing&&((existing as Entry).kind!==(item as Entry).kind||((existing as Entry).kind!=='qa'&&(existing as Entry).requirementId!==(item as Entry).requirementId)))throw new Error('qhScopeInvalid');
    const next={...item,version:item.version+1,updatedAt:now,updatedBy:member.uid,updatedByName:member.name,...(action==='create'?{createdAt:now,createdBy:member.uid,createdByName:member.name}:{})};
    const event:Activity={id:crypto.randomUUID(),action,requirementId:isReview?item.id:(item as Entry).requirementId,entryId:item.id,kind:isReview?'review':(item as Entry).kind,title:isReview?{...blankText(),en:'Vendor response'}:(item as Entry).title,actor:member.uid,actorName:member.name,at:now,before:existing||null,after:action==='delete'?null:next};
    const tombstone=action==='delete'?{id:event.id,entryId:item.id,snapshot:existing as Entry,deletedBy:member.uid,deletedByName:member.name,deletedAt:now,restoredBy:'',restoredAt:null,version:1}:null;
    if(import.meta.env.DEV&&preview){localCommit({...currentData,trash:tombstone?[...(currentData.trash||[]),tombstone]:currentData.trash||[],entries:isReview?currentData.entries:action==='delete'?currentData.entries.filter(x=>x.id!==item.id):[...currentData.entries.filter(x=>x.id!==item.id),next as Entry],reviews:isReview?[...currentData.reviews.filter(x=>x.id!==item.id),next as Review]:currentData.reviews,activities:[event,...currentData.activities]});return;}
    const store=db!;const target=doc(store,base,isReview?'reviews':'entries',item.id);const audit=doc(store,base,'activities',event.id);
    await runTransaction(store,async tx=>{
      const snapshot=await tx.get(target);
      if((snapshot.exists()?snapshot.data().version:0)!==item.version)throw new Error('conflict');
      if(!isReview&&snapshot.exists()&&!canManageEntry(snapshot.data() as Entry,member.uid))throw new Error('qaOnlyAuthor');
      const write={...next,updatedAt:serverTimestamp(),...(action==='create'?{createdAt:serverTimestamp()}:!isReview&&snapshot.exists()?{createdAt:snapshot.data().createdAt}:{})};
      if(action==='delete'){if(!snapshot.exists())throw Error('conflict');tx.set(doc(store,base,'trash',event.id),{...tombstone,snapshot:snapshot.data(),deletedAt:serverTimestamp()});tx.delete(target);}else tx.set(target,write);
      tx.set(audit,{...event,at:serverTimestamp(),before:snapshot.exists()?snapshot.data():null,after:action==='delete'?null:write});
    });
  };
  const saveAssignment=async(id:string,uid:string,version:number)=>{
    const current=ref.current;
    if(!member||!current||(!preview&&!online))throw new Error('writeError');
    if(!current.requirements.some(r=>r.id===id))throw new Error('notFound');
    const previous=current.assignments?.find(a=>a.id===id);
    if((previous?.version||0)!==version)throw new Error('conflict');
    if((previous?.assigneeUid||'')===uid)return;
    const selected=current.members?.find(p=>p.uid===uid);
    if(uid&&!eligiblePic(selected))throw new Error('picInvalidMember');
    const eventId=crypto.randomUUID(),now=new Date().toISOString();
    const next:Assignment={id,assigneeUid:uid,version:version+1,updatedBy:member.uid,updatedByName:member.name,updatedAt:now,activityId:eventId};
    const event:Activity={id:eventId,action:uid?'assign':'unassign',requirementId:id,entryId:id,kind:'assignment',title:assignmentTitle(memberLabel(selected)),actor:member.uid,actorName:member.name,at:now,before:previous||null,after:next};
    if(import.meta.env.DEV&&preview){
      localCommit({...current,assignments:[...(current.assignments||[]).filter(a=>a.id!==id),next],activities:[event,...current.activities]});return;
    }
    const store=db!,target=doc(store,base,'assignments',id);
    await runTransaction(store,async tx=>{
      const before=await tx.get(target);
      if((before.exists()?before.data().version:0)!==version)throw new Error('conflict');
      let assignee:TeamMember|undefined;
      if(uid){const profile=await tx.get(doc(store,base,'members',uid));assignee=profile.exists()?profile.data() as TeamMember:undefined;if(!eligiblePic(assignee))throw new Error('picInvalidMember');}
      const write={...next,updatedAt:serverTimestamp()};
      tx.set(target,write);
      tx.set(doc(store,base,'activities',eventId),{...event,title:assignmentTitle(memberLabel(assignee)),at:serverTimestamp(),before:before.exists()?before.data():null,after:write});
    });
  };
  const saveEntry=async(entry:Entry)=>{const validation=entryError(entry);if(validation)throw new Error(validation);await modify(entry.version===0?'create':'update',entry);};
  const deleteEntry=async(entry:Entry)=>modify('delete',entry);
  const saveReview=async(review:Review)=>{const validation=reviewError(review);if(validation)throw new Error(validation);await modify('review',review);};
  const loadOlderActivities=async()=>{
    if(preview||!db||!activityCursor.current||!hasOlderActivities)return;
    const snap=await getDocs(query(collection(db,base,'activities'),orderBy('at','desc'),startAfter(activityCursor.current),limit(100)));
    const page=snap.docs.map(d=>({...decode(d.data()) as Activity,id:d.id}));older.current.push(...page);
    activityCursor.current=snap.docs.at(-1)||activityCursor.current;setHasOlderActivities(snap.size===100);
    if(ref.current){const activities=[...new Map([...ref.current.activities,...page].map(e=>[e.id,e])).values()].sort((a,b)=>b.at.localeCompare(a.at));const next={...ref.current,activities};ref.current=next;setData(next);}
  };
  const tracked=async(work:()=>Promise<void>)=>{setPending(n=>n+1);setWriteFault('');try{await work();}catch(e){setWriteFault('uxWriteError');throw e;}finally{setPending(n=>Math.max(0,n-1));}};
  const extra=collaborationActions({member,preview,online,get:()=>ref.current,commit:localCommit});
  const restorePrevious=async(event:Activity)=>{
    if(!event.before||!event.after||!['update','review'].includes(event.action))throw Error('uxRestoreUnavailable');
    const before=event.before as Entry,after=event.after as Entry;
    if(event.kind==='review'){
      const current=ref.current?.reviews.find(r=>r.id===event.entryId);if(!current||current.version!==after.version)throw Error('conflict');
      await saveReview({...event.before as Review,version:current.version});return;
    }
    if(!['qa','breakdown','assumption'].includes(event.kind))throw Error('uxRestoreUnavailable');
    const current=ref.current?.entries.find(e=>e.id===event.entryId);if(!current||current.version!==after.version)throw Error('conflict');
    if(!canManageEntry(current,member?.uid))throw Error('uxRestorePermission');
    await saveEntry({...current,title:before.title,body:before.body,answer:before.answer,acceptance:before.acceptance,status:before.status,priority:before.priority,owner:before.owner,estimateHours:before.estimateHours});
  };
  return <Context.Provider value={{data,loading,error,online,retry:()=>setReload(n=>n+1),saveEntry:e=>tracked(()=>saveEntry(e)),deleteEntry:e=>tracked(()=>deleteEntry(e)),saveReview:r=>tracked(()=>saveReview(r)),saveAssignment:(id,uid,v)=>tracked(()=>saveAssignment(id,uid,v)),directoryError,
    syncStatus,lastSyncedAt,hasOlderActivities,loadOlderActivities,saveReply:r=>tracked(()=>extra.saveReply(r)),deleteReply:r=>tracked(()=>extra.deleteReply(r)),acceptReply:(q,r,v)=>tracked(()=>extra.acceptReply(q,r,v)),saveDecision:d=>tracked(()=>extra.saveDecision(d)),restoreTrash:t=>tracked(()=>extra.restoreTrash(t)),restorePrevious:e=>tracked(()=>restorePrevious(e))}}>{children}</Context.Provider>;
}
export function useWorkspace(){const value=useContext(Context);if(!value)throw new Error('WorkspaceProvider missing');return value;}
