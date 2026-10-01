import {Firestore} from 'firebase-admin/firestore';
import express from 'express';
import {createQuestionnaireApp} from '../lib/questionnaire-api.js';
import {QuestionnaireRepository} from '../lib/questionnaire-repository.js';
import {makeSnapshot} from '../lib/questionnaire-model.js';
import {canonical,sha256} from '../lib/pack.js';
import {randomUUID,randomBytes} from 'node:crypto';
export const TOKEN='synthetic-emulator-bearer-not-a-real-credential';
export const loc=en=>({en,vi:'',sv:''});
export const sample={schemaVersion:1,project:{id:'weride',name:'WeRide test workspace',client:'Synthetic client',reference:'TEST-ONLY',sourceFile:'test-only',summary:loc('NOT FOR PUBLIC'),fleetReference:0,fleetReferencePage:0,milestones:[],clarifications:[]},
  requirements:[{id:'FN-TEST-01',module:'A',tier:'L1',order:1,title:loc('Synthetic requirement'),description:loc('Synthetic source excerpt.'),sourcePage:6,sourceSection:'Test section'}],
  entries:['q1','q2'].map((id,i)=>({id,kind:'qa',requirementId:i?'':'FN-TEST-01',parentId:'',title:{en:i?'Who is the project contact?':'Which booking channel comes first?',vi:i?'Ai là đầu mối dự án?':'Kênh đặt xe nào triển khai trước?',sv:i?'Vem är projektkontakt?':'Vilken bokningskanal kommer först?'},body:loc('PRIVATE DETAIL'),answer:loc('PRIVATE ANSWER'),acceptance:loc('PRIVATE ACCEPTANCE'),priority:i?'high':'medium',status:'open',originalLocale:'en',owner:'PRIVATE OWNER',estimateHours:123,version:1,origin:'team',createdBy:'alice',createdByName:'Alice',updatedBy:'alice',updatedByName:'Alice'})),
  reviews:[],activities:[],assignments:[],members:[],replies:[],resolutions:[],decisions:[],trash:[]};
export async function fixture(){
  const host=process.env.FIRESTORE_EMULATOR_HOST;
  if(!host||!/^127\.0\.0\.1:\d+$/.test(host))throw Error('Loopback Firestore emulator is required; cloud writes forbidden.');
  const db=new Firestore({projectId:'demo-weride'}),clock={value:Date.now()};
  const repo=new QuestionnaireRepository(db,'https://client.example',()=>clock.value);
  const app=express();app.use('/api/client-questionnaires',createQuestionnaireApp({repository:repo,now:()=>clock.value,allowedOrigins:['http://127.0.0.1:5173','https://client.example'],verifyToken:async token=>{
    if(![TOKEN,'bob-'+TOKEN,'wrong-'+TOKEN,'old-'+TOKEN].includes(token))throw Error('invalid');
    return {uid:token.startsWith('bob-')?'bob':'alice',name:'Test reviewer',email:'alice@madison.dev',auth_time:Math.floor(clock.value/1000)-(token.startsWith('old-')?90000:0),firebase:{sign_in_provider:token.startsWith('wrong-')?'google.com':'microsoft.com'}};
  }}));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const origin=`http://127.0.0.1:${server.address().port}`;
  const call=async(path,body,auth=TOKEN,extra={})=>{const r=await fetch(origin+'/api/client-questionnaires'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Client-Request':'weride-questionnaire-v1',...(auth?{Authorization:'Bearer '+auth}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json(),headers:r.headers};};
  const reset=async()=>{clock.value=Math.max(Date.now(),clock.value+61000);await fetch(`http://${host}/emulator/v1/projects/demo-weride/databases/(default)/documents`,{method:'DELETE'});await db.doc('workspaces/weride').set(sample.project);for(const r of sample.requirements)await db.doc('workspaces/weride/requirements/'+r.id).set(r);for(const q of sample.entries)await db.doc('workspaces/weride/entries/'+q.id).set(q);};
  const publish=async(patch={},code='test-code-123456')=>{const options={title:'Client discovery',introduction:'Please clarify these synthetic questions.',language:'en',questionIds:['q1','q2'],includeDetails:false,includeBaseline:true,ttlDays:14,dueDate:'',...patch};const body={options,requestId:randomUUID(),expectedSourceHash:await sha256(canonical(makeSnapshot(sample,options))),code,acknowledge:true};const result=await call('/mine',body);return {...result,input:body,token:result.body.url?.split('/').at(-1),code};};
  const key=()=>randomBytes(32).toString('base64url');
  const close=async()=>{await new Promise(resolve=>server.close(resolve));await db.terminate();};return {db,repo,clock,origin,call,reset,publish,key,close};
}
