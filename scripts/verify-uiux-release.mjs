import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Client} from '/opt/homebrew/lib/node_modules/firebase-tools/lib/apiv2.js';
import {maintenanceApi,listDocuments,WORKSPACE,digest} from './maintenance-firestore.mjs';
const api=await maintenanceApi();
const rulesApi=new Client({auth:true,apiVersion:'v1',urlPrefix:'https://firebaserules.googleapis.com'});
const release=(await rulesApi.get('projects/weride-discovery/releases/cloud.firestore')).body;
const rules=(await rulesApi.get(release.rulesetName)).body;
const deployed=rules.source.files.find(f=>f.name==='firestore.rules').content;
assert.equal(deployed,await readFile('firestore.rules','utf8'));
const backupPath=(await readFile('.backups/uiux-data-current.txt','utf8')).trim();
const backup=JSON.parse(await readFile(backupPath+'/workspace.raw.json','utf8'));
const stable=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(stable):Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,stable(x)])):v;
let baselineUnchanged=0;
const current=await listDocuments(api,WORKSPACE+'/requirements');
for(const d of current){const old=backup.documents.find(x=>x.name===d.name);assert(old);assert.deepEqual(stable(d.fields),stable(old.fields));baselineUnchanged++;}
assert.equal(baselineUnchanged,30);
const entries=await listDocuments(api,WORKSPACE+'/entries');
const retiredRemaining=entries.filter(e=>e.fields.kind?.stringValue==='qa'&&e.fields.origin?.stringValue==='proposal'&&e.fields.createdBy?.stringValue==='seed').length;
assert.equal(retiredRemaining,0);
for(const collection of ['entries','replies','resolutions','decisions','trash']){
  const response=await fetch(`https://firestore.googleapis.com/v1/${WORKSPACE}/${collection}`);
  assert.equal(response.status,403);
}
const management=await fetch('https://weride-discovery.web.app/api/review-packs/shares');assert.equal(management.status,401);
const report={verifiedAt:new Date().toISOString(),deployedRulesMatch:true,rulesSha256:digest(deployed),sourceRequirementsUnchanged:baselineUnchanged,retiredSeedQuestions:retiredRemaining,anonymousCollaborationRead:'403',anonymousShareManagement:'401',testDataWritten:false};
await writeFile('docs/UIUX-LIVE-VERIFICATION.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
