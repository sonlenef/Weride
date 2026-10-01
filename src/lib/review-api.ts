import {auth} from './firebase';
import type {PackOptions} from '../../functions/src/pack';
export interface SharedLink {id:string;snapshotId:string;scope:string;createdAt:string;expiresAt:string;state:'active'|'revoked';sourceHash:string;url?:string;}
export type SharingState='available'|'unavailable'|'offline'|'unauthorized';
export async function sharingState(signal?:AbortSignal):Promise<SharingState>{
  if(!navigator.onLine)return 'offline';
  const controller=new AbortController(),cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted)controller.abort();const timer=setTimeout(cancel,8000);
  try{const r=await fetch('/api/review-packs/status',{cache:'no-store',signal:controller.signal});if(r.status===401||r.status===403)return 'unauthorized';if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))return 'unavailable';const d=await r.json();return d.available===true&&d.service==='weride-review-sharing'?'available':'unavailable';}
  catch{return navigator.onLine?'unavailable':'offline';}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
export async function sharingAvailable(signal?:AbortSignal):Promise<boolean>{return await sharingState(signal)==='available';}
async function request<T>(path:string,body?:unknown):Promise<T>{
  const user=auth?.currentUser;if(!user)throw new Error('AUTH_REQUIRED');
  const token=await user.getIdToken();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),35000);
  try{
    const response=await fetch(`/api/review-packs/${path}`,{method:body===undefined?'GET':'POST',cache:'no-store',signal:controller.signal,headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
    if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('UNAVAILABLE');
    const data=await response.json();if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'UNAVAILABLE');return data as T;
  }finally{clearTimeout(timer);}
}
export const createSharedLink=(input:{options:PackOptions;snapshotId:string;expectedSourceHash:string;requestId:string;ttlHours:number;acknowledgeDisclosure:boolean})=>request<SharedLink>('shares',input);
export const listSharedLinks=(cursor?:string)=>request<{items:SharedLink[];nextCursor:string|null}>(`shares${cursor?`?cursor=${encodeURIComponent(cursor)}`:''}`);
export const revokeSharedLink=(id:string)=>request<{ok:true}>(`shares/${encodeURIComponent(id)}/revoke`,{});
export function reviewErrorKey(error:unknown):string{
  const code=(error as {code?:string;message?:string})?.code||(error as Error)?.message||'UNAVAILABLE';
  return 'aiError'+(['VALIDATION','CONTEXT_CHANGED','AUTH_REQUIRED','FORBIDDEN','SCOPE_NOT_FOUND','PACK_TOO_LARGE','QUOTA_EXCEEDED','SHARE_UNAVAILABLE'].includes(code)?code:'UNAVAILABLE');
}
