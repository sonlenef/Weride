import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,TOKEN} from './client-fixture.mjs';
let f;before(async()=>{f=await fixture();});after(async()=>f?.close());beforeEach(async()=>f.reset());
const path=(p,action)=>`/public/${p.token}/${action}`;
const identity={name:'Client A',email:'client@example.test',language:'en'};
const answer={kind:'answer',text:'Dispatch first; please confirm the next phase.',language:'en'};
async function started(){const p=await f.publish(),key=f.key();assert.equal(p.status,201);const r=await f.call(path(p,'start'),{key,code:p.code,identity,consent:true},null);assert.equal(r.status,200);return {p,key,session:r.body.session};}
test('management requires current Madison Microsoft sign-in',async()=>{
  for(const auth of [null,'wrong-'+TOKEN,'old-'+TOKEN])assert([401,403].includes((await f.call('/mine',undefined,auth)).status));
  assert.equal((await f.call('/mine')).status,200);
});
test('publication requires consent, strong optional code and current preview',async()=>{
  const p=await f.publish();assert.equal(p.status,201);
  assert.equal((await f.call('/mine',{...p.input,acknowledge:false})).status,400);
  assert.equal((await f.call('/mine',{...p.input,code:'1234'})).status,400);
  assert.equal((await f.call('/mine',{...p.input,expectedSourceHash:'a'.repeat(64)})).status,409);
});
test('published snapshot whitelists fields and never includes internal responses',async()=>{
  const p=await f.publish();assert.equal(p.status,201);assert.equal(p.body.snapshot.questions.length,2);
  for(const marker of ['PRIVATE','ownerUid','codeHash','createdBy','estimateHours'])assert(!JSON.stringify(p.body).includes(marker));
  assert.equal(p.body.snapshot.questions[0].baseline.description.en,'Synthetic source excerpt.');
  const open=await f.call(path(p,'open'),{code:p.code},null);assert.equal(open.status,200);assert(!JSON.stringify(open.body).includes('respondents'));
});
test('publication is idempotent and private to its owner',async()=>{
  const p=await f.publish(),again=await f.call('/mine',p.input);assert.equal(again.body.id,p.body.id);
  assert.equal((await f.call('/mine')).body.items.length,1);assert.equal((await f.call('/mine',undefined,'bob-'+TOKEN)).body.items.length,0);
  assert.equal((await f.call('/mine/'+p.body.id,undefined,'bob-'+TOKEN)).status,404);
});
test('access code is checked before any questionnaire text is disclosed',async()=>{
  const p=await f.publish();for(const code of ['', 'incorrect-code']){const r=await f.call(path(p,'open'),{code},null);assert.equal(r.status,401);assert(!r.body.snapshot);}
  assert.equal((await f.call(path(p,'open'),{code:p.code},null)).status,200);
});
test('unprotected links still disclose no staff metadata and do not create sessions on read',async()=>{
  const p=await f.publish({},'');assert.equal((await f.call(path(p,'open'),{code:''},null)).status,200);
  assert.equal((await f.call('/mine/'+p.body.id)).body.respondents.length,0);
});
test('session creation requires consent and an explicit respondent identity',async()=>{
  const p=await f.publish(),key=f.key();assert.equal((await f.call(path(p,'start'),{key,code:p.code,identity,consent:false},null)).status,400);
  assert.equal((await f.call(path(p,'start'),{key,code:p.code,identity:{...identity,email:'invalid'},consent:true},null)).status,400);
});
test('resume credentials expose only their own session and are publication-scoped',async()=>{
  const {p,key}=await started(),other=await f.publish({title:'Another publication'});
  assert.equal((await f.call(path(p,'session'),{key},null)).body.session.name,identity.name);
  assert.equal((await f.call(path(p,'session'),{key:f.key()},null)).status,401);
  assert.equal((await f.call(path(other,'session'),{key},null)).status,401);
});
test('drafts autosave with revisions and duplicate saves are safe',async()=>{
  const {p,key}=await started(),body={key,revision:0,answers:{q1:answer}};
  const saved=await f.call(path(p,'save'),body,null);assert.equal(saved.body.revision,1);
  assert.equal((await f.call(path(p,'save'),body,null)).body.revision,1);
  assert.equal((await f.call(path(p,'save'),{...body,answers:{q1:{...answer,text:'stale overwrite'}}},null)).status,409);
  assert.equal((await f.call(path(p,'session'),{key},null)).body.session.answers.q1.text,answer.text);
});
test('draft answer text is not exposed in the internal respondent list',async()=>{
  const {p,key}=await started();await f.call(path(p,'save'),{key,revision:0,answers:{q1:answer}},null);
  const details=await f.call('/mine/'+p.body.id);assert.equal(details.body.respondents[0].counts.completed,1);assert(!JSON.stringify(details.body.respondents).includes(answer.text));
});
test('responses reject question injection, excess fields and oversized text',async()=>{
  const {p,key}=await started();
  for(const answers of [{outside:answer},{q1:{...answer,text:'x'.repeat(6001)}},{q1:{...answer,role:'admin'}},{q1:{...answer,language:'xx'}}])assert.equal((await f.call(path(p,'save'),{key,revision:0,answers},null)).status,400);
});
test('submission accepts partial answers but never empty or unexplained responses',async()=>{
  const {p,key}=await started();for(const answers of [{},{q1:{kind:'clarify',text:'',language:'en'}}])assert.equal((await f.call(path(p,'submit'),{key,revision:0,answers,confirm:true},null)).status,400);
  const s=await f.call(path(p,'submit'),{key,revision:0,answers:{q1:answer},confirm:true},null);assert.equal(s.status,200);assert.equal(s.body.state,'submitted');
  assert.equal((await f.db.collection('workspaces/weride/replies').get()).size,0);
  assert.equal((await f.call(`/mine/${p.body.id}/submissions/${s.body.id}`)).body.submission.answers.q1.text,answer.text);
});
test('submitted answers are immutable and retrying final submit does not duplicate a receipt',async()=>{
  const {p,key}=await started(),body={key,revision:0,answers:{q1:answer},confirm:true};
  const s=await f.call(path(p,'submit'),body,null);assert.equal((await f.call(path(p,'submit'),body,null)).body.id,s.body.id);
  assert.equal((await f.call(path(p,'save'),{key,revision:1,answers:{q1:{...answer,text:'replacement'}}},null)).status,409);
  assert.equal((await f.call('/mine/'+p.body.id)).body.publication.submissionCount,1);
});
test('closed publications preserve existing drafts but refuse writes until reopened',async()=>{
  const {p,key}=await started();assert.equal((await f.call(`/mine/${p.body.id}/state`,{state:'closed',version:1})).status,200);
  assert.equal((await f.call(path(p,'session'),{key},null)).body.state,'closed');
  assert.equal((await f.call(path(p,'save'),{key,revision:0,answers:{q1:answer}},null)).status,409);
  assert.equal((await f.call(`/mine/${p.body.id}/state`,{state:'published',version:2})).status,200);
  assert.equal((await f.call(path(p,'save'),{key,revision:0,answers:{q1:answer}},null)).status,200);
});
test('revocation blocks both published and resume links without deleting received responses',async()=>{
  const {p,key}=await started(),s=await f.call(path(p,'submit'),{key,revision:0,answers:{q1:answer},confirm:true},null);
  await f.call(`/mine/${p.body.id}/state`,{state:'revoked',version:1});
  assert.equal((await f.call(path(p,'open'),{code:p.code},null)).status,410);assert.equal((await f.call(path(p,'session'),{key},null)).status,410);
  assert.equal((await f.call(`/mine/${p.body.id}/submissions/${s.body.id}`)).status,200);
});
test('expiry is enforced on reads, saves and submissions by server time',async()=>{
  const {p,key}=await started();f.clock.value+=31*86400000;
  for(const action of ['open','session','save','submit']){const body=action==='open'?{code:p.code}:action==='session'?{key}:{key,revision:0,answers:{q1:answer},...(action==='submit'?{confirm:true}:{})};assert.equal((await f.call(path(p,action),body,null)).status,410);}
});
test('reviewed import preserves provenance and never automatically resolves a question',async()=>{
  const {p,key}=await started(),s=await f.call(path(p,'submit'),{key,revision:0,answers:{q1:answer},confirm:true},null);
  const target=`/mine/${p.body.id}/submissions/${s.body.id}/import`;
  const r=await f.call(target,{questionId:'q1'});assert.equal(r.status,200);
  const stored=(await f.db.doc('workspaces/weride/replies/'+r.body.replyId).get()).data();
  assert.equal(stored.external.identityVerified,false);assert.equal(stored.createdBy,'client:'+s.body.id);assert.equal(stored.body.en,answer.text);
  assert.equal((await f.db.collection('workspaces/weride/resolutions').get()).size,0);
  assert.equal((await f.call(target,{questionId:'q1'})).body.replyId,r.body.replyId);
  assert.equal((await f.db.collection('workspaces/weride/replies').get()).size,1);
});
test('changed source wording blocks import and remains visible as a review conflict',async()=>{
  const {p,key}=await started(),s=await f.call(path(p,'submit'),{key,revision:0,answers:{q1:answer},confirm:true},null);
  await f.db.doc('workspaces/weride/entries/q1').update({version:2,title:{en:'Changed question',vi:'',sv:''}});
  const view=await f.call(`/mine/${p.body.id}/submissions/${s.body.id}`);assert.equal(view.body.sourceState.q1,'changed');
  assert.equal((await f.call(`/mine/${p.body.id}/submissions/${s.body.id}/import`,{questionId:'q1'})).status,409);
  assert.equal((await f.call(path(p,'session'),{key},null)).body.snapshot.questions[0].version,1);
});
test('another employee cannot inspect submissions, import answers or revoke an owner link',async()=>{
  const {p,key}=await started(),s=await f.call(path(p,'submit'),{key,revision:0,answers:{q1:answer},confirm:true},null);
  assert.equal((await f.call(`/mine/${p.body.id}/submissions/${s.body.id}`,undefined,'bob-'+TOKEN)).status,404);
  assert.equal((await f.call(`/mine/${p.body.id}/submissions/${s.body.id}/import`,{questionId:'q1'},'bob-'+TOKEN)).status,404);
  assert.equal((await f.call(`/mine/${p.body.id}/state`,{state:'revoked',version:1},'bob-'+TOKEN)).status,404);
});
test('cross-origin requests and missing custom write headers are blocked',async()=>{
  const p=await f.publish();assert.equal((await f.call(path(p,'open'),{code:p.code},null,{Origin:'https://untrusted.example'})).status,403);
  assert.equal((await f.call(path(p,'open'),{code:p.code},null,{'X-Client-Request':''})).status,403);
});
test('empty drafts preserve language preferences but do not become final answers',async()=>{
  const {p,key}=await started();
  const answers={q1:answer,q2:{kind:'answer',text:'',language:'sv'}};
  const saved=await f.call(path(p,'save'),{key,revision:0,answers},null);
  assert.equal(saved.status,200);assert.equal(saved.body.answers.q2.language,'sv');
  const submitted=await f.call(path(p,'submit'),{key,revision:1,answers,confirm:true},null);
  assert.equal(submitted.status,200);assert.equal(Object.keys(submitted.body.answers).length,1);
  assert.equal(submitted.body.answers.q1.text,answer.text);
});
