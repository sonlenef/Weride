import {doc,runTransaction,serverTimestamp} from 'firebase/firestore';
import {db} from './database';
import {baselineItems,productError} from './product-tree';
import type {Activity,Localized,ProductItem,Workspace} from './types';
const base='workspaces/weride';
interface Context {member:{uid:string;name:string}|null;preview:boolean;online:boolean;get:()=>Workspace|null;commit:(next:Workspace)=>void;}
/** Product tree writes. Every write stamps the author on the item and appends a `product` activity in the same transaction. */
export function productActions(ctx:Context){
  const state=()=>{const data=ctx.get();if(!ctx.member||!data||(!ctx.preview&&!ctx.online))throw Error('writeError');return {data,items:data.productItems||[],member:ctx.member};};
  const isLocal=()=>import.meta.env.DEV&&ctx.preview;
  const event=(action:Activity['action'],entryId:string,title:Localized,before:unknown,after:unknown):Activity=>{
    const {member}=state();return {id:crypto.randomUUID(),kind:'product',action,entryId,requirementId:'',title,actor:member.uid,actorName:member.name,at:new Date().toISOString(),before,after};
  };
  const saveProductItem=async(item:ProductItem)=>{
    const {data,items,member}=state(),old=items.find(i=>i.id===item.id),issue=productError(item);
    if(issue)throw Error(issue);
    if((old?.version||0)!==item.version||old&&(old.kind!==item.kind||old.parentId!==item.parentId))throw Error('conflict');
    if(item.kind==='sub'&&!items.some(i=>i.id===item.parentId&&i.kind==='module'))throw Error('notFound');
    const now=new Date().toISOString(),next:ProductItem={...item,version:item.version+1,updatedBy:member.uid,updatedByName:member.name,updatedAt:now,...(!old?{createdBy:member.uid,createdByName:member.name,createdAt:now}:{})};
    const audit=event(old?'update':'create',item.id,item.name,old||null,next);
    if(isLocal()){ctx.commit({...data,productItems:[...items.filter(i=>i.id!==item.id),next],activities:[audit,...data.activities]});return next;}
    await runTransaction(db!,async tx=>{
      const target=doc(db!,base,'productItems',item.id),current=await tx.get(target);
      if((current.data()?.version||0)!==item.version)throw Error('conflict');
      const write={...next,createdAt:current.exists()?current.data().createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
      tx.set(target,write);
      tx.set(doc(db!,base,'activities',audit.id),{...audit,at:serverTimestamp(),before:current.exists()?current.data():null,after:write});
    });
    return next;
  };
  /** Deleting a module takes its submodules with it; the activity keeps the full snapshot (`before.subs`). */
  const deleteProductItem=async(item:ProductItem)=>{
    const {data,items}=state(),old=items.find(i=>i.id===item.id);
    if(!old||old.version!==item.version)throw Error('conflict');
    const children=old.kind==='module'?items.filter(i=>i.kind==='sub'&&i.parentId===old.id):[];
    const audit=event('delete',old.id,old.name,children.length?{...old,subs:children}:old,null);
    if(isLocal()){ctx.commit({...data,productItems:items.filter(i=>i.id!==old.id&&!children.includes(i)),activities:[audit,...data.activities]});return;}
    await runTransaction(db!,async tx=>{
      const target=doc(db!,base,'productItems',old.id),current=await tx.get(target);
      if(!current.exists()||current.data().version!==item.version)throw Error('conflict');
      const kids=(await Promise.all(children.map(c=>tx.get(doc(db!,base,'productItems',c.id))))).filter(k=>k.exists());
      kids.forEach(k=>tx.delete(k.ref));tx.delete(target);
      tx.set(doc(db!,base,'activities',audit.id),{...audit,at:serverTimestamp(),before:kids.length?{...current.data(),subs:kids.map(k=>k.data())}:current.data()});
    });
  };
  /** One-time import of the handover baseline, attributed to whoever clicks. Stable ids make a concurrent second import fail. */
  const importProductBaseline=async()=>{
    const {data,items,member}=state();if(items.length)throw Error('conflict');
    const now=new Date().toISOString(),seed=baselineItems().map(i=>({...i,version:1,createdBy:member.uid,createdByName:member.name,createdAt:now,updatedBy:member.uid,updatedByName:member.name,updatedAt:now}));
    const audit=event('create','product-baseline',{en:`Handover baseline (${seed.length} items)`,vi:`Bản handover (${seed.length} item)`,sv:`Överlämningens bas (${seed.length} poster)`},null,{count:seed.length});
    if(isLocal()){ctx.commit({...data,productItems:seed,activities:[audit,...data.activities]});return;}
    await runTransaction(db!,async tx=>{
      if((await tx.get(doc(db!,base,'productItems',seed[0].id))).exists())throw Error('conflict');
      for(const i of seed)tx.set(doc(db!,base,'productItems',i.id),{...i,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      tx.set(doc(db!,base,'activities',audit.id),{...audit,at:serverTimestamp()});
    });
  };
  return {saveProductItem,deleteProductItem,importProductBaseline};
}
