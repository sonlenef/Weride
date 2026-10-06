import {before,after,beforeEach,test} from 'node:test';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,deleteDoc,serverTimestamp,writeBatch} from 'firebase/firestore';
let env;const base='workspaces/weride',loc=(en='')=>({en,vi:'',sv:''});
const context=(uid='alice',extra={})=>env.authenticatedContext(uid,{email:`${uid}@madison.dev`,email_verified:false,auth_time:Math.floor(Date.now()/1000),firebase:{sign_in_provider:'microsoft.com'},...extra}).firestore();
const ref=(db,type,id)=>doc(db,base,type,id);
const item=(extra={})=>({id:'m-booking',kind:'module',parentId:'',name:loc('Booking Management'),description:loc(),originalLocale:'en',status:'derived',group:'core',channel:loc(),actors:['a-driver'],indirect:[],order:0,version:1,createdBy:'alice',createdByName:'Alice',createdAt:serverTimestamp(),updatedBy:'alice',updatedByName:'Alice',updatedAt:serverTimestamp(),...extra});
const audit=(id,extra={})=>({id,action:'create',requirementId:'',entryId:'m-booking',kind:'product',title:loc('Booking Management'),actor:'alice',actorName:'Alice',at:serverTimestamp(),before:null,after:null,...extra});
const edit=(extra={})=>({name:loc('Bookings'),version:2,updatedBy:'bob',updatedByName:'Bob',updatedAt:serverTimestamp(),...extra});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-weride',firestore:{host:'127.0.0.1',port:8089,rules:readFileSync('firestore.rules','utf8')}});});
after(async()=>env?.cleanup());
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),base),{name:'WeRide'}));});
test('member creates an item stamped with their own identity, together with a product activity',async()=>{
  const db=context(),batch=writeBatch(db);batch.set(ref(db,'productItems','m-booking'),item());batch.set(ref(db,'activities','e1'),audit('e1'));await assertSucceeds(batch.commit());
});
test('creation cannot spoof the author, skip the English name or invent a kind/group mix',async()=>{
  for(const extra of [{createdBy:'bob'},{name:loc('')},{kind:'sub'},{group:''},{status:'final'},{version:2},{extra:'x'}])await assertFails(setDoc(ref(context(),'productItems','m-booking'),item(extra)));
  await assertFails(setDoc(ref(context(),'activities','e2'),audit('e2',{requirementId:'FN-BKG-01'})));
});
test('any member edits with the next version and is recorded as the editor; created fields stay fixed',async()=>{
  await setDoc(ref(context(),'productItems','m-booking'),item());const bob=context('bob');
  await assertFails(updateDoc(ref(bob,'productItems','m-booking'),edit({version:3})));
  await assertFails(updateDoc(ref(bob,'productItems','m-booking'),edit({updatedBy:'alice'})));
  await assertFails(updateDoc(ref(bob,'productItems','m-booking'),edit({createdBy:'bob'})));
  await assertFails(updateDoc(ref(bob,'productItems','m-booking'),edit({kind:'actor',group:''})));
  await assertSucceeds(updateDoc(ref(bob,'productItems','m-booking'),edit()));
});
test('a second baseline import cannot overwrite existing items',async()=>{
  await setDoc(ref(context(),'productItems','m-booking'),item());
  await assertFails(setDoc(ref(context('bob'),'productItems','m-booking'),item({createdBy:'bob',createdByName:'Bob',updatedBy:'bob',updatedByName:'Bob'})));
});
test('members delete; outsiders cannot read or write',async()=>{
  await setDoc(ref(context(),'productItems','m-booking'),item());
  await assertFails(deleteDoc(ref(context('eve',{firebase:{sign_in_provider:'google.com'}}),'productItems','m-booking')));
  await assertSucceeds(deleteDoc(ref(context('bob'),'productItems','m-booking')));
});
