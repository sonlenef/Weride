import {useEffect,useRef,useState} from 'react';
import type {Dispatch,SetStateAction} from 'react';
import {useAuth} from './auth';
import {readDraft,writeDraft,removeDraft} from './draft-storage';
import type {DraftRecord} from './draft-storage';
export function useDraft<T>(key:string,initial:T,type:DraftRecord['type'],label:string) {
  const {member}=useAuth(),uid=member?.uid||'';
  const [loaded]=useState(()=>uid?readDraft(uid,key):undefined);
  const [value,setValue]=useState<T>(()=>(loaded?.value as T)||structuredClone(initial));
  const current=useRef(value);current.current=value;
  const [saved,setSaved]=useState(Boolean(loaded)),[dirty,setDirty]=useState(Boolean(loaded));
  const [persisted,setPersisted]=useState(true);
  const setDraft:Dispatch<SetStateAction<T>>=next=>{
    const result=typeof next==='function'?(next as (v:T)=>T)(current.current):next;
    current.current=result;setValue(result);setDirty(true);
    if(uid){const ok=writeDraft(uid,key,type,result,label);setPersisted(ok);setSaved(ok);}
  };
  const clear=(next?:T)=>{if(uid)removeDraft(uid,key);setDirty(false);setSaved(false);setPersisted(true);if(next!==undefined){current.current=next;setValue(next);}};
  useEffect(()=>{if(!dirty||persisted)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[dirty,persisted]);
  return {draft:value,setDraft,clear,saved,dirty,persisted,restored:Boolean(loaded)};
}
