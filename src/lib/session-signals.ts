/** Sign-out notifications only. Firebase remains the sole owner of credential storage. */
const key='weride.session.signout.v1';
interface SignOutSignal {uid:string;reason:'manual'|'expired';nonce:string;}
export function announceSignOut(uid:string,reason:SignOutSignal['reason']):void {
  try{localStorage.setItem(key,JSON.stringify({uid,reason,nonce:crypto.randomUUID()}));}
  catch{/* Persistent storage is unavailable; the active tab still signs out. */}
}
export function listenForSignOut(listener:(signal:SignOutSignal)=>void):()=>void {
  const receive=(event:StorageEvent)=>{
    if(event.key!==key||!event.newValue)return;
    try{
      const message=JSON.parse(event.newValue) as Partial<SignOutSignal>;
      if(typeof message.uid==='string'&&message.uid.length<=128&&typeof message.nonce==='string'&&
        (message.reason==='manual'||message.reason==='expired'))listener(message as SignOutSignal);
    }catch{/* Ignore malformed same-origin notification; it cannot grant access. */}
  };
  window.addEventListener('storage',receive);
  return()=>window.removeEventListener('storage',receive);
}
