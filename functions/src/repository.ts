import { randomBytes, createHash } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { PackError, scopeTitle } from './pack.js';
import type { ReviewPack, SourceWorkspace, ReviewContext } from './pack.js';
import type { Project, Requirement, Entry, Review, Reply, Decision, QuestionResolution } from './workspace-types.js';
import type { ShareRepository, ShareRow, StoredShare } from './sharing.js';
const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function loadWorkspace(db:Firestore):Promise<SourceWorkspace>{
  // A read-only transaction captures a consistent source snapshot, not sequential client reads.
  return db.runTransaction(async tx=>{
    const base=db.doc('workspaces/weride');
    const [project,context,requirements,entries,reviews,replies,decisions,resolutions]=await Promise.all([
      tx.get(base),tx.get(base.collection('context').doc('ai-review')),
      tx.get(base.collection('requirements')),tx.get(base.collection('entries')),tx.get(base.collection('reviews')),tx.get(base.collection('replies')),tx.get(base.collection('decisions')),tx.get(base.collection('resolutions')),
    ]);
    if(!project.exists)throw new PackError('SCOPE_NOT_FOUND',404);
    if(entries.size>5000||requirements.size>1000||replies.size>10000||decisions.size>1000)throw new PackError('PACK_TOO_LARGE',413);
    return {replies:replies.docs.map(d=>d.data() as Reply),decisions:decisions.docs.map(d=>d.data() as Decision),resolutions:resolutions.docs.map(d=>d.data() as QuestionResolution),project:project.data() as Project,reviewContext:context.exists?context.data() as ReviewContext:null,requirements:requirements.docs.map(d=>d.data() as Requirement),entries:entries.docs.map(d=>d.data() as Entry),reviews:reviews.docs.map(d=>d.data() as Review)};
  },{readOnly:true});
}
export class FirestoreShareRepository implements ShareRepository{
  constructor(private db:Firestore){}
  async create(uid:string,requestId:string,pack:ReviewPack,ttlHours:number):Promise<ShareRow>{
    const token=randomBytes(32).toString('base64url'),hash=hashToken(token),now=new Date(),day=now.toISOString().slice(0,10);
    const owner=this.db.doc(`reviewShareOwners/${uid}/links/${requestId}`),target=this.db.doc(`reviewShares/${hash}`),quota=this.db.doc(`reviewShareLimits/${uid}-${day}`);
    return this.db.runTransaction(async tx=>{
      const [old,q]=await Promise.all([tx.get(owner),tx.get(quota)]);
      if(old.exists){
        const previous=old.data() as ShareRow;
        if(previous.snapshotId!==pack.snapshotId||previous.sourceHash!==pack.sourceHash||previous.ttlHours!==ttlHours)throw new PackError('CONTEXT_CHANGED',409);
        if(previous.state==='revoked')throw new PackError('SHARE_UNAVAILABLE',410);
        return previous;
      }
      const count=Number(q.data()?.count||0);if(count>=20)throw new PackError('QUOTA_EXCEEDED',429);
      const row:ShareRow={id:requestId,snapshotId:pack.snapshotId,scope:scopeTitle(pack.content.options.scope),createdAt:now.toISOString(),expiresAt:new Date(now.getTime()+ttlHours*3600000).toISOString(),state:'active',sourceHash:pack.sourceHash,token,ttlHours};
      tx.create(target,{pack,ownerUid:uid,shareId:requestId,expiresAt:row.expiresAt,state:'active',createdAt:row.createdAt});
      // Bearer secret is retrievable only through authenticated owner APIs, never public Firestore.
      tx.create(owner,{...row,hash});
      tx.set(quota,{count:count+1,day,updatedAt:Timestamp.now()});
      return row;
    });
  }
  async list(uid:string,cursor?:string):Promise<{items:ShareRow[];nextCursor:string|null}>{
    const links=this.db.collection(`reviewShareOwners/${uid}/links`);
    let q=links.orderBy('createdAt','desc').limit(51);
    if(cursor){const previous=await links.doc(cursor).get();if(!previous.exists)throw new PackError('VALIDATION');q=q.startAfter(previous);}
    const snap=await q.get(),docs=snap.docs.slice(0,50);
    return {items:docs.map(d=>d.data() as ShareRow),nextCursor:snap.size>50?docs.at(-1)!.id:null};
  }
  async revoke(uid:string,id:string):Promise<void>{
    const owner=this.db.doc(`reviewShareOwners/${uid}/links/${id}`);
    await this.db.runTransaction(async tx=>{
      const row=await tx.get(owner);if(!row.exists)throw new PackError('SHARE_UNAVAILABLE',404);
      if(row.data()!.state==='revoked')return;
      const hash=String(row.data()!.hash);if(!/^[a-f0-9]{64}$/.test(hash))throw new PackError('SHARE_UNAVAILABLE',404);
      tx.update(this.db.doc(`reviewShares/${hash}`),{state:'revoked',revokedAt:Timestamp.now(),pack:FieldValue.delete()});
      tx.update(owner,{state:'revoked',revokedAt:Timestamp.now(),token:FieldValue.delete()});
    });
  }
  async get(token:string):Promise<StoredShare|null>{
    const row=await this.db.doc(`reviewShares/${hashToken(token)}`).get();
    return row.exists?row.data() as StoredShare:null;
  }
}
