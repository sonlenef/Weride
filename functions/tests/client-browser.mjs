import {chromium,expect} from '@playwright/test';
import {fixture,sample} from './client-fixture.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const f=await fixture();await f.reset();
const root='http://127.0.0.1:5173',dir='.backups/client-questionnaire-browser';await mkdir(dir,{recursive:true});
const results=[],scans=[],errors=[];let cloudRequests=0;
const pass=message=>{results.push(message);console.log('PASS:',message);};
const browser=await chromium.launch({headless:true});
async function context(){
  const c=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
  await c.route('https://**/*',route=>{cloudRequests++;return route.abort();});
  await c.route('**/api/client-questionnaires/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname+new URL(req.url()).search;
    const r=await fetch(f.origin+path,{method:req.method(),headers:{'Content-Type':'application/json','X-Client-Request':'weride-questionnaire-v1',Origin:root},body:req.postData()||undefined});
    await route.fulfill({status:r.status,contentType:'application/json',body:await r.text()});
  });
  c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));return c;
}
async function scan(p,name){
  await p.screenshot({path:`${dir}/${name}.png`,animations:'disabled'});
  await p.addScriptTag({path:'.backups/uiux-audit-20260929/tools/package/axe.min.js'});
  const r=await p.evaluate(async()=>({overflow:document.documentElement.scrollWidth>innerWidth,result:await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})}));
  const item={name,overflow:r.overflow,violations:r.result.violations.map(v=>({id:v.id,count:v.nodes.length,nodes:v.nodes.slice(0,5).map(n=>({target:n.target,summary:n.failureSummary}))}))};scans.push(item);console.log('SCAN',name,JSON.stringify(item));
}
try{
  const pub=await f.publish(),c=await context(),p=await c.newPage();assert.equal(pub.status,201);
  await p.goto(`${root}/respond/${pub.token}`);await expect(p.getByLabel('Access code',{exact:true})).toBeVisible();
  await expect(p.getByText('Which booking channel comes first?',{exact:true})).toHaveCount(0);
  await p.getByLabel('Access code',{exact:true}).fill(pub.code);await p.getByRole('button',{name:'Open questionnaire',exact:true}).click();
  await expect(p.getByLabel('Your full name',{exact:true})).toBeVisible();await scan(p,'client-identity-en');
  await p.getByLabel('Your full name',{exact:true}).fill('Synthetic client reviewer');await p.getByLabel('Your work email',{exact:true}).fill('reviewer@example.test');
  await p.getByRole('checkbox').check();await p.getByRole('button',{name:'Start my response',exact:true}).click();
  await expect(p.locator('.client-answer-card h2')).toHaveText('Which booking channel comes first?');
  pass('Client code gate and consent create a private respondent session without Microsoft sign-in.');
  const preferenceSaved=p.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/save')&&r.status()===200);
  await p.locator('.client-answer-card select').nth(1).selectOption('sv');await expect(p.locator('.client-answer-card select').nth(1)).toHaveValue('sv');await preferenceSaved;
  await p.reload();await expect(p.locator('.client-answer-card select').nth(1)).toHaveValue('sv');await p.locator('.client-answer-card select').nth(1).selectOption('en');
  pass('A response language can be chosen before typing and survives a draft reload.');
  const textarea=p.locator('.client-answer-card textarea');await textarea.fill('Dispatch console is first, pending sponsor confirmation.');
  await expect(p.locator('.client-save-bar')).toContainText('Draft saved to server',{timeout:10000});
  const stored=await p.evaluate(token=>JSON.parse(sessionStorage.getItem('weride.client-response.v1:'+token)),pub.token);
  assert(stored.key&&stored.revision>0);await p.reload();await expect(textarea).toHaveValue('Dispatch console is first, pending sponsor confirmation.');
  pass('Auto-save and page reload preserve draft answers.');
  const second=await context(),p2=await second.newPage();await p2.goto(`${root}/respond/${pub.token}#resume=${stored.key}`);
  await expect(p2.locator('.client-answer-card textarea')).toHaveValue('Dispatch console is first, pending sponsor confirmation.');
  assert(!p2.url().includes('#resume='));pass('Private resume link restores the draft in a separate browser context and removes the secret from the visible URL.');
  await textarea.fill('First reviewer updated the response.');await expect(p.locator('.client-save-bar')).toContainText('Draft saved to server',{timeout:10000});
  await p2.locator('.client-answer-card textarea').fill('Concurrent stale response must not overwrite.');await expect(p2.locator('.client-error')).toContainText('newer draft',{timeout:10000});
  await expect(textarea).toHaveValue('First reviewer updated the response.');pass('Concurrent editing raises a version conflict and preserves local text instead of overwriting.');
  await second.close();
  for(const lang of ['en','vi','sv']){
    await p.getByLabel('Language',{exact:true}).selectOption(lang);
    for(const width of [1440,390,320]){await p.setViewportSize({width,height:width===1440?1050:844});await scan(p,`client-answer-${lang}-${width}`);}
  }
  await p.getByLabel('Language',{exact:true}).selectOption('en');await p.setViewportSize({width:1440,height:1050});
  await p.getByRole('button',{name:'Review & submit',exact:true}).click();await expect(p.getByRole('dialog')).toContainText('1 not answered');await scan(p,'client-submit-review');
  await p.getByRole('dialog').getByRole('button',{name:'Submit responses',exact:true}).click();await expect(p.locator('.client-receipt')).toBeVisible();
  await expect(textarea).toBeDisabled();pass('Partial submission displays a receipt and locks submitted content without importing it to Q&A.');
  await scan(p,'client-receipt');
  assert.equal((await f.db.collection('workspaces/weride/replies').get()).size,0);
  await f.call(`/mine/${pub.body.id}/state`,{state:'revoked',version:1});await p.reload();await expect(p.getByRole('heading',{name:/This link is unavailable/})).toBeVisible();
  pass('Revoking a publication blocks an existing client resume session.');
  await c.close();
  assert.equal(cloudRequests,0,'Public client portal must not contact Firebase Auth or other cloud services in this local test.');
  const staff=await context();await staff.route('**/__dev/seed',route=>route.fulfill({json:sample}));const owner=await staff.newPage();
  await owner.goto(root+'/client-questions?preview=1&ids=q1,q2');await expect(owner.locator('.cq-builder')).toBeVisible();
  await owner.getByRole('button',{name:/^3 · Preview exactly/}).click();await expect(owner.locator('.cq-snapshot')).toContainText('Which booking channel comes first?');
  assert(!(await owner.locator('.cq-snapshot').innerText()).includes('PRIVATE'));await expect(owner.getByRole('button',{name:'Publish questionnaire',exact:true})).toBeDisabled();
  pass('Staff preview shows the exact selected scope, excludes internal answers/details by default and does not publish synthetic data.');
  for(const lang of ['en','vi','sv']){
    await owner.locator('.locale-switch select').selectOption(lang);
    for(const width of [1440,390,320]){await owner.setViewportSize({width,height:width===1440?1050:844});await scan(owner,`staff-builder-${lang}-${width}`);}
  }
  await staff.close();assert.deepEqual(errors,[]);
}finally{
  await writeFile(dir+'/report.json',JSON.stringify({results,scans,errors,cloudRequests},null,2));
  await browser.close();await f.close();
}
assert(scans.every(s=>!s.overflow),'Unexpected horizontal page overflow');
assert(scans.every(s=>!s.violations.length),'Accessibility scan requires remediation');
console.log('ALL CLIENT BROWSER CHECKS PASSED',results.length,'flows',scans.length,'scans');
