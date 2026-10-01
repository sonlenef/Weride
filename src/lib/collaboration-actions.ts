import {doc,runTransaction,serverTimestamp} from 'firebase/firestore';
import {db} from './database';
import {canManageEntry} from './questions';
import {canEditReply,replyError,decisionError} from './collaboration';
import type {Workspace,Reply,Decision,Entry,Activity,TrashItem,QuestionResolution} from './types';
const base='workspaces/weride';
interface Context {member:{uid:string;name:string}|null;preview:boolean;online:boolean;get:()=>Workspace|null;commit:(next:Workspace)=>void;}
export function collaborationActions(ctx:Context){
  const state=()=>{const data=ctx.get();if(!ctx.member||!data||(!ctx.preview&&!ctx.online))throw Error('writeError');return {data,member:ctx.member};};
  const isLocal=()=>import.meta.env.DEV&&ctx.preview;
  const event=(kind:string,action:Activity['action'],id:string,requirementId:string,title:Entry['title'],before:unknown,after:unknown):Activity=>{
    const {member}=state();return {id:crypto.randomUUID(),kind,action,entryId:id,requirementId,title,actor:member.uid,actorName:member.name,at:new Date().toISOString(),before,after};
  };
  const saveReply=async(reply:Reply,remove=false)=>{
    const {data,member}=state(),q=data.entries.find(e=>e.kind==='qa'&&e.id===reply.questionId);
    if(!q)throw Error('notFound');
    const old=data.replies?.find(r=>r.id===reply.id),issue=replyError(reply);
    if(!remove&&issue)throw Error(issue);
    if((old?.version||0)!==reply.version)throw Error('conflict');
    if(old&&!canEditReply(old,member.uid,data.resolutions))throw Error('uxAcceptedLocked');
    const now=new Date().toISOString();
    const next:Reply={...reply,version:reply.version+1,updatedBy:member.uid,updatedByName:member.name,updatedAt:now,...(!old?{createdBy:member.uid,createdByName:member.name,createdAt:now}:{})};
    const audit=event('reply',remove?'delete':old?'update':'create',reply.id,q.requirementId,q.title,old||null,remove?null:next);
    if(isLocal()){ctx.commit({...data,replies:[...(data.replies||[]).filter(r=>r.id!==reply.id),...(remove?[]:[next])],activities:[audit,...data.activities]});return;}
    const target=doc(db!,base,'replies',reply.id);
    await runTransaction(db!,async tx=>{
      const [current,question,resolution]=await Promise.all([tx.get(target),tx.get(doc(db!,base,'entries',q.id)),tx.get(doc(db!,base,'resolutions',q.id))]);
      if(!question.exists()||(current.data()?.version||0)!==reply.version)throw Error('conflict');
      if(current.exists()&&(current.data().createdBy!==member.uid||resolution.data()?.replyId===reply.id))throw Error('uxAcceptedLocked');
      const write={...next,createdAt:current.exists()?current.data().createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
      if(remove)tx.delete(target);else tx.set(target,write);
      tx.set(doc(db!,base,'activities',audit.id),{...audit,requirementId:question.data().requirementId,at:serverTimestamp(),before:current.exists()?current.data():null,after:remove?null:write});
    });
  };
  const acceptReply=async(questionId:string,replyId:string,expectedVersion:number)=>{
    const {data,member}=state(),q=data.entries.find(e=>e.id===questionId&&e.kind==='qa');
    if(!q||q.createdBy!==member.uid)throw Error('qaOnlyAuthor');
    const old=data.resolutions?.find(r=>r.id===questionId),reply=data.replies?.find(r=>r.id===replyId&&r.questionId===questionId);
    if((old?.version||0)!==expectedVersion)throw Error('conflict');
    if(replyId&&!reply)throw Error('notFound');
    const next:QuestionResolution={id:questionId,replyId,replyVersion:reply?.version||0,version:expectedVersion+1,updatedBy:member.uid,updatedByName:member.name,updatedAt:new Date().toISOString()};
    const audit=event('resolution','resolve',questionId,q.requirementId,q.title,old||null,next);
    if(isLocal()){ctx.commit({...data,resolutions:[...(data.resolutions||[]).filter(r=>r.id!==questionId),next],activities:[audit,...data.activities]});return;}
    await runTransaction(db!,async tx=>{
      const target=doc(db!,base,'resolutions',questionId);
      const [question,current,answer]=await Promise.all([tx.get(doc(db!,base,'entries',questionId)),tx.get(target),replyId?tx.get(doc(db!,base,'replies',replyId)):Promise.resolve(null)]);
      if(question.data()?.createdBy!==member.uid)throw Error('qaOnlyAuthor');
      if((current.data()?.version||0)!==expectedVersion||replyId&&(!answer?.exists()||answer.data().questionId!==questionId||answer.data().version!==reply?.version))throw Error('conflict');
      const write={...next,updatedAt:serverTimestamp()};tx.set(target,write);
      tx.set(doc(db!,base,'activities',audit.id),{...audit,requirementId:question.data()!.requirementId,at:serverTimestamp(),before:current.exists()?current.data():null,after:write});
    });
  };
  const saveDecision=async(decision:Decision)=>{
    const {data,member}=state(),old=data.decisions?.find(d=>d.id===decision.id),issue=decisionError(decision);
    if(issue)throw Error(issue);if(old&&old.createdBy!==member.uid)throw Error('qaOnlyAuthor');
    if((old?.version||0)!==decision.version)throw Error('conflict');
    if(decision.requirementIds.some(id=>!data.requirements.some(r=>r.id===id)))throw Error('qhScopeInvalid');
    const now=new Date().toISOString(),next:Decision={...decision,version:decision.version+1,updatedBy:member.uid,updatedByName:member.name,updatedAt:now,confirmedBy:decision.state==='confirmed'?member.uid:'',confirmedAt:decision.state==='confirmed'?now:null,...(!old?{createdBy:member.uid,createdByName:member.name,createdAt:now}:{})};
    const audit=event('decision',old?'update':'create',decision.id,'',decision.title,old||null,next);
    if(isLocal()){ctx.commit({...data,decisions:[...(data.decisions||[]).filter(d=>d.id!==decision.id),next],activities:[audit,...data.activities]});return;}
    await runTransaction(db!,async tx=>{
      const target=doc(db!,base,'decisions',decision.id),current=await tx.get(target);
      if((current.data()?.version||0)!==decision.version)throw Error('conflict');
      if(current.exists()&&current.data().createdBy!==member.uid)throw Error('qaOnlyAuthor');
      const write={...next,createdAt:current.exists()?current.data().createdAt:serverTimestamp(),updatedAt:serverTimestamp(),confirmedAt:next.state==='confirmed'?serverTimestamp():null};
      tx.set(target,write);tx.set(doc(db!,base,'activities',audit.id),{...audit,at:serverTimestamp(),before:current.exists()?current.data():null,after:write});
    });
  };
  const restoreTrash=async(item:TrashItem)=>{
    const {data,member}=state(),entry=item.snapshot;
    if(!canManageEntry(entry,member.uid))throw Error('uxRestorePermission');
    if(item.restoredBy||data.entries.some(e=>e.id===entry.id))throw Error('conflict');
    const now=new Date().toISOString(),next:Entry={...entry,restoredFrom:item.id,version:entry.version+1,updatedBy:member.uid,updatedByName:member.name,updatedAt:now};
    const audit=event(entry.kind,'restore',entry.id,entry.requirementId,entry.title,null,next);
    if(isLocal()){ctx.commit({...data,entries:[...data.entries,next],trash:(data.trash||[]).map(t=>t.id===item.id?{...t,restoredBy:member.uid,restoredAt:now,version:t.version+1}:t),activities:[audit,...data.activities]});return;}
    await runTransaction(db!,async tx=>{
      const target=doc(db!,base,'entries',entry.id),archive=doc(db!,base,'trash',item.id);
      const [current,old]=await Promise.all([tx.get(target),tx.get(archive)]);
      if(current.exists()||!old.exists()||old.data().version!==item.version||old.data().restoredBy)throw Error('conflict');
      const original=old.data().snapshot as Entry;if(!canManageEntry(original,member.uid))throw Error('uxRestorePermission');
      const write={...original,restoredFrom:item.id,version:original.version+1,updatedBy:member.uid,updatedByName:member.name,updatedAt:serverTimestamp()};
      tx.set(target,write);tx.update(archive,{restoredBy:member.uid,restoredAt:serverTimestamp(),version:item.version+1});
      tx.set(doc(db!,base,'activities',audit.id),{...audit,at:serverTimestamp(),after:write});
    });
  };
  return {saveReply:(r:Reply)=>saveReply(r),deleteReply:(r:Reply)=>saveReply(r,true),acceptReply,saveDecision,restoreTrash};
}
