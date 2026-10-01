import {before,after,beforeEach,test} from 'node:test';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,deleteDoc,serverTimestamp,writeBatch} from 'firebase/firestore';
let env;const base='workspaces/weride';const loc=(en='')=>({en,vi:'',sv:''});
const context=(uid='asker')=>env.authenticatedContext(uid,{email:`${uid}@madison.dev`,email_verified:false,auth_time:Math.floor(Date.now()/1000),firebase:{sign_in_provider:'microsoft.com'}}).firestore();
const ref=(db,id)=>doc(db,`${base}/entries/${id}`);
const question=(id='q1',extra={})=>({id,requirementId:'FN-BKG-01',kind:'qa',parentId:'',title:loc('Who supplies the booking API?'),body:loc(),answer:loc(),acceptance:loc(),status:'open',priority:'medium',owner:'',estimateHours:null,version:1,origin:'team',createdBy:'asker',createdByName:'Asker',updatedBy:'asker',updatedByName:'Asker',createdAt:serverTimestamp(),updatedAt:serverTimestamp(),...extra});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-weride',firestore:{host:'127.0.0.1',port:8089,rules:readFileSync('firestore.rules','utf8')}});});
after(async()=>env?.cleanup());
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,base),{name:'WeRide'});await setDoc(doc(db,`${base}/requirements/FN-BKG-01`),{id:'FN-BKG-01'});await setDoc(ref(db,'q1'),question());await setDoc(ref(db,'seed'),question('seed',{origin:'proposal',createdBy:'seed',createdByName:'Madison'}));});});
test('all authenticated Madison members may read other questions and their asker',async()=>{await assertSucceeds(getDoc(ref(context('other'),'q1')));await assertSucceeds(getDoc(ref(context('other'),'seed')));});
test('asker can update their question, answer and delete without a verification email',async()=>{const db=context();await assertSucceeds(updateDoc(ref(db,'q1'),{title:loc('Updated question'),answer:loc('Recorded answer'),status:'answered',version:2,updatedAt:serverTimestamp()}));await assertSucceeds(deleteDoc(ref(db,'q1')));});
test('another member cannot edit or delete the question',async()=>{const db=context('other');await assertFails(updateDoc(ref(db,'q1'),{title:loc('Hijack'),version:2,updatedBy:'other',updatedByName:'Other',updatedAt:serverTimestamp()}));await assertFails(deleteDoc(ref(db,'q1')));});
test('another member cannot answer instead of editing',async()=>{const db=context('other');await assertFails(updateDoc(ref(db,'q1'),{answer:loc('Invented'),status:'answered',version:2,updatedBy:'other',updatedByName:'Other',updatedAt:serverTimestamp()}));});
test('PIC, owner text and display name do not transfer ownership',async()=>{await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),`${base}/assignments/FN-BKG-01`),{assigneeUid:'other'});await updateDoc(ref(c.firestore(),'q1'),{owner:'other',createdByName:'Other'});});await assertFails(deleteDoc(ref(context('other'),'q1')));});
test('creator UID, provenance and kind cannot be changed to circumvent restrictions',async()=>{for(const [uid,patch] of [['other',{kind:'breakdown',status:'todo'}],['other',{createdBy:'other'}],['asker',{createdBy:'other'}],['asker',{origin:'proposal'}]]){await assertFails(updateDoc(ref(context(uid),'q1'),{...patch,version:2,updatedBy:uid,updatedAt:serverTimestamp()}));}});
test('creation cannot impersonate another asker',async()=>{await assertFails(setDoc(ref(context('other'),'new'),question('new',{updatedBy:'other'})));await assertSucceeds(setDoc(ref(context('other'),'new'),question('new',{createdBy:'other',createdByName:'Other',updatedBy:'other'})));});
test('seeded proposals are preserved and remain read-only to ordinary members',async()=>{await assertFails(deleteDoc(ref(context(),'seed')));await assertFails(updateDoc(ref(context(),'seed'),{title:loc('Changed'),version:2,updatedBy:'asker',updatedAt:serverTimestamp()}));});
test('non-Q&A team ownership behavior is unchanged',async()=>{const db=context();await assertSucceeds(setDoc(ref(db,'b1'),question('b1',{kind:'breakdown',status:'todo'})));await assertSucceeds(updateDoc(ref(context('other'),'b1'),{title:loc('Shared edit'),version:2,updatedBy:'other',updatedAt:serverTimestamp()}));await assertSucceeds(deleteDoc(ref(context('other'),'b1')));});
test('unauthorized question delete fails atomically with attempted activity write',async()=>{const db=context('other'),batch=writeBatch(db);batch.delete(ref(db,'q1'));batch.set(doc(db,`${base}/activities/attack`),{id:'attack',action:'delete',requirementId:'FN-BKG-01',entryId:'q1',kind:'qa',title:loc('Q'),actor:'other',actorName:'Other',at:serverTimestamp(),before:null,after:null});await assertFails(batch.commit());await assertSucceeds(getDoc(ref(context(),'q1')));});

// Project-wide Q&A uses the existing entry schema with an empty requirementId.
test('general question creation and its activity are atomic and readable by the team',async()=>{
  const db=context(),batch=writeBatch(db),q=question('general',{requirementId:'',priority:'high'});
  batch.set(ref(db,'general'),q);
  batch.set(doc(db,`${base}/activities/general-created`),{id:'general-created',action:'create',requirementId:'',entryId:'general',kind:'qa',title:loc('General question'),actor:'asker',actorName:'Asker',at:serverTimestamp(),before:null,after:q});
  await assertSucceeds(batch.commit());await assertSucceeds(getDoc(ref(context('other'),'general')));
});
test('general question author can change priority, answer and remove it',async()=>{
  const db=context();await assertSucceeds(setDoc(ref(db,'general'),question('general',{requirementId:''})));
  await assertSucceeds(updateDoc(ref(db,'general'),{priority:'critical',answer:loc('Recorded answer'),status:'answered',version:2,updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref(db,'general'),{priority:'low',version:2,updatedAt:serverTimestamp()}));
  await assertSucceeds(deleteDoc(ref(db,'general')));
});
test('general question remains author-owned',async()=>{
  await assertSucceeds(setDoc(ref(context(),'general'),question('general',{requirementId:''})));
  await assertFails(updateDoc(ref(context('other'),'general'),{priority:'critical',version:2,updatedBy:'other',updatedAt:serverTimestamp()}));
  await assertFails(deleteDoc(ref(context('other'),'general')));
});
test('general scope is allowed for Q&A only',async()=>{
  for(const [kind,status] of [['breakdown','todo'],['assumption','unvalidated']])await assertFails(setDoc(ref(context(),'general'),question('general',{requirementId:'',kind,status})));
  for(const requirementId of [null,'UNKNOWN-REQUIREMENT',' '])await assertFails(setDoc(ref(context(),'general'),question('general',{requirementId})));
});
test('question author may move scope without changing identity',async()=>{
  await assertSucceeds(updateDoc(ref(context(),'q1'),{requirementId:'',version:2,updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref(context('other'),'q1'),{requirementId:'FN-BKG-01',version:3,updatedBy:'other',updatedAt:serverTimestamp()}));
  await assertSucceeds(setDoc(ref(context(),'general'),question('general',{requirementId:''})));
  await assertSucceeds(updateDoc(ref(context(),'general'),{requirementId:'FN-BKG-01',version:2,updatedAt:serverTimestamp()}));
});
test('general and linked questions require a valid priority',async()=>{
  const db=context();for(const scope of ['', 'FN-BKG-01']){
    for(const priority of ['low','medium','high','critical']){const id=`q-${scope||'general'}-${priority}`;await assertSucceeds(setDoc(ref(db,id),question(id,{requirementId:scope,priority})));}
    for(const priority of ['',null,'urgent',3])await assertFails(setDoc(ref(db,'bad-priority'),question('bad-priority',{requirementId:scope,priority})));
  }
});
test('general questions do not allow anonymous or foreign-provider access',async()=>{
  await assertSucceeds(setDoc(ref(context(),'general'),question('general',{requirementId:''})));
  const anonymous=env.unauthenticatedContext().firestore();await assertFails(getDoc(ref(anonymous,'general')));await assertFails(setDoc(ref(anonymous,'new'),question('new',{requirementId:''})));
  const other=env.authenticatedContext('asker',{email:'asker@madison.dev',auth_time:Math.floor(Date.now()/1000),firebase:{sign_in_provider:'google.com'}}).firestore();await assertFails(getDoc(ref(other,'general')));
});
