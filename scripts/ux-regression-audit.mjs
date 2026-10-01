import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root='http://127.0.0.1:5173',out='.backups/uiux-remediation-20260929';
await mkdir(out,{recursive:true,mode:0o700});
const source=JSON.parse(await readFile('private/seed.json','utf8'));
const loc=en=>({en,vi:'',sv:''});
const question=(id,uid,req='FN-BKG-01')=>({id,requirementId:req,kind:'qa',parentId:'',title:loc('Synthetic review question '+id),body:loc('Only synthetic usability data.'),answer:loc(),acceptance:loc(),status:'open',priority:'high',owner:'',estimateHours:null,version:1,origin:'team',createdBy:uid,createdByName:uid==='local-preview'?'Madison reviewer':'Sample teammate',updatedBy:uid,updatedByName:'Sample teammate',createdAt:'2026-09-29T10:00:00Z',updatedAt:'2026-09-29T10:00:00Z'});
const fixture={...source,entries:[...source.entries.filter(e=>e.kind!=='qa'),question('audit-own','local-preview'),question('audit-other','sample-teammate'),question('audit-general','sample-teammate','')],members:JSON.parse(await readFile('private/members.preview.json','utf8')),reviewContext:JSON.parse(await readFile('private/review-context.json','utf8'))};
const result={at:new Date().toISOString(),environment:'Local preview only; all external requests blocked',scans:[],errors:[]};
const browser=await chromium.launch({headless:true});
async function scan(page,name){
  await page.waitForTimeout(80);
  await page.addScriptTag({path:'.backups/uiux-audit-20260929/tools/package/axe.min.js'});
  const measured=await page.evaluate(async()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,violations:(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))}))}));
  await page.screenshot({path:`${out}/${name}.png`,fullPage:false,animations:'disabled'});
  result.scans.push({name,...measured});await writeFile(`${out}/accessibility.json`,JSON.stringify(result,null,2));
  console.log(name,JSON.stringify({overflow:measured.scrollWidth>measured.width,violations:measured.violations.map(v=>v.id+':'+v.nodes.length)}));
}
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.route('https://**/*',r=>r.abort());await context.route('**/__dev/seed',r=>r.fulfill({json:fixture}));
  const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
  const routes=[['overview','/'],['matrix','/requirements'],['questions','/questions'],['system','/system'],['detail','/requirements/FN-BKG-01'],['breakdown','/requirements/FN-BKG-01?tab=breakdown'],['sources','/sources?requirement=FN-BKG-01'],['activity','/activity'],['review','/review-packs?requirement=FN-BKG-01'],['search','/search?q=Synthetic']];
  for(const locale of ['en','vi','sv'])for(const [name,path] of routes){
    await page.goto(root+path+(path.includes('?')?'&':'?')+'preview=1');await page.locator('main h1').waitFor();await page.locator('.locale-switch select').selectOption(locale);
    for(const width of [1440,390]){await page.setViewportSize({width,height:width===1440?1000:844});await scan(page,`${name}-${locale}-${width}`);}
    await page.setViewportSize({width:320,height:740});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow){result.scans.push({name:`${name}-${locale}-320`,width:320,scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth),violations:[]});console.log('OVERFLOW',name,locale,320);}
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(root+'/questions?preview=1');
  await page.locator('.locale-switch select').selectOption('en');
  await page.locator('.qh-actions .button.primary').click();
  await scan(page,'question-editor');
  await page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true}).click();
  await scan(page,'question-validation');
  await page.keyboard.press('Escape');
  await page.goto(root+'/requirements?preview=1');
  await page.locator('[data-requirement-id="FN-BKG-01"] .requirement-expand').click();
  await scan(page,'inline-questions');
  await page.locator('.inline-question .question-toggle').first().click();
  await scan(page,'reply-thread');
  await page.setViewportSize({width:390,height:844});
  await scan(page,'reply-thread-mobile');
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-requirement-id="FN-BKG-01"] .pic-button').click();
  await scan(page,'pic-editor');
  await page.keyboard.press('Escape');
  await page.goto(root+'/sources?preview=1');
  await page.locator('.decision-register .section-heading .button').click();
  await scan(page,'decision-editor');
  await page.keyboard.press('Escape');
  await page.goto(root+'/requirements/FN-BKG-01?preview=1');
  await page.getByRole('button',{name:'Edit vendor response',exact:true}).click();
  await scan(page,'vendor-editor');
  await page.keyboard.press('Escape');
}catch(error){
  result.errors.push(String(error.stack||error));
  console.error(error.message);
}finally{
  await writeFile(`${out}/accessibility.json`,JSON.stringify(result,null,2));
  await browser.close();
  console.log('AUDIT_FINISHED',result.scans.length,'states;',result.errors.length,'runtime/runner errors');
}
