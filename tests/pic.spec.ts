import {test,expect} from '@playwright/test';
const path='/requirements/FN-BKG-01?preview=1';
test('assign an existing PIC, persist, filter the matrix, export and remove with history',async({page})=>{
  await page.goto(path);await page.getByRole('button',{name:'Assign PIC FN-BKG-01',exact:true}).click();
  const modal=page.getByRole('dialog');await expect(modal.getByRole('option',{name:/Inactive sample/})).toHaveCount(0);
  await modal.getByLabel('Assigned employee',{exact:true}).selectOption('sample-teammate');
  await modal.getByRole('button',{name:'Save assignment',exact:true}).click();await expect(modal).toHaveCount(0);
  await expect(page.locator('.pic-panel')).toContainText('Sample teammate');await page.reload();await expect(page.locator('.pic-panel')).toContainText('Sample teammate');
  await page.goto('/requirements?preview=1');await page.getByLabel('Filter by PIC',{exact:true}).selectOption('uid:sample-teammate');
  await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('tbody tr')).toContainText('FN-BKG-01');
  await page.getByRole('button',{name:'Export',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:/CSV/}).click();expect((await download).suggestedFilename()).toBe('weride-matrix.csv');
  await page.getByLabel('Filter by PIC',{exact:true}).selectOption('mine');await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.getByLabel('Filter by PIC',{exact:true}).selectOption('unassigned');await expect(page.locator('tbody tr')).toHaveCount(29);
  await page.goto(path);await page.getByRole('button',{name:'Assign PIC FN-BKG-01',exact:true}).click();
  await modal.getByRole('button',{name:'Remove assignment',exact:true}).click();await modal.getByRole('button',{name:'Save assignment',exact:true}).click();
  await expect(page.locator('.pic-panel')).toContainText('Unassigned');await page.reload();await expect(page.locator('.pic-panel')).toContainText('Unassigned');
  await page.goto('/activity?preview=1');await expect(page.locator('.activity-event')).toHaveCount(2);await expect(page.locator('main')).toContainText('PIC assignment removed');
});
test('search, assign-to-me and cancel use actual preview account IDs',async({page})=>{
  await page.goto('/requirements?preview=1');await page.getByRole('button',{name:'Assign PIC FN-BKG-01',exact:true}).click();const modal=page.getByRole('dialog');
  await modal.getByLabel('Find an employee',{exact:true}).fill('not-a-user');await expect(modal.getByText(/No matching employee/)).toBeVisible();
  await modal.getByLabel('Find an employee',{exact:true}).fill('');await modal.getByRole('button',{name:'Assign to me',exact:true}).click();
  await modal.getByRole('button',{name:'Save assignment',exact:true}).click();await page.getByLabel('Filter by PIC',{exact:true}).selectOption('mine');await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button',{name:'Assign PIC FN-BKG-01',exact:true}).click();await modal.getByLabel('Assigned employee',{exact:true}).selectOption('sample-teammate');await modal.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('tbody tr')).toContainText('Madison reviewer');
});
for(const locale of ['en','vi','sv'])test(`toolbar alignment and PIC dialog on desktop/mobile: ${locale}`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/requirements?preview=1');await page.locator('.locale-switch select').selectOption(locale);
  for(const width of [1440,1280,768,390,320]){
    await page.setViewportSize({width,height:950});
    const review=await page.locator('.matrix-page-heading .ai-review-button').boundingBox(),exp=await page.locator('.matrix-page-heading .export-control>.button').boundingBox();
    expect(review).not.toBeNull();expect(exp).not.toBeNull();expect(Math.abs(review!.height-exp!.height)).toBeLessThan(1);expect(Math.abs(review!.y-exp!.y)).toBeLessThan(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:1440,height:950});
  await page.locator('.matrix-page-heading .ai-review-button').click();await expect(page.locator('.ai-page')).toBeVisible();
  await page.locator('.sidebar a[href="/requirements"]').click();
  const review=await page.locator('.matrix-page-heading .ai-review-button').boundingBox(),exp=await page.locator('.matrix-page-heading .export-control>.button').boundingBox();
  expect(Math.abs(review!.height-exp!.height)).toBeLessThan(1);expect(Math.abs(review!.y-exp!.y)).toBeLessThan(1);
  await page.screenshot({path:`test-results/pic-matrix-${locale}.png`,fullPage:true});
  await page.locator('tbody tr').first().locator('.pic-button').click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/pic-dialog-mobile-${locale}.png`,fullPage:true});expect(errors).toEqual([]);
});
