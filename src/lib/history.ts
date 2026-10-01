import type {Activity,Entry,Workspace} from './types';
import {canManageEntry} from './questions';
const omit=new Set(['id','createdBy','createdByName','createdAt','updatedBy','updatedByName','updatedAt','version','activityId','restoredFrom']);
export interface FieldChange {field:string;before:string;after:string;}
function flatten(value:unknown,prefix=''):Record<string,string>{
  if(value===null||value===undefined)return {};
  if(typeof value!=='object')return {[prefix]:String(value)};
  if(Array.isArray(value))return {[prefix]:value.map(v=>typeof v==='object'?JSON.stringify(v):String(v)).join(', ')};
  const out:Record<string,string>={};
  for(const [key,v] of Object.entries(value)){
    if(!prefix&&omit.has(key))continue;
    const name=prefix?`${prefix}.${key}`:key;
    if(v!==null&&typeof v==='object'&&!Array.isArray(v))Object.assign(out,flatten(v,name));
    else out[name]=v===null?'':Array.isArray(v)?v.join(', '):String(v??'');
  }
  return out;
}
export function fieldChanges(before:unknown,after:unknown):FieldChange[]{
  const a=flatten(before),b=flatten(after);
  return [...new Set([...Object.keys(a),...Object.keys(b)])].sort().filter(k=>(a[k]||'')!==(b[k]||'')).map(field=>({field,before:a[field]||'',after:b[field]||''}));
}
export function canRestorePrevious(event:Activity,data:Workspace,uid:string|undefined):boolean {
  if(!uid||!event.before||!event.after||!['update','review'].includes(event.action))return false;
  const after=event.after as Entry;
  if(event.kind==='review')return data.reviews.some(r=>r.id===event.entryId&&r.version===after.version);
  if(!['qa','breakdown','assumption'].includes(event.kind))return false;
  const current=data.entries.find(e=>e.id===event.entryId);
  return Boolean(current&&current.version===after.version&&canManageEntry(current,uid));
}
