import {createHash,randomBytes,randomUUID,scryptSync,timingSafeEqual} from 'node:crypto';
import {FieldValue} from 'firebase-admin/firestore';
import type {Firestore} from 'firebase-admin/firestore';
import {canonical} from './pack.js';
import {loadWorkspace} from './repository.js';
import {QuestionnaireError,makeSnapshot,parseAnswers,parseIdentity,answerComplete,answerCounts,tokenPattern} from './questionnaire-model.js';
import type {Publication,PublishOptions,RespondentSession,Submission,QuestionnaireSnapshot} from './questionnaire-model.js';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
interface Stored extends Publication {ownerUid:string;ownerName:string;token:string;salt:string;codeHash:string;requestHash:string;}
const publicFields=(p:Stored):Publication=>({id:p.id,snapshot:p.snapshot,sourceHash:p.sourceHash,createdAt:p.createdAt,expiresAt:p.expiresAt,dueDate:p.dueDate,state:p.state,version:p.version,protected:p.protected,sessionCount:p.sessionCount,submissionCount:p.submissionCount});
const snapshotOnly=(p:Stored)=>({snapshot:p.snapshot,expiresAt:p.expiresAt,dueDate:p.dueDate,state:p.state});
const ensureActive=(p:Stored,now:number,write=false)=>{
  if(p.state==='revoked'||Date.parse(p.expiresAt)<=now)throw new QuestionnaireError('UNAVAILABLE',410);
  if(write&&p.state!=='published')throw new QuestionnaireError('CLOSED',409);
};
const sessionSecret=(key:string)=>{if(!tokenPattern.test(key))throw new QuestionnaireError('SESSION',401);return hash(key);};
export class QuestionnaireRepository {
  constructor(private db:Firestore,private origin:string,private clock=()=>Date.now()){}
  private ref(id:string){return this.db.collection('clientQuestionnaires').doc(id);}
  private async owned(id:string,uid:string){
    const doc=await this.ref(id).get();if(!doc.exists||doc.data()!.ownerUid!==uid)throw new QuestionnaireError('NOT_FOUND',404);
    return doc.data() as Stored;
  }
  private async tokenRow(token:string):Promise<Stored>{
    if(!tokenPattern.test(token))throw new QuestionnaireError('UNAVAILABLE',404);
    const pointer=await this.db.doc(`clientQuestionnaireTokens/${hash(token)}`).get();
    if(!pointer.exists)throw new QuestionnaireError('UNAVAILABLE',404);
    const doc=await this.ref(pointer.data()!.id).get();if(!doc.exists)throw new QuestionnaireError('UNAVAILABLE',404);
    const row=doc.data() as Stored;ensureActive(row,this.clock());return row;
  }
  async publish(uid:string,name:string,requestId:string,options:PublishOptions,expectedHash:string,code:string){
    const requestHash=hash(canonical({options,expectedHash,codeHash:hash(code)}));
    const existing=await this.ref(requestId).get();
    if(existing.exists){const p=existing.data() as Stored;if(p.ownerUid!==uid||p.requestHash!==requestHash)throw new QuestionnaireError('CONFLICT',409);return {...publicFields(p),url:`${this.origin}/respond/${p.token}`};}
    const snapshot=makeSnapshot(await loadWorkspace(this.db),options),sourceHash=hash(canonical(snapshot));
    if(sourceHash!==expectedHash)throw new QuestionnaireError('SOURCE_CHANGED',409);
    if(Buffer.byteLength(JSON.stringify(snapshot))>650000)throw new QuestionnaireError('TOO_LARGE',413);
    const now=this.clock(),createdAt=new Date(now).toISOString(),expiresAt=new Date(now+options.ttlDays*86400000).toISOString();
    if(options.dueDate&&(options.dueDate<createdAt.slice(0,10)||options.dueDate>expiresAt.slice(0,10)))throw new QuestionnaireError('DUE_DATE');
    const token=randomBytes(32).toString('base64url'),salt=randomBytes(16).toString('hex');
    const row:Stored={id:requestId,snapshot,sourceHash,createdAt,expiresAt,dueDate:options.dueDate,state:'published',version:1,protected:Boolean(code),sessionCount:0,submissionCount:0,ownerUid:uid,ownerName:name,token,salt,codeHash:code?scryptSync(code,salt,32).toString('hex'):'',requestHash};
    await this.db.runTransaction(async tx=>{
      const quota=this.db.doc(`clientQuestionnaireLimits/${hash(uid)}-${createdAt.slice(0,10)}`);
      const [old,limit]=await Promise.all([tx.get(this.ref(requestId)),tx.get(quota)]);
      if(old.exists)throw new QuestionnaireError('RETRY',409);
      if((limit.data()?.count||0)>=20)throw new QuestionnaireError('LIMIT',429);
      tx.create(this.ref(requestId),row);tx.create(this.db.doc(`clientQuestionnaireTokens/${hash(token)}`),{id:requestId});
      tx.create(this.db.doc(`clientQuestionnaireOwners/${uid}/publications/${requestId}`),{id:requestId,createdAt});
      tx.set(quota,{count:(limit.data()?.count||0)+1,day:createdAt.slice(0,10)});
    });
    return {...publicFields(row),url:`${this.origin}/respond/${token}`};
  }
  async list(uid:string,cursor?:string){
    const collection=this.db.collection(`clientQuestionnaireOwners/${uid}/publications`);
    let query=collection.orderBy('createdAt','desc').limit(21);
    if(cursor){const d=await collection.doc(cursor).get();if(!d.exists)throw new QuestionnaireError('VALIDATION');query=query.startAfter(d);}
    const page=await query.get(),docs=page.docs.slice(0,20);
    const rows=docs.length?await this.db.getAll(...docs.map(d=>this.ref(d.id))):[];
    return {items:rows.filter(d=>d.exists).map(d=>{const p=d.data() as Stored;return {...publicFields(p),snapshot:{...p.snapshot,questions:[]},questionCount:p.snapshot.questions.length,url:p.state==='revoked'?undefined:`${this.origin}/respond/${p.token}`};}),nextCursor:page.size>20?docs.at(-1)!.id:null};
  }
  async detail(uid:string,id:string){
    const p=await this.owned(id,uid);
    const sessions=await this.ref(id).collection('sessions').select('id','name','email','state','savedAt','submittedAt','counts').get();
    return {publication:{...publicFields(p),url:p.state==='revoked'?undefined:`${this.origin}/respond/${p.token}`},respondents:sessions.docs.map(d=>d.data())};
  }
  async state(uid:string,id:string,state:Publication['state'],version:number){
    await this.db.runTransaction(async tx=>{
      const ref=this.ref(id),doc=await tx.get(ref),p=doc.data() as Stored;
      if(!doc.exists||p.ownerUid!==uid)throw new QuestionnaireError('NOT_FOUND',404);
      if(p.version!==version)throw new QuestionnaireError('CONFLICT',409);
      if(p.state==='revoked'||state==='published'&&Date.parse(p.expiresAt)<=this.clock())throw new QuestionnaireError('UNAVAILABLE',410);
      tx.update(ref,{state,version:p.version+1});
    });return {ok:true};
  }
  private async unlock(p:Stored,code:string,fingerprint:string){
    const bucket=Math.floor(this.clock()/900000),ref=this.db.doc(`clientQuestionnaireRates/${hash(p.id+':'+fingerprint+':'+bucket)}`);
    await this.db.runTransaction(async tx=>{
      const doc=await tx.get(ref),count=doc.data()?.count||0;if(count>=40)throw new QuestionnaireError('LIMIT',429);
      tx.set(ref,{count:count+1,expiresAt:new Date((bucket+2)*900000).toISOString()});
    });
    if(!p.protected)return;
    if(!code)throw new QuestionnaireError('CODE_REQUIRED',401);
    const actual=scryptSync(code,p.salt,32),expected=Buffer.from(p.codeHash,'hex');
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new QuestionnaireError('CODE_INVALID',401);
  }
  async open(token:string,code:string,fingerprint:string){
    const p=await this.tokenRow(token);await this.unlock(p,code,fingerprint);return snapshotOnly(p);
  }
  async start(token:string,key:string,code:string,identity:unknown,fingerprint:string){
    const p=await this.tokenRow(token),ref=this.ref(p.id).collection('sessions').doc(sessionSecret(key));
    const old=await ref.get();if(old.exists)return { ...snapshotOnly(p), session:old.data() as RespondentSession};
    ensureActive(p,this.clock(),true);await this.unlock(p,code,fingerprint);
    const who=parseIdentity(identity),now=new Date(this.clock()).toISOString();
    const session:RespondentSession={...who,id:randomUUID(),answers:{},revision:0,state:'draft',savedAt:now,submittedAt:null};
    await this.db.runTransaction(async tx=>{
      const [publication,existing]=await Promise.all([tx.get(this.ref(p.id)),tx.get(ref)]);
      const current=publication.data() as Stored;ensureActive(current,this.clock(),true);
      if(existing.exists)throw new QuestionnaireError('RETRY',409);
      if(current.sessionCount>=50)throw new QuestionnaireError('LIMIT',429);
      tx.create(ref,{...session,counts:answerCounts({}),saveCount:0});tx.update(this.ref(p.id),{sessionCount:current.sessionCount+1});
    });return {...snapshotOnly(p),session};
  }
  async session(token:string,key:string){
    const p=await this.tokenRow(token),doc=await this.ref(p.id).collection('sessions').doc(sessionSecret(key)).get();
    if(!doc.exists)throw new QuestionnaireError('SESSION',401);
    return {...snapshotOnly(p),session:doc.data() as RespondentSession};
  }
  async save(token:string,key:string,revision:number,rawAnswers:unknown,submit=false){
    const p=await this.tokenRow(token),ref=this.ref(p.id).collection('sessions').doc(sessionSecret(key));
    const draftAnswers = parseAnswers(rawAnswers, p.snapshot);
    const answers = submit
      ? Object.fromEntries(Object.entries(draftAnswers).filter(([, answer]) => answer.kind !== 'answer' || answer.text.trim().length > 0))
      : draftAnswers;
    if(submit&&!Object.values(answers).some(answerComplete))throw new QuestionnaireError('EMPTY');
    if(submit&&Object.values(answers).some(a=>a.kind!=='later'&&!a.text.trim()))throw new QuestionnaireError('INCOMPLETE');
    return this.db.runTransaction(async tx=>{
      const [publication,doc]=await Promise.all([tx.get(this.ref(p.id)),tx.get(ref)]);
      const current=publication.data() as Stored;ensureActive(current,this.clock());
      if(!doc.exists)throw new QuestionnaireError('SESSION',401);
      const s=doc.data() as RespondentSession&{saveCount:number};
      if(s.state==='submitted'){
        if(submit&&canonical(s.answers)===canonical(answers))return s;
        throw new QuestionnaireError('SUBMITTED',409);
      }
      ensureActive(current,this.clock(),true);
      if(s.revision!==revision){
        if(!submit&&canonical(s.answers)===canonical(answers))return s;
        throw new QuestionnaireError('CONFLICT',409);
      }
      if((s.saveCount||0)>=3000)throw new QuestionnaireError('LIMIT',429);
      const now=new Date(this.clock()).toISOString();
      const next:RespondentSession={id:s.id,name:s.name,email:s.email,language:s.language,answers,revision:s.revision+1,state:submit?'submitted':'draft',savedAt:now,submittedAt:submit?now:null};
      tx.set(ref,{...next,saveCount:(s.saveCount||0)+1,counts:answerCounts(answers)});
      if(submit){
        tx.create(this.ref(p.id).collection('submissions').doc(s.id),{...next,imported:{}});
        tx.update(this.ref(p.id),{submissionCount:current.submissionCount+1});
      }
      return next;
    });
  }
  async submission(uid:string,id:string,submissionId:string){
    const publication=await this.owned(id,uid),doc=await this.ref(id).collection('submissions').doc(submissionId).get();
    if(!doc.exists)throw new QuestionnaireError('NOT_FOUND',404);
    const submission=doc.data() as Submission;
    const source=await this.db.getAll(...publication.snapshot.questions.map(q=>this.db.doc(`workspaces/weride/entries/${q.id}`)));
    const sourceState=Object.fromEntries(publication.snapshot.questions.map((q,i)=>[q.id,!source[i].exists?'deleted':source[i].data()!.version!==q.version?'changed':'current']));
    return {submission,sourceState};
  }
  async importAnswer(uid:string,actorName:string,id:string,submissionId:string,questionId:string){
    await this.owned(id,uid);
    const replyId='client_'+hash(`${id}:${submissionId}:${questionId}`).slice(0,40);
    return this.db.runTransaction(async tx=>{
      const publicationRef=this.ref(id),receiptRef=publicationRef.collection('submissions').doc(submissionId);
      const questionRef=this.db.doc(`workspaces/weride/entries/${questionId}`),replyRef=this.db.doc(`workspaces/weride/replies/${replyId}`);
      const [pDoc,sDoc,qDoc,rDoc]=await Promise.all([tx.get(publicationRef),tx.get(receiptRef),tx.get(questionRef),tx.get(replyRef)]);
      const p=pDoc.data() as Stored,s=sDoc.data() as Submission;
      if(!pDoc.exists||p.ownerUid!==uid||!sDoc.exists)throw new QuestionnaireError('NOT_FOUND',404);
      if(Object.hasOwn(s.imported,questionId))return {replyId:s.imported[questionId].replyId,alreadyImported:true};
      const captured=p.snapshot.questions.find(q=>q.id===questionId),answer=s.answers[questionId];
      if(!captured||!answerComplete(answer))throw new QuestionnaireError('QUESTION_SCOPE');
      if(!qDoc.exists||qDoc.data()!.kind!=='qa'||qDoc.data()!.version!==captured.version||qDoc.data()!.requirementId!==captured.requirementId)throw new QuestionnaireError('SOURCE_CHANGED',409);
      if(rDoc.exists)throw new QuestionnaireError('CONFLICT',409);
      const now=new Date(this.clock()).toISOString(),q=qDoc.data()!;
      const fallback={en:'Will confirm later.',vi:'Sẽ xác nhận sau.',sv:'Återkommer med bekräftelse.'};
      const body={en:'',vi:'',sv:'',[answer.language]:answer.text||fallback[answer.language]};
      const external={publicationId:id,submissionId,questionVersion:captured.version,respondentName:s.name,respondentEmail:s.email,identityVerified:false,answerKind:answer.kind,submittedAt:s.submittedAt,importedBy:uid};
      const reply={id:replyId,questionId,body,originalLocale:answer.language,version:1,createdBy:`client:${submissionId}`,createdByName:s.name,updatedBy:uid,updatedByName:actorName,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),external};
      const eventId=randomUUID();tx.create(replyRef,reply);
      tx.update(receiptRef,{imported:{...s.imported,[questionId]:{replyId,importedAt:now,importedBy:uid}}});
      tx.create(this.db.doc(`workspaces/weride/activities/${eventId}`),{id:eventId,kind:'reply',action:'create',entryId:replyId,requirementId:q.requirementId,title:q.title,actor:uid,actorName,at:FieldValue.serverTimestamp(),before:null,after:reply});
      return {replyId,alreadyImported:false};
    });
  }
}
export type QuestionnairePort=Pick<QuestionnaireRepository,'publish'|'list'|'detail'|'state'|'open'|'start'|'session'|'save'|'submission'|'importAnswer'>;
export type PublicSessionResult={snapshot:QuestionnaireSnapshot;expiresAt:string;dueDate:string;state:Publication['state'];session:RespondentSession};
