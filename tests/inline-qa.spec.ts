import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
const matrix='/requirements?preview=1',system='/system?preview=1';
const panel=(page:Page)=>page.locator('.inline-qa');
const open=async(page:Page,id:string)=>{const toggle=page.locator(`tr[data-requirement-id="${id}"] .requirement-expand`);if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();};
const post=async(page:Page,value:string)=>{await panel(page).getByLabel('Question text · English',{exact:true}).fill(value);await panel(page).getByRole('button',{name:'Post question',exact:true}).click();await expect(panel(page).locator('.inline-question').filter({hasText:value})).toBeVisible();};
test('only one accordion opens; keyboard, row and Q&A trigger work without navigation',async({page})=>{
  await page.goto(matrix);await open(page,'FN-BKG-01');await expect(panel(page)).toHaveCount(1);await expect(panel(page)).toHaveAttribute('data-requirement-id','FN-BKG-01');
  const trigger=page.getByRole('button',{name:'Close Q&A FN-BKG-01',exact:true});await expect(trigger).toHaveAttribute('aria-expanded','true');
  await page.getByRole('button',{name:'Open Q&A FN-BKG-02',exact:true}).focus();await page.keyboard.press('Enter');await expect(panel(page)).toHaveCount(1);await expect(panel(page)).toHaveAttribute('data-requirement-id','FN-BKG-02');
  await page.locator('tr[data-requirement-id="FN-DIS-01"] .requirement-name p').click();await expect(panel(page)).toHaveAttribute('data-requirement-id','FN-DIS-01');
  await page.getByRole('button',{name:'Q&A FN-BKG-01',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-requirement-id','FN-BKG-01');
  await page.getByRole('button',{name:'Q&A FN-BKG-01',exact:true}).click();await expect(panel(page)).toHaveCount(0);await expect(page).toHaveURL(/\/requirements\?preview=1$/);
});
test('own question create/edit/answer/delete, author, counts, reload and activity',async({page})=>{
  await page.goto(matrix);await open(page,'FN-BKG-01');await expect(panel(page).locator('.inline-question')).toHaveCount(1);
  await expect(panel(page).getByRole('button',{name:/^Edit /})).toHaveCount(0);await expect(panel(page)).toContainText('Madison · discovery draft');
  await post(page,'Which OTA sandbox is available?');let card=panel(page).locator('.inline-question').filter({hasText:'Which OTA sandbox is available?'});await expect(card.locator('.question-author')).toContainText('Madison reviewer');
  await expect(page.getByRole('button',{name:'Q&A FN-BKG-01',exact:true})).toContainText('2');await page.reload();await open(page,'FN-BKG-01');card=panel(page).locator('.inline-question').filter({hasText:'Which OTA sandbox is available?'});
  await card.getByRole('button',{name:/^Edit /}).click();const modal=page.getByRole('dialog');await modal.locator('textarea').first().fill('Which OTA sandbox and credentials are available?');await modal.getByLabel('Answer',{exact:false}).fill('Awaiting partner confirmation.');await modal.getByLabel('Status',{exact:true}).selectOption('answered');await modal.getByRole('button',{name:'Save changes',exact:true}).click();await expect(modal).toHaveCount(0);
  card=panel(page).locator('.inline-question').filter({hasText:'Which OTA sandbox and credentials are available?'});await card.getByRole('button',{name:/Read discussion/}).click();await expect(card).toContainText('Awaiting partner confirmation.');await expect(card.locator('.question-author')).toContainText('Madison reviewer');
  await card.getByRole('button',{name:/^Delete /}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete',exact:true}).click();await expect(card).toHaveCount(0);await expect(page.getByRole('button',{name:'Q&A FN-BKG-01',exact:true})).toContainText('1');
  await page.goto('/activity?preview=1');await expect(page.locator('.activity-event')).toHaveCount(3);
});
test('draft is retained when switching or filtering items; no silent publication',async({page})=>{
  await page.goto(matrix);await open(page,'FN-BKG-01');await panel(page).getByLabel('Question text · English',{exact:true}).fill('Unsaved English question');await panel(page).getByRole('button',{name:'Tiếng Việt',exact:true}).click();await panel(page).getByLabel('Question text · Tiếng Việt',{exact:true}).fill('Câu hỏi chưa gửi');
  await open(page,'FN-BKG-02');await expect(panel(page).getByLabel('Question text · English',{exact:true})).toHaveValue('');await open(page,'FN-BKG-01');await expect(panel(page).getByLabel('Question text · English',{exact:true})).toHaveValue('Unsaved English question');await expect(panel(page).locator('.inline-question')).toHaveCount(1);
  await page.locator('main').getByLabel('Search requirements',{exact:true}).fill('REG-DAC');await expect(panel(page)).toHaveCount(0);await page.locator('main').getByLabel('Search requirements',{exact:true}).fill('');await open(page,'FN-BKG-01');await expect(panel(page).getByLabel('Question text · English',{exact:true})).toHaveValue('Unsaved English question');
});
test('other members questions show the asker and never expose edit/delete, including full detail',async({page})=>{
  await page.route('**/__dev/seed',async route=>{const response=await route.fetch();const d=await response.json();const source=d.entries.find((e:{kind:string})=>e.kind==='qa');d.entries.push({...source,id:'other-asker-question',requirementId:'FN-BKG-01',origin:'team',createdBy:'sample-teammate',createdByName:'Historical name',updatedBy:'local-preview',updatedByName:'Madison reviewer',title:{en:'A question from another member',vi:'',sv:''}});await route.fulfill({json:d});});
  await page.goto(matrix);await open(page,'FN-BKG-01');const card=panel(page).locator('.inline-question').filter({hasText:'A question from another member'});await expect(card.locator('.question-author')).toContainText('Sample teammate');await expect(card.getByRole('button',{name:/^(Edit|Delete) /})).toHaveCount(0);
  await page.goto('/requirements/FN-BKG-01?preview=1&tab=qa');const detail=page.locator('[data-testid="entry-other-asker-question"]');await expect(detail.locator('.question-author')).toContainText('Sample teammate');await expect(detail.getByRole('button',{name:/^(Edit|Delete) /})).toHaveCount(0);
});
test('system landscape provides live PIC, Q&A, discovery links and shared data with matrix',async({page})=>{
  await page.goto(system);const list=page.locator('#system-requirements');await expect(list.locator('tr.requirement-summary-row')).toHaveCount(3);
  await list.getByRole('button',{name:'Assign PIC FN-BKG-01',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Assign to me',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Save assignment',exact:true}).click();await expect(list.locator('tr[data-requirement-id="FN-BKG-01"]')).toContainText('Madison reviewer');await expect(panel(page)).toHaveCount(0);
  await open(page,'FN-BKG-01');await post(page,'System list question shared with matrix');await expect(list.getByRole('link',{name:'Functional breakdown FN-BKG-01',exact:true})).toHaveAttribute('href','/requirements/FN-BKG-01?tab=breakdown');await expect(list.getByRole('link',{name:'Assumptions FN-BKG-01',exact:true})).toHaveAttribute('href','/requirements/FN-BKG-01?tab=assumption');
  await list.getByLabel('Filter by PIC',{exact:true}).selectOption('mine');await expect(list.locator('tr.requirement-summary-row')).toHaveCount(1);
  await page.goto(matrix);await open(page,'FN-BKG-01');await expect(panel(page)).toContainText('System list question shared with matrix');await expect(page.locator('tr[data-requirement-id="FN-BKG-01"]')).toContainText('Madison reviewer');
  await page.goto(system);await open(page,'FN-BKG-01');await page.locator('.system-node').filter({has:page.getByText('Passenger app',{exact:true})}).click();await expect(panel(page)).toHaveCount(0);await expect(page.locator('#system-requirements tr.requirement-summary-row')).toHaveCount(3);await open(page,'FN-PAS-01');await expect(panel(page)).toHaveAttribute('data-requirement-id','FN-PAS-01');
});
test('system group CSV download respects selected group and filter',async({page})=>{
  await page.goto(system);await page.getByLabel('Search this group',{exact:true}).fill('FN-BKG-01');await expect(page.locator('#system-requirements tr.requirement-summary-row')).toHaveCount(1);const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Export group CSV',exact:true}).click();expect((await downloading).suggestedFilename()).toBe('weride-booking.csv');
});
for(const locale of ['en','vi','sv'])test(`accordion, author, composer and system list layout in ${locale}`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(matrix);await page.locator('.locale-switch select').selectOption(locale);await page.locator('tr[data-requirement-id="FN-BKG-01"] .requirement-expand').click();
  for(const width of [1440,1024,768,390,320]){await page.setViewportSize({width,height:1000});await expect(panel(page)).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const area=await page.locator('.inline-question-composer textarea').first().boundingBox();expect(area).not.toBeNull();expect(area!.x+area!.width).toBeLessThanOrEqual(width);}
  await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:`test-results/inline-qa-matrix-${locale}.png`,fullPage:false,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});await panel(page).scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/inline-qa-mobile-${locale}.png`,fullPage:false,animations:'disabled'});
  await page.goto(system);await page.locator('#system-requirements tr.requirement-summary-row').first().locator('.requirement-expand').click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:1440,height:1100});await page.locator('#system-requirements').scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/inline-qa-system-${locale}.png`,fullPage:false,animations:'disabled'});expect(errors).toEqual([]);
});
