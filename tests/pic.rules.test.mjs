import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore';
let env;const base='workspaces/weride';
const claims={auth_time:Math.floor(Date.now()/1000),email:'reviewer@madison.dev',email_verified:false,firebase:{sign_in_provider:'microsoft.com'}};
const context=(uid='reviewer',extra={})=>env.authenticatedContext(uid,{...claims,...extra}).firestore();
const ref=(db,path)=>doc(db,`${base}/${path}`);
const person=(uid,extra={})=>({uid,email:`${uid}@madison.dev`,displayName:uid,provider:'microsoft.com',active:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),...extra});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-weride',firestore:{host:'127.0.0.1',port:8089,rules:readFileSync('firestore.rules','utf8')}});});
after(async()=>env?.cleanup());
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,base),{name:'WeRide'});await setDoc(ref(db,'requirements/FN-BKG-01'),{id:'FN-BKG-01'});for(const uid of ['reviewer','teammate'])await setDoc(ref(db,`members/${uid}`),person(uid));await setDoc(ref(db,'members/inactive'),person('inactive',{active:false}));await setDoc(ref(db,'members/foreign'),person('foreign',{email:'member@outside.dev'}));await setDoc(ref(db,'members/otherprovider'),person('otherprovider',{provider:'google.com'}));});});
async function assign(db,uid='teammate',version=0,extra={},auditExtra={}){
  const id='FN-BKG-01',activityId=randomUUID(),target=ref(db,`assignments/${id}`);
  return runTransaction(db,async tx=>{
    const snap=await tx.get(target);
    const after={id,assigneeUid:uid,version:version+1,updatedBy:'reviewer',updatedByName:'Reviewer',updatedAt:serverTimestamp(),activityId,...extra};
    tx.set(target,after);
    tx.set(ref(db,`activities/${activityId}`),{id:activityId,action:uid?'assign':'unassign',requirementId:id,entryId:id,kind:'assignment',title:{en:'PIC change',vi:'',sv:''},actor:'reviewer',actorName:'Reviewer',at:serverTimestamp(),before:snap.exists()?snap.data():null,after,...auditExtra});
  });
}
test('a real signed identity can register only its own matching Microsoft profile',async()=>{
  const db=context('new-member',{email:'new-member@madison.dev'});await assertSucceeds(setDoc(ref(db,'members/new-member'),person('new-member')));
  await assertFails(setDoc(ref(db,'members/impersonated'),person('impersonated')));
  await assertFails(updateDoc(ref(db,'members/new-member'),{email:'another@madison.dev',updatedAt:serverTimestamp()}));
});
test('members may refresh their own display name but cannot grant roles, disable others or reactivate accounts',async()=>{
  const db=context();await assertSucceeds(updateDoc(ref(db,'members/reviewer'),{displayName:'Reviewer Updated',updatedAt:serverTimestamp()}));
  for(const extra of [{active:false},{admin:true},{provider:'google.com'},{uid:'teammate'}])await assertFails(updateDoc(ref(db,'members/reviewer'),{...extra,updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref(db,'members/teammate'),{displayName:'Spoofed',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref(context('inactive',{email:'inactive@madison.dev'}),'members/inactive'),{active:true,updatedAt:serverTimestamp()}));
  await assertFails(deleteDoc(ref(db,'members/reviewer')));
});
for(const [label,dbFactory] of [['anonymous',()=>env.unauthenticatedContext().firestore()],['wrong domain',()=>context('reviewer',{email:'reviewer@outside.dev'})],['wrong provider',()=>context('reviewer',{firebase:{sign_in_provider:'password'}})]])test(`${label} cannot read the directory or assignments`,async()=>{const db=dbFactory();await assertFails(getDoc(ref(db,'members/reviewer')));await assertFails(getDoc(ref(db,'assignments/FN-BKG-01')));});
test('PIC assignment, reassign and unassign are versioned and preserve the source',async()=>{
  const db=context();await assertSucceeds(assign(db));await assertSucceeds(assign(db,'reviewer',1));await assertSucceeds(assign(db,'',2));
  const result=await getDoc(ref(db,'assignments/FN-BKG-01'));assert.equal(result.data().assigneeUid,'');assert.equal(result.data().version,3);
  const original=await getDoc(ref(db,'requirements/FN-BKG-01'));assert.deepEqual(original.data(),{id:'FN-BKG-01'});
});
for(const uid of ['missing','inactive','foreign','otherprovider'])test(`rejects ineligible assignee ${uid}`,async()=>{await assertFails(assign(context(),uid));});
test('cannot write an assignment without its atomic history event',async()=>{
  const db=context();await assertFails(setDoc(ref(db,'assignments/FN-BKG-01'),{id:'FN-BKG-01',assigneeUid:'teammate',version:1,updatedBy:'reviewer',updatedByName:'Reviewer',updatedAt:serverTimestamp(),activityId:randomUUID()}));
});
test('stale versions, forged actors, invented fields and source IDs are rejected',async()=>{
  const db=context();await assertSucceeds(assign(db));await assertFails(assign(db,'reviewer',0));
  for(const extra of [{updatedBy:'teammate'},{role:'admin'},{id:'NOT-A-REQUIREMENT'},{version:8}])await assertFails(assign(db,'reviewer',1,extra));
  await assertFails(deleteDoc(ref(db,'assignments/FN-BKG-01')));
  await assertFails(updateDoc(ref(db,'requirements/FN-BKG-01'),{assigneeUid:'reviewer'}));
});
test('audit snapshots and actions must reflect the actual assignment change',async()=>{
  const db=context();await assertFails(assign(db,'teammate',0,{}, {actor:'teammate'}));await assertFails(assign(db,'teammate',0,{}, {action:'unassign'}));await assertFails(assign(db,'teammate',0,{}, {before:{fabricated:true}}));
  await assertSucceeds(assign(db));await assertFails(assign(db,'reviewer',1,{}, {before:null}));
});
