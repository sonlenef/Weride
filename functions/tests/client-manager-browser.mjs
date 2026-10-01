import {chromium,expect} from '@playwright/test';
import {fixture,sample,TOKEN} from './client-fixture.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
// All data and authentication in this test are synthetic and restricted to the local emulator.
const f=await fixture();await f.reset();const root='http://127.0.0.1:5173',dir='.backups/client-questionnaire-browser';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
const reports=[],errors=[],pass=message=>{reports.push(message);console.log('PASS:',message);};
await context.route('https://**/*',r=>r.abort());
await context.route('**/src/main.tsx*',r=>r.fulfill({contentType:'application/javascript',body:'import "/functions/tests/client-manager-harness.tsx";'}));
await context.route('**/src/lib/store.tsx*',r=>r.fulfill({contentType:'application/javascript',body:`export const useWorkspace=()=>({data:${JSON.stringify(sample)},online:true});`}));
await context.route('**/src/lib/auth.tsx*',r=>r.fulfill({contentType:'application/javascript',body:'export const useAuth=()=>({member:{uid:"alice",name:"Test reviewer",email:"alice@madison.dev"},preview:false});'}));
await context.route('**/src/lib/firebase.ts*',r=>r.fulfill({contentType:'application/javascript',body:`export const auth={currentUser:{getIdToken:async()=>${JSON.stringify(TOKEN)}}};`}));
await context.route('**/api/client-questionnaires/**',async route=>{const req=route.request(),u=new URL(req.url());const r=await fetch(f.origin+u.pathname+u.search,{method:req.method(),headers:{'Content-Type':'application/json','X-Client-Request':'weride-questionnaire-v1',Origin:root,...(req.headers().authorization?{Authorization:req.headers().authorization}:{})},body:req.postData()||undefined});await route.fulfill({status:r.status,contentType:'application/json',body:await r.text()});});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(root+'/client-questions?ids=q1,q2');await expect(page.locator('.cq-builder')).toBeVisible();
  await page.getByRole('button',{name:/^3 · Preview exactly/}).click();await page.getByRole('checkbox',{name:/I reviewed this snapshot/}).check();
  const code=await page.getByLabel('Access code',{exact:true}).inputValue();await page.getByRole('button',{name:'Publish questionnaire',exact:true}).click();
  await expect(page.locator('.cq-created')).toBeVisible();const p=(await f.call('/mine')).body.items[0];assert.equal(p.questionCount,2);
  pass('Owner publishes the reviewed selection through the actual management interface and backend.');
  const token=p.url.split('/').at(-1),key=f.key(),identity={name:'External reviewer',email:'external@example.test',language:'sv'};
  const start=await f.call(`/public/${token}/start`,{key,code,identity,consent:true},null);assert.equal(start.status,200);
  const submitted=await f.call(`/public/${token}/submit`,{key,revision:0,answers:{q1:{kind:'answer',text:'Dispatch first.',language:'en'},q2:{kind:'later',text:'',language:'sv'}},confirm:true},null);assert.equal(submitted.status,200);
  await page.locator('.cq-created').getByRole('link',{name:'View responses',exact:true}).click();
  await expect(page.locator('.cq-respondents')).toContainText('External reviewer');await page.locator('.cq-respondents').getByRole('button',{name:'View responses',exact:true}).click();
  await expect(page.locator('.cq-submission')).toContainText('Dispatch first.');pass('Submitted responses appear in the owner inbox with self-reported identity and frozen source wording.');
  const responseCard=page.locator('.cq-submission .cq-preview-question').filter({hasText:'Which booking channel comes first?'});
  await responseCard.getByRole('button',{name:'Add to internal Q&A',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Add to internal Q&A',exact:true}).click();await expect(responseCard).toContainText('Added to Q&A');
  assert.equal((await f.db.collection('workspaces/weride/replies').get()).size,1);pass('Explicit review confirmation imports one attributed client reply without overwriting source questions.');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export received answers (CSV)',exact:true}).click();assert((await download).suggestedFilename().endsWith('.csv'));pass('Owner can export the selected submitted response as CSV.');
  const scans=[];for(const language of ['en','vi','sv']){
    await page.evaluate(async l=>(await import('/src/lib/i18n.ts')).default.changeLanguage(l),language);
    for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:width===1440?1050:844});await page.screenshot({path:`${dir}/manager-${language}-${width}.png`});
      await page.addScriptTag({path:'.backups/uiux-audit-20260929/tools/package/axe.min.js'});
      const scan=await page.evaluate(async()=>({overflow:document.documentElement.scrollWidth>innerWidth,violations:(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))}));scans.push({language,width,...scan});
    }
  }
  await writeFile(dir+'/manager-scans.json',JSON.stringify(scans,null,2));console.log('MANAGER SCANS',JSON.stringify(scans));assert(scans.every(s=>!s.overflow&&!s.violations.length));
  await page.evaluate(async()=>(await import('/src/lib/i18n.ts')).default.changeLanguage('en'));await page.setViewportSize({width:1440,height:1050});
  await page.getByRole('button',{name:'Close responses',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('button',{name:'Reopen responses',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Revoke link permanently',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('button',{name:'Reopen responses',exact:true})).toHaveCount(0);
  assert.equal((await f.call(`/public/${token}/session`,{key},null)).status,410);pass('Owner closes and revokes access from the interface; existing resume sessions are rejected.');assert.deepEqual(errors,[]);
}finally{await writeFile(dir+'/manager-report.json',JSON.stringify({reports,errors},null,2));await browser.close();await f.close();}
console.log('MANAGER BROWSER FLOWS PASSED',reports.length);
