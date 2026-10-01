import { readFileSync } from 'node:fs';
import { before,after,beforeEach,test } from 'node:test';
import { initializeTestEnvironment,assertSucceeds,assertFails } from '@firebase/rules-unit-testing';
import { doc,setDoc,getDoc,deleteDoc,updateDoc,serverTimestamp,runTransaction } from 'firebase/firestore';
let env;
const base='workspaces/weride';
const loc=(en='')=>({en,vi:'',sv:''});
const claims={auth_time:Math.floor(Date.now()/1000),email:'reviewer@madison.dev',email_verified:false,firebase:{sign_in_provider:'microsoft.com'}};
const context=(uid='reviewer',overrides={})=>env.authenticatedContext(uid,{...claims,...overrides}).firestore();
const ref=(db,path)=>doc(db,`${base}/${path}`);
const entry=(id='entry1',extra={})=>({id,requirementId:'FN-BKG-01',kind:'qa',parentId:'',title:loc('Discovery question'),body:loc(),answer:loc(),acceptance:loc(),status:'open',priority:'medium',owner:'',estimateHours:null,version:1,origin:'team',createdBy:'reviewer',updatedBy:'reviewer',createdByName:'Reviewer',updatedByName:'Reviewer',createdAt:serverTimestamp(),updatedAt:serverTimestamp(),...extra});
const review=(extra={})=>({id:'FN-BKG-01',compliance:'',state:'unreviewed',comments:loc(),effortHours:null,cost:null,currency:'EUR',releaseDate:'',version:1,updatedBy:'reviewer',updatedByName:'Reviewer',updatedAt:serverTimestamp(),...extra});
const audit=(extra={})=>({id:'event1',action:'create',requirementId:'FN-BKG-01',entryId:'entry1',kind:'qa',title:loc('Question'),actor:'reviewer',actorName:'Reviewer',at:serverTimestamp(),before:null,after:{version:1},...extra});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-weride',firestore:{host:'127.0.0.1',port:8089,rules:readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,base),{name:'WeRide'});for(const id of ['FN-BKG-01','FN-DIS-01'])await setDoc(ref(db,`requirements/${id}`),{id});});});
test('anonymous users cannot read or write private workspace data',async()=>{const db=env.unauthenticatedContext().firestore();await assertFails(getDoc(doc(db,base)));await assertFails(getDoc(ref(db,'requirements/FN-BKG-01')));await assertFails(setDoc(ref(db,'entries/entry1'),entry()));});
for(const [label,override] of [['foreign domain',{email:'reviewer@example.com'}],['missing email',{email:null}],['subdomain',{email:'reviewer@sub.madison.dev'}],['missing provider',{firebase:{}}],['custom provider',{firebase:{sign_in_provider:'custom'}}],['suffix attack',{email:'reviewer@madison.dev.evil.com'}],['password provider',{firebase:{sign_in_provider:'password'}}],['Google provider',{firebase:{sign_in_provider:'google.com'}}]])test(`${label} is rejected by server rules`,async()=>{const db=context('reviewer',override);await assertFails(getDoc(doc(db,base)));await assertFails(setDoc(ref(db,'entries/entry1'),entry()));});
test('Microsoft domain member can read baseline, never modify it',async()=>{const db=context();await assertSucceeds(getDoc(doc(db,base)));await assertSucceeds(getDoc(ref(db,'requirements/FN-BKG-01')));await assertFails(updateDoc(doc(db,base),{name:'Tampered'}));await assertFails(setDoc(ref(db,'requirements/NEW'),{id:'NEW'}));await assertFails(deleteDoc(ref(db,'requirements/FN-BKG-01')));});
test('mixed-case exact domain is accepted',async()=>{await assertSucceeds(getDoc(doc(context('reviewer',{email:'Reviewer@MADISON.DEV'}),base)));});
test('team CRUD uses server timestamps, immutable provenance and version increments',async()=>{const db=context();const r=ref(db,'entries/entry1');await assertSucceeds(setDoc(r,entry()));await assertSucceeds(updateDoc(r,{title:loc('Edited'),version:2,updatedAt:serverTimestamp()}));await assertFails(updateDoc(r,{title:loc('Stale'),version:2,updatedAt:serverTimestamp()}));await assertFails(updateDoc(r,{createdBy:'other',version:3,updatedAt:serverTimestamp()}));await assertSucceeds(deleteDoc(r));});
test('client cannot spoof actors, seed origin, arbitrary keys or unknown requirement',async()=>{const db=context();for(const extra of [{updatedBy:'other'},{createdBy:'other'},{origin:'proposal'},{privileged:true},{requirementId:'NOT-IN-RFP'},{version:0},{title:{en:'Only English'}},{title:loc('x'.repeat(2001))},{createdAt:'2026-01-01'}])await assertFails(setDoc(ref(db,'entries/entry1'),entry('entry1',extra)));});
test('question status needs an answer',async()=>{const db=context();await assertFails(setDoc(ref(db,'entries/entry1'),entry('entry1',{status:'answered'})));await assertSucceeds(setDoc(ref(db,'entries/entry1'),entry('entry1',{status:'answered',answer:loc('Confirmed by owner')})));});
test('nested breakdowns cannot point at another requirement or another kind',async()=>{const db=context();await assertSucceeds(setDoc(ref(db,'entries/root'),entry('root',{kind:'breakdown',status:'todo'})));await assertFails(setDoc(ref(db,'entries/cross'),entry('cross',{kind:'breakdown',status:'todo',parentId:'root',requirementId:'FN-DIS-01'})));await assertFails(setDoc(ref(db,'entries/other'),entry('other',{kind:'assumption',status:'unvalidated',parentId:'root'})));await assertSucceeds(setDoc(ref(db,'entries/child'),entry('child',{kind:'breakdown',status:'todo',parentId:'root'})));await assertFails(updateDoc(ref(db,'entries/root'),{parentId:'child',version:2,updatedAt:serverTimestamp()}));await assertSucceeds(deleteDoc(ref(db,'entries/root')));await assertSucceeds(getDoc(ref(db,'entries/child')));});
test('assumptions support CRUD and reject invalid status',async()=>{const db=context();await assertFails(setDoc(ref(db,'entries/entry1'),entry('entry1',{kind:'assumption',status:'done'})));await assertSucceeds(setDoc(ref(db,'entries/entry1'),entry('entry1',{kind:'assumption',status:'unvalidated'})));await assertSucceeds(updateDoc(ref(db,'entries/entry1'),{status:'confirmed',version:2,updatedAt:serverTimestamp()}));await assertSucceeds(deleteDoc(ref(db,'entries/entry1')));});
test('CU and RD metadata are mandatory and estimates bounded',async()=>{const db=context();const r=ref(db,'reviews/FN-BKG-01');await assertFails(setDoc(r,review({compliance:'CU'})));await assertFails(setDoc(r,review({compliance:'RD'})));await assertFails(setDoc(r,review({cost:-1})));await assertFails(setDoc(r,review({effortHours:100001})));await assertSucceeds(setDoc(r,review({compliance:'CU',cost:1200,effortHours:20})));await assertFails(deleteDoc(r));});
test('activity is append-only and actor-bound',async()=>{const db=context();const r=ref(db,'activities/event1');await assertFails(setDoc(r,audit({actor:'someoneelse'})));await assertSucceeds(setDoc(r,audit()));await assertFails(updateDoc(r,{actorName:'Changed'}));await assertFails(deleteDoc(r));});
test('entry plus activity transaction succeeds atomically',async()=>{const db=context();await assertSucceeds(runTransaction(db,async tx=>{await tx.get(ref(db,'entries/entry1'));tx.set(ref(db,'entries/entry1'),entry());tx.set(ref(db,'activities/event1'),audit({after:entry()}));}));});
test('unrelated paths remain denied for members',async()=>{const db=context();await assertFails(getDoc(doc(db,'other/private')));await assertFails(setDoc(doc(db,'workspaces/other'),{name:'No'}));});

for (const verification of [true, false, 'absent']) test(`Microsoft SSO reads and CRUD succeed with email verification ${verification}`, async () => {
  const token = {...claims};
  if (verification === 'absent') delete token.email_verified; else token.email_verified = verification;
  const db = env.authenticatedContext('reviewer', token).firestore();
  await assertSucceeds(getDoc(doc(db, base)));
  await assertSucceeds(getDoc(ref(db, 'requirements/FN-BKG-01')));
  const r = ref(db, 'entries/direct-sso');
  await assertSucceeds(setDoc(r, entry('direct-sso')));
  await assertSucceeds(updateDoc(r, {title:loc('Direct SSO edit'),version:2,updatedAt:serverTimestamp()}));
  await assertSucceeds(deleteDoc(r));
  await assertFails(updateDoc(doc(db,base), {name:'Tampered'}));
});

test('review context is readable only by Microsoft members and immutable to clients',async()=>{const member=context(),anon=env.unauthenticatedContext().firestore();await assertSucceeds(getDoc(doc(member,'workspaces/weride/context/ai-review')));await assertFails(getDoc(doc(anon,'workspaces/weride/context/ai-review')));await assertFails(setDoc(doc(member,'workspaces/weride/context/ai-review'),{version:99}));});
for(const path of ['reviewShares/private-token-hash','reviewShareOwners/reviewer/links/private-link','reviewShareLimits/reviewer-2026-09-29'])test(`server-only review storage is closed: ${path}`,async()=>{for(const db of [context(),env.unauthenticatedContext().firestore()]){await assertFails(getDoc(doc(db,path)));await assertFails(setDoc(doc(db,path),{public:true}));}});

// The application session limit is separate from the one-hour Firebase ID-token lifetime.
for(const [label,time] of [
  ['expired',()=>Math.floor(Date.now()/1000)-86400],
  ['older than one day',()=>Math.floor(Date.now()/1000)-90000],
  ['future login',()=>Math.floor(Date.now()/1000)+600],
  ['null auth_time',()=>null],
  ['string auth_time',()=>String(Math.floor(Date.now()/1000))],
  ['zero auth_time',()=>0],
])test(`24-hour policy denies ${label} across private paths`,async()=>{
  const db=context('reviewer',{auth_time:time()});
  for(const path of ['', '/requirements/FN-BKG-01','/members/reviewer','/assignments/FN-BKG-01','/context/ai-review'])
    await assertFails(getDoc(doc(db,base+path)));
  await assertFails(setDoc(ref(db,'entries/entry1'),entry()));
});
test('23-hour Microsoft session can read and write without mailbox verification',async()=>{
  const db=context('reviewer',{auth_time:Math.floor(Date.now()/1000)-23*3600,email_verified:false});
  await assertSucceeds(getDoc(doc(db,base)));
  await assertSucceeds(setDoc(ref(db,'entries/entry1'),entry()));
});
