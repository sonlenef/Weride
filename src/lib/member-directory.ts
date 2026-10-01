import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './database';
/** Register only the currently authenticated identity; Firestore rules bind UID and email. */
export async function registerCurrentMember(member: {uid:string;email:string;name:string}): Promise<void> {
  if (!db) return;
  const store=db, ref=doc(store,'workspaces/weride/members',member.uid);
  await runTransaction(store,async tx=>{
    const snap=await tx.get(ref);
    const email=member.email.toLowerCase(), displayName=(member.name.trim()||email).slice(0,200);
    if(snap.exists()) {
      const data=snap.data();
      // Only administrators may reactivate a directory entry.
      if(!data.active || (data.email===email && data.displayName===displayName)) return;
      tx.update(ref,{email,displayName,updatedAt:serverTimestamp()});
    } else {
      tx.set(ref,{uid:member.uid,email,displayName,provider:'microsoft.com',active:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    }
  });
}
