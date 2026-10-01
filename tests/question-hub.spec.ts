import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
const hub='/questions?preview=1';
const modal=(page:Page)=>page.getByRole('dialog');
const save=async(page:Page)=>{await modal(page).getByRole('button',{name:'Save changes',exact:true}).click();await expect(modal(page)).toHaveCount(0);};
const card=(page:Page,title:string)=>page.locator('.qh-question-list .inline-question').filter({has:page.getByRole('heading',{name:title,exact:true})});
test('question menu, pagination and filters',async({page})=>{
  await page.goto('/?preview=1');await page.locator('.sidebar a[href="/questions"]').click();await expect(page.locator('.questions-hub')).toBeVisible();
  await expect(page.locator('.qh-metrics button').first()).toContainText('30');await expect(page.locator('.qh-question-list .inline-question')).toHaveCount(20);
  await page.locator('.qh-pagination').getByRole('button',{name:'Next',exact:true}).click();await expect(page.locator('.qh-question-list .inline-question')).toHaveCount(10);
  await page.getByLabel('Question scope',{exact:true}).selectOption('FN-BKG-01');await expect(page.locator('.qh-question-list .inline-question')).toHaveCount(1);
  await page.getByLabel('All priorities',{exact:true}).selectOption('critical');await expect(page.getByRole('heading',{name:'No matching questions',exact:true})).toBeVisible();
});
test('general question creation, priority, translation and updates',async({page})=>{
  await page.goto(hub);await page.getByRole('button',{name:'Add question',exact:true}).click();await expect(modal(page).getByLabel('Question scope',{exact:true})).toHaveValue('');
  await modal(page).locator('textarea').first().fill('Who approves the overall delivery plan?');await modal(page).getByLabel('Priority',{exact:true}).selectOption('critical');
  await modal(page).getByRole('button',{name:'Tiếng Việt',exact:true}).click();await modal(page).locator('textarea').first().fill('Ai duyệt kế hoạch triển khai tổng thể?');await save(page);
  const q=card(page,'Who approves the overall delivery plan?');await expect(q).toContainText('General project question');await expect(q).toContainText('Madison reviewer');await expect(q.locator('.question-priority')).toContainText('Critical');
  const id=await q.getAttribute('data-question-id');await page.reload();await expect(q).toBeVisible();await q.getByRole('button',{name:`Edit ${id}`,exact:true}).click();
  await expect(modal(page).getByLabel('Question scope',{exact:true})).toBeEnabled();await modal(page).getByLabel('Priority',{exact:true}).selectOption('high');await modal(page).getByLabel('Status',{exact:true}).selectOption('answered');await modal(page).getByLabel('Answer',{exact:false}).fill('To be confirmed by the project sponsor.');await save(page);
  await expect(q).toContainText('To be confirmed');await expect(q.locator('.question-priority')).toContainText('High');
  await page.goto('/activity?preview=1');await page.locator('.activity-event footer a').first().click();await expect(page).toHaveURL(/questions\?question=/);await expect(q).toBeVisible();
  await q.getByRole('button',{name:`Delete ${id}`,exact:true}).click();await modal(page).getByRole('button',{name:'Delete',exact:true}).click();await expect(q).toHaveCount(0);await page.reload();await expect(q).toHaveCount(0);
});
test('linked question and priority are shared across hub, matrix and landscape',async({page})=>{
  await page.goto(hub);await page.getByRole('button',{name:'Add question',exact:true}).click();await modal(page).getByLabel('Question scope',{exact:true}).selectOption('FN-BKG-01');await modal(page).locator('textarea').first().fill('Confirm booking rollout priority.');await modal(page).getByLabel('Priority',{exact:true}).selectOption('high');await save(page);
  const q=card(page,'Confirm booking rollout priority.');await expect(q).toContainText('FN-BKG-01');await expect(q.locator('.question-priority')).toContainText('High');
  await page.goto('/requirements?preview=1');await page.locator('tr[data-requirement-id="FN-BKG-01"] .requirement-expand').click();await expect(page.locator('.inline-qa-list')).toContainText('Confirm booking rollout priority.');
  await page.locator('.inline-question-composer textarea').first().fill('A critical booking dependency?');await page.locator('.inline-question-composer').getByLabel('Priority',{exact:true}).selectOption('critical');await page.getByRole('button',{name:'Post question',exact:true}).click();
  await page.goto('/system?preview=1');await page.locator('#system-requirements tr[data-requirement-id="FN-BKG-01"] .requirement-expand').click();await expect(page.locator('.inline-qa-list')).toContainText('A critical booking dependency?');
  await page.goto(hub);await page.getByLabel('Sort questions',{exact:true}).selectOption('priority');await expect(page.locator('.qh-question-list .inline-question').first()).toContainText('A critical booking dependency?');
  await page.getByLabel('All priorities',{exact:true}).selectOption('critical');await expect(page.locator('.qh-question-list .inline-question')).toHaveCount(1);
});
test('questions CSV and general scope do not change the source matrix',async({page})=>{
  await page.goto(hub);await page.getByRole('button',{name:'Add question',exact:true}).click();await modal(page).locator('textarea').first().fill('Project-wide acceptance process?');await save(page);
  await page.getByLabel('Question scope',{exact:true}).selectOption('general');await expect(page.locator('.qh-question-list .inline-question')).toHaveCount(1);
  const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Export questions CSV',exact:true}).click();expect((await dl).suggestedFilename()).toBe('weride-questions.csv');
  await page.goto('/requirements?preview=1');await expect(page.locator('tr.requirement-summary-row')).toHaveCount(30);await page.locator('tr[data-requirement-id="FN-BKG-01"] .requirement-expand').click();await expect(page.locator('.inline-qa-list')).not.toContainText('Project-wide acceptance process?');
});
test('seed questions remain read-only in the hub',async({page})=>{
  await page.goto(hub);await expect(page.locator('.qh-question-list .inline-question')).toHaveCount(20);
  await expect(page.locator('.qh-question-list .inline-question button[aria-label^="Edit "]')).toHaveCount(0);
  await expect(page.locator('.qh-question-list .inline-question button[aria-label^="Delete "]')).toHaveCount(0);
});
for(const locale of ['en','vi','sv'])test(`question hub and priority layout in ${locale}`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(hub);await page.locator('.locale-switch select').selectOption(locale);await expect(page.locator('.questions-hub')).toBeVisible();
  for(const width of [1440,1024,768,390,320]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:`test-results/question-hub-${locale}.png`,fullPage:false,animations:'disabled'});
  await page.locator('.qh-actions .button.primary').click();await expect(modal(page)).toBeVisible();await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/question-hub-compose-${locale}.png`,fullPage:false,animations:'disabled'});expect(errors).toEqual([]);
});
