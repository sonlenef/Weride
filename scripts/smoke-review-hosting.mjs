import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base='https://weride-discovery.web.app';
const report=[];const pass=s=>{report.push(`PASS: ${s}`);console.log(report.at(-1));};
const html=await fetch(`${base}/review-packs`);assert.equal(html.status,200);
assert.match(html.headers.get('cache-control')||'',/no-cache/);
assert.equal(await html.text(),await readFile('dist/index.html','utf8'));
for(const name of await readdir('dist/assets')){
 const response=await fetch(`${base}/assets/${name}`);assert.equal(response.status,200);
 const digest=b=>createHash('sha256').update(b).digest('hex');
 assert.equal(digest(Buffer.from(await response.arrayBuffer())),digest(await readFile(`dist/assets/${name}`)));
}
pass('Live Hosting HTML and every JS/CSS asset match the tested local build.');
for(const path of ['workspaces/weride','workspaces/weride/context/ai-review','reviewShares/smoke-denied']){
 const response=await fetch(`https://firestore.googleapis.com/v1/projects/weride-discovery/databases/(default)/documents/${path}`);
 assert.equal(response.status,403);
}
pass('Anonymous requests cannot read the workspace, private context or share storage.');
const health=await fetch(`${base}/api/review-packs/status`,{cache:'no-store'});
const active=health.headers.get('content-type')?.includes('application/json')&&(await health.json()).available===true;
report.push(active?'SHARING: backend is available.':'SHARING: backend is not deployed; links must remain unavailable, Copy/Markdown can operate.');
console.log(report.at(-1));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/review-packs?preview=1`);
 await page.getByRole('button',{name:'Continue with Microsoft',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Continue with Microsoft',exact:true}).isEnabled(),true);
 assert.equal(await page.locator('.ai-review-page').count(),0);
 assert.equal(await page.getByText('Open local development preview',{exact:true}).count(),0);
 pass('Deep link still requires Microsoft login; preview query does not grant access.');
 await page.getByLabel('Display language',{exact:true}).selectOption('vi');await page.reload();
 await page.getByRole('button',{name:'Tiếp tục với Microsoft',exact:true}).waitFor();
 assert.equal(await page.locator('html').getAttribute('lang'),'vi');
 await page.getByLabel('Ngôn ngữ hiển thị',{exact:true}).selectOption('sv');
 await page.getByRole('button',{name:'Fortsätt med Microsoft',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 pass('Production language switching, retained locale and mobile login layout work.');
 assert.deepEqual(errors,[]);pass('No browser runtime errors during this smoke test.');
}finally{await browser.close();}
report.push('LIMIT: Real authenticated employee use and live public-share creation are not exercised by this anonymous smoke test.');
await writeFile('docs/AI-REVIEW-LIVE-SMOKE.txt',report.join('\n')+'\n');
