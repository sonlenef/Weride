import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='https://weride-discovery.web.app',checks=[];
const pass=message=>{checks.push(message);console.log('PASS:',message);};
const digest=buffer=>createHash('sha256').update(buffer).digest('hex');
const pageResponse=await fetch(base+'/client-questions');assert.equal(pageResponse.status,200);assert.equal(await pageResponse.text(),await readFile('dist/index.html','utf8'));
for(const asset of await readdir('dist/assets')){const r=await fetch(base+'/assets/'+asset);assert.equal(r.status,200);assert.equal(digest(Buffer.from(await r.arrayBuffer())),digest(await readFile('dist/assets/'+asset)));}
pass('Hosting and all production assets match the tested build.');
const status=await fetch(base+'/api/client-questionnaires/status');assert.equal(status.status,200);assert.equal((await status.json()).service,'weride-client-questionnaires');assert.match(status.headers.get('cache-control')||'',/no-store/);pass('Client questionnaire backend is available through Hosting with no-store headers.');
assert.equal((await fetch(base+'/api/client-questionnaires/mine')).status,401);
for(const collection of ['clientQuestionnaires','clientQuestionnaireOwners','clientQuestionnaireTokens','clientQuestionnaireRates','clientQuestionnaireLimits']){
  const r=await fetch(`https://firestore.googleapis.com/v1/projects/weride-discovery/databases/(default)/documents/${collection}/smoke-nonexistent`);assert.equal(r.status,403);
}
pass('Anonymous management requests and direct private Firestore access are rejected.');
const token='x'.repeat(43),headers={'Content-Type':'application/json','X-Client-Request':'weride-questionnaire-v1'};
const invalid=await fetch(base+`/api/client-questionnaires/public/${token}/open`,{method:'POST',headers,body:JSON.stringify({code:''})});assert.equal(invalid.status,404);assert(!JSON.stringify(await invalid.json()).includes('questions'));
const denied=await fetch(base+`/api/client-questionnaires/public/${token}/open`,{method:'POST',headers:{...headers,Origin:'https://untrusted.example'},body:JSON.stringify({code:''})});assert.equal(denied.status,403);
pass('Invalid client capabilities disclose no questionnaire content; cross-origin writes are rejected.');
const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/respond/'+token);await expectVisible(page.getByRole('heading',{name:/This link is unavailable/}));assert.equal(await page.getByRole('button',{name:'Continue with Microsoft',exact:true}).count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.goto(base+'/client-questions');await expectVisible(page.getByRole('button',{name:'Continue with Microsoft',exact:true}));assert.equal(await page.locator('.cq-builder').count(),0);assert.deepEqual(errors,[]);
  pass('Public client route works without Madison sign-in; staff management remains sign-in protected and has no runtime errors.');
}finally{await browser.close();}
async function expectVisible(locator){await locator.waitFor({state:'visible',timeout:30000});}
await writeFile('docs/CLIENT-QUESTIONNAIRES-LIVE-SMOKE.json',JSON.stringify({at:new Date().toISOString(),checks,productionTestRecordsCreated:0,limit:'Anonymous live smoke only. Full workflows tested with synthetic records on the local emulator.'},null,2));
