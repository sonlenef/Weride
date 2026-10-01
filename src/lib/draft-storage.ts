export interface DraftRecord { uid:string; key:string; type:'entry'|'review'|'reply'|'decision'; value:unknown; label:string; updatedAt:number; expiresAt:number; }
const STORAGE='weride.drafts.v2';
const TTL=24*60*60*1000;
const memory=new Map<string,DraftRecord>();
const suppressed=new Set<string>();
const compound=(uid:string,key:string)=>`${uid}:${key}`;
export function listDrafts(uid:string):DraftRecord[]{
  try { const all=JSON.parse(sessionStorage.getItem(STORAGE)||'{}');
    for(const [key,v] of Object.entries(all)){const r=v as DraftRecord;
      if(!suppressed.has(key)&&r&&typeof r.uid==='string'&&typeof r.key==='string'&&r.expiresAt>Date.now()&&(!memory.has(key)||memory.get(key)!.updatedAt<r.updatedAt))memory.set(key,r);
    }
  }catch{/* Keep in-memory recovery when browser storage is unavailable. */}
  for(const [key,r] of memory)if(r.expiresAt<=Date.now())memory.delete(key);
  return [...memory.values()].filter(r=>r.uid===uid).sort((a,b)=>b.updatedAt-a.updatedAt);
}
export function readDraft(uid:string,key:string):DraftRecord|undefined {return listDrafts(uid).find(r=>r.key===key);}
function flush():boolean {
  let persisted=false;
  try {sessionStorage.setItem(STORAGE,JSON.stringify(Object.fromEntries(memory)));persisted=true;}catch{/* Never silently lose the in-memory draft. */}
  window.dispatchEvent(new Event('weride:drafts'));return persisted;
}
export function writeDraft(uid:string,key:string,type:DraftRecord['type'],value:unknown,label:string):boolean {
  const now=Date.now();suppressed.delete(compound(uid,key));memory.set(compound(uid,key),{uid,key,type,value:structuredClone(value),label,updatedAt:now,expiresAt:now+TTL});return flush();
}
export function removeDraft(uid:string,key:string):void {listDrafts(uid);suppressed.add(compound(uid,key));memory.delete(compound(uid,key));flush();}
export function clearUserDrafts(uid:string):void {listDrafts(uid);for(const [key,r] of memory)if(r.uid===uid){suppressed.add(key);memory.delete(key);}flush();}
