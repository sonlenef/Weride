from pathlib import Path
p=Path('src/lib/store.tsx');s=p.read_text()
s="import { collaborationActions } from './collaboration-actions';\n"+s
s=s.replace('runTransaction, serverTimestamp','runTransaction, serverTimestamp, getDocs, startAfter')
s=s.replace("import type { ReactNode } from 'react';", "import type { ReactNode } from 'react';\nimport type { QueryDocumentSnapshot } from 'firebase/firestore';")
s=s.replace('Assignment, TeamMember }','Assignment, TeamMember, Reply, Decision, TrashItem }')
s=s.replace('interface Store {', '''interface Store {
  syncStatus:string;lastSyncedAt:string;hasOlderActivities:boolean;loadOlderActivities:()=>Promise<void>;
  saveReply:(r:Reply)=>Promise<void>;deleteReply:(r:Reply)=>Promise<void>;
  acceptReply:(questionId:string,replyId:string,version:number)=>Promise<void>;
  saveDecision:(d:Decision)=>Promise<void>;restoreTrash:(t:TrashItem)=>Promise<void>;restorePrevious:(e:Activity)=>Promise<void>;
''')
s=s.replace("const [directoryError,setDirectoryError]=useState('');", """const [directoryError,setDirectoryError]=useState('');
  const [serverReady,setServerReady]=useState(false),[lastSyncedAt,setLastSyncedAt]=useState('');
  const [writeFault,setWriteFault]=useState(''),[pending,setPending]=useState(0),[metadataPending,setMetadataPending]=useState(false);
  const [hasOlderActivities,setHasOlderActivities]=useState(false);
  const activityCursor=useRef<QueryDocumentSnapshot|null>(null),older=useRef<Activity[]>([]);
  const syncStatus=preview?'preview':!online?'offline':error?'uxSyncError':writeFault?'uxWriteError':pending>0||metadataPending?'saving':serverReady?'uxSynced':'uxSyncing';""")
s=s.replace("setDirectoryError('');setData(null);", "setDirectoryError('');setData(null);setServerReady(false);setWriteFault('');activityCursor.current=null;older.current=[];")
s=s.replace("reviews:[],activities:[],assignments:[],members:seed.members||[]", "reviews:[],activities:[],assignments:[],replies:[],resolutions:[],decisions:[],trash:[],members:seed.members||[]")
start=s.index('    const loaded:Partial<Workspace>')
end=s.index('    return()=>{alive=false;stops.forEach(fn=>fn());};',start)
replacement='''    const loaded:Partial<Workspace>={schemaVersion:1},ready=new Set<string>();
    const metadata=new Map<string,{fromCache:boolean;hasPendingWrites:boolean}>();
    const update=(key:string,value:unknown,meta:{fromCache:boolean;hasPendingWrites:boolean})=>{
      if(!alive)return;Object.assign(loaded,{[key]:value});ready.add(key);metadata.set(key,meta);
      setMetadataPending([...metadata.values()].some(m=>m.hasPendingWrites));
      setServerReady(metadata.size===12&&[...metadata.values()].every(m=>!m.fromCache));
      if(!meta.fromCache)setLastSyncedAt(new Date().toISOString());
'''
replacement+='''      if(ready.size===12){
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
'''
s=s[:start]+replacement+s[end:]
s=s.replace("if(!isReview&&existing&&((existing as Entry).requirementId!==(item as Entry).requirementId||(existing as Entry).kind!==(item as Entry).kind))throw new Error('qhScopeInvalid');", "if(!isReview&&existing&&((existing as Entry).kind!==(item as Entry).kind||((existing as Entry).kind!=='qa'&&(existing as Entry).requirementId!==(item as Entry).requirementId)))throw new Error('qhScopeInvalid');")
needle="    if(import.meta.env.DEV&&preview){localCommit({...currentData,entries:"
s=s.replace(needle,"    const tombstone=action==='delete'?{id:event.id,entryId:item.id,snapshot:existing as Entry,deletedBy:member.uid,deletedByName:member.name,deletedAt:now,restoredBy:'',restoredAt:null,version:1}:null;\n"+needle.replace('entries:',"trash:tombstone?[...(currentData.trash||[]),tombstone]:currentData.trash||[],entries:"))
s=s.replace("if(action==='delete')tx.delete(target);else tx.set(target,write);", "if(action==='delete'){if(!snapshot.exists())throw Error('conflict');tx.set(doc(store,base,'trash',event.id),{...tombstone,snapshot:snapshot.data(),deletedAt:serverTimestamp()});tx.delete(target);}else tx.set(target,write);")
s=s.replace(".slice(0,100)","")
insert='''  const loadOlderActivities=async()=>{
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
'''
s=s.replace('  return <Context.Provider value=',insert+'  return <Context.Provider value=')
s=s.replace('saveEntry,deleteEntry,saveReview,saveAssignment,directoryError}}', '''saveEntry:e=>tracked(()=>saveEntry(e)),deleteEntry:e=>tracked(()=>deleteEntry(e)),saveReview:r=>tracked(()=>saveReview(r)),saveAssignment:(id,uid,v)=>tracked(()=>saveAssignment(id,uid,v)),directoryError,
    syncStatus,lastSyncedAt,hasOlderActivities,loadOlderActivities,saveReply:r=>tracked(()=>extra.saveReply(r)),deleteReply:r=>tracked(()=>extra.deleteReply(r)),acceptReply:(q,r,v)=>tracked(()=>extra.acceptReply(q,r,v)),saveDecision:d=>tracked(()=>extra.saveDecision(d)),restoreTrash:t=>tracked(()=>extra.restoreTrash(t)),restorePrevious:e=>tracked(()=>restorePrevious(e))}}''')
p.write_text(s)
print('Workspace: 12 metadata-aware listeners, tracked saves, independent replies/decisions, history pagination and transactional trash/restore.')
