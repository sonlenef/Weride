// Live read-only endpoint checks with disposable SYNTHETIC data only.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {Firestore} from '@google-cloud/firestore';
// Match google-gax's auth-library major for its gRPC metadata contract.
import {OAuth2Client} from '../node_modules/google-gax/node_modules/google-auth-library/build/src/index.js';
import {chromium} from '@playwright/test';
import {FirestoreShareRepository,loadWorkspace} from '../lib/repository.js';
import {buildPack,defaultOptions,packMarkdown} from '../lib/pack.js';
const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1];
assert.equal(arg('--project'),'weride-discovery');assert(args.includes('--account'));
assert(!process.env.FIRESTORE_EMULATOR_HOST,'Never run this against an emulator');
const origin='https://weride-discovery.web.app',project='weride-discovery';
const client=new OAuth2Client({quotaProjectId:project});
client.setCredentials({access_token:execFileSync('gcloud',['auth','print-access-token','--account',arg('--account')],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(),expiry_date:Date.now()+3500000});
const db=new Firestore({projectId:project,authClient:client}),repository=new FirestoreShareRepository(db);
const uid='deployment-smoke-'+randomUUID(),cleanup=[],checks=[];let browser;
const pass=message=>{checks.push(message);console.log('PASS:',message);};
const request=(path,init={})=>fetch(origin+path,{...init,signal:AbortSignal.timeout(30000)});
const hash=token=>createHash('sha256').update(token).digest('hex');
const loc=en=>({en,vi:'',sv:''});
const synthetic={project:{id:'weride',name:'Synthetic deployment test',client:'Synthetic fixture',reference:'DEPLOYMENT-SMOKE-ONLY',sourceFile:'synthetic-test.txt',summary:loc('No project, customer or employee data.'),fleetReference:1,fleetReferencePage:1,milestones:[],clarifications:[]},requirements:[{id:'TEST-ONLY-01',module:'A',tier:'L1',title:loc('Synthetic requirement'),description:loc('Validate the sharing endpoint without disclosing actual workspace content.'),sourcePage:1,sourceSection:'Synthetic fixture',order:1}],entries:[],reviews:[]};
try{
  const status=await request('/api/review-packs/status');assert.equal(status.status,200);
  assert.deepEqual(await status.json(),{service:'weride-review-sharing',version:1,available:true});
  pass('Hosting rewrite reaches the live sharing function.');
  for(const [path,method] of [['shares','GET'],['shares','POST'],['shares/'+randomUUID()+'/revoke','POST']]){
    const r=await request('/api/review-packs/'+path,{method});assert.equal(r.status,401);
  }
  const bad=await request('/api/review-packs/shares',{headers:{Authorization:'Bearer invalid-synthetic-token-only'}});assert.equal(bad.status,401);
  const foreign=await request('/api/review-packs/shares',{headers:{Origin:'https://unrelated.example'}});assert.equal(foreign.status,403);
  pass('Management endpoints reject missing/invalid tokens and foreign origins.');
  const data=await loadWorkspace(db);assert(data.requirements.length>0);assert(data.reviewContext);
  const actualPack=await buildPack(data,defaultOptions({kind:'requirement',id:'FN-BKG-01'}));
  assert.equal(actualPack.content.coverage.targetIds[0],'FN-BKG-01');
  pass('Read-only production capture and pack generation work; no real source was published.');
  browser=await chromium.launch();
  for(const language of ['en','vi','sv']){
    const pack=await buildPack(synthetic,{...defaultOptions(),language});const id=randomUUID();
    const row=await repository.create(uid,id,pack,1),h=hash(row.token),path='/s/'+row.token;
    cleanup.push('reviewShares/'+h,'reviewShareOwners/'+uid+'/links/'+id,'reviewShareLimits/'+uid+'-'+row.createdAt.slice(0,10));
    const res=await request(path),html=await res.text();assert.equal(res.status,200);
    assert.match(res.headers.get('content-type'),/text\/html/);assert.match(res.headers.get('cache-control'),/no-store/);
    assert.match(res.headers.get('x-robots-tag'),/noindex/);assert.equal(res.headers.get('referrer-policy'),'no-referrer');
    assert(html.includes('Synthetic requirement'));assert(html.includes(pack.snapshotId));assert(!html.includes('<script'));
    const raw=await request(path+'/context.md');assert.equal(raw.status,200);assert.equal(await raw.text(),packMarkdown(pack));
    const byAccept=await request(path,{headers:{Accept:'text/markdown'}});assert.equal(await byAccept.text(),packMarkdown(pack));
    const dl=await request(path+'/context.md?download=1');assert.match(dl.headers.get('content-disposition'),/attachment/);
    const head=await request(path,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
    assert.equal((await request(path,{method:'POST'})).status,405);
    const ctx=await browser.newContext({javaScriptEnabled:false,viewport:{width:1200,height:900}}),page=await ctx.newPage();
    await page.goto(origin+path);assert.equal(await page.locator('html').getAttribute('lang'),language);
    assert((await page.locator('article').innerText()).includes('END OF WERIDE REVIEW PACK'));
    if(language==='en'){await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/live-sharing-no-js.png',fullPage:true});}
    await ctx.close();pass(language+': live HTML/Markdown agree; content readable without JavaScript; no caching.');
    if(language==='sv'){
      await db.doc('reviewShares/'+h).update({expiresAt:new Date(Date.now()-10000).toISOString()});
      const expired=await request(path);assert.equal(expired.status,410);assert(!(await expired.text()).includes('Synthetic requirement'));
      pass('Expired live snapshot is immediately unavailable.');
    }
    await repository.revoke(uid,id);
    for(const suffix of ['','/context.md']){const revoked=await request(path+suffix);assert.equal(revoked.status,410);assert(!(await revoked.text()).includes('Synthetic requirement'));}
    const stored=await repository.get(row.token);assert.equal(stored.pack,undefined);
    pass(language+': revoked snapshot unavailable through HTML and Markdown; shared content removed.');
  }
  for(const path of ['/s/FN-BKG-01','/s/'+'a'.repeat(43)])assert.equal((await request(path)).status,404);
  pass('Invalid/unknown share paths expose no source.');
  await mkdir('docs',{recursive:true});
  await writeFile('docs/SHARING-LIVE-CHECKS.json',JSON.stringify({at:new Date().toISOString(),project,checks,method:'Synthetic snapshots inserted/revoked administratively. Real Microsoft-authenticated API creation was not exercised by this script. No employee session or actual source was published.'},null,2)+'\n');
}finally{
  await browser?.close();
  if(cleanup.length){const batch=db.batch();for(const path of new Set(cleanup))batch.delete(db.doc(path));await batch.commit();console.log('CLEANUP: Only this run’s synthetic shares, owner records and quota record removed.');}
  await db.terminate();
}
