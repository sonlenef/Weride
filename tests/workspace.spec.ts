import { test,expect } from '@playwright/test';
import type { Page,Locator } from '@playwright/test';
const openRequirement=async(page:Page,tab:string)=>{await page.goto(`/requirements/FN-BKG-01?preview=1&tab=${tab}`);await expect(page.locator('h1')).toHaveText('Multi-Channel Booking Intake');};
const dialog=(page:Page)=>page.getByRole('dialog');
const save=async(page:Page)=>{await dialog(page).getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog(page)).toHaveCount(0);};
const title=async(box:Locator,value:string)=>box.locator('textarea').first().fill(value);
test('overview, all 30 matrix rows, filtering and CSV export',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?preview=1');await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.getByRole('heading',{name:'A clearer path to launch.'})).toBeVisible();
  await page.screenshot({path:'test-results/overview-desktop.png',fullPage:true});
  await page.goto('/requirements?preview=1');await expect(page.locator('tbody tr')).toHaveCount(30);
  await page.screenshot({path:'test-results/matrix-desktop.png',fullPage:true});
  await page.getByLabel('All tiers',{exact:true}).selectOption('L2');await expect(page.locator('tbody tr')).toHaveCount(6);
  await page.getByLabel('All tiers',{exact:true}).selectOption('');await page.locator('main').getByLabel('Search requirements',{exact:true}).fill('REG-DAC');await expect(page.locator('tbody tr')).toHaveCount(3);
  await page.getByRole('button',{name:'Export',exact:true}).click();const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:/CSV/}).click();expect((await downloaded).suggestedFilename()).toBe('weride-matrix.csv');expect(errors).toEqual([]);
});
test('Q&A create, translate, answer, edit, persist and delete',async({page})=>{
  await openRequirement(page,'qa');await page.getByRole('button',{name:'Add question',exact:true}).click();await title(dialog(page),'Which booking channel is first?');
  await dialog(page).getByRole('button',{name:'Tiếng Việt',exact:true}).click();await title(dialog(page),'Kênh đặt xe nào triển khai trước?');
  await dialog(page).getByRole('button',{name:'Svenska',exact:true}).click();await title(dialog(page),'Vilken bokningskanal kommer först?');await save(page);
  let card=page.locator('.entry-card').filter({hasText:'Which booking channel is first?'});await expect(card).toBeVisible();
  await card.getByRole('button',{name:/^Edit /}).click();await dialog(page).getByLabel('Status',{exact:true}).selectOption('answered');await dialog(page).getByLabel('Answer',{exact:false}).fill('Dispatch console first; subject to client approval.');await save(page);
  await page.reload();card=page.locator('.entry-card').filter({hasText:'Which booking channel is first?'});await expect(card).toContainText('Dispatch console first');
  await page.getByLabel('Display language',{exact:true}).selectOption('sv');await expect(page.locator('h1')).not.toHaveText('Multi-Channel Booking Intake');await expect(page.getByText('Vilken bokningskanal kommer först?',{exact:true})).toBeVisible();await page.screenshot({path:'test-results/requirement-swedish.png',fullPage:true});
  await page.getByLabel('Visningsspråk',{exact:true}).selectOption('vi');await expect(page.getByText('Kênh đặt xe nào triển khai trước?',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('Kênh đặt xe nào triển khai trước?',{exact:true})).toBeVisible();
  await page.getByLabel('Ngôn ngữ hiển thị',{exact:true}).selectOption('en');card=page.locator('.entry-card').filter({hasText:'Which booking channel is first?'});await card.getByRole('button',{name:/^Delete /}).click();await dialog(page).getByRole('button',{name:'Delete',exact:true}).click();await expect(card).toHaveCount(0);await page.goto('/activity?preview=1');await expect(page.locator('.activity-event')).toHaveCount(3);
});
for(const [kind,add] of [['breakdown','Add work package'],['assumption','Add assumption']])test(`${kind} supports nested create/edit/delete, preserving children`,async({page})=>{
  await openRequirement(page,kind);await page.getByRole('button',{name:add,exact:true}).click();await title(dialog(page),`New ${kind} parent`);await save(page);
  let parent=page.locator('.entry-card').filter({has:page.getByRole('heading',{name:`New ${kind} parent`,exact:true})});await parent.getByRole('button',{name:/^Add sub-item /}).click();await title(dialog(page),`New ${kind} child`);await save(page);
  const child=page.locator('.entry-card').filter({has:page.getByRole('heading',{name:`New ${kind} child`,exact:true})});await child.getByRole('button',{name:/^Edit /}).click();await dialog(page).getByLabel('Owner',{exact:true}).fill('Discovery lead');await save(page);await expect(child).toContainText('Discovery lead');
  await parent.getByRole('button',{name:/^Delete /}).click();await dialog(page).getByRole('button',{name:'Delete',exact:true}).click();await expect(parent).toHaveCount(0);await expect(child).toBeVisible();await page.reload();await expect(child).toBeVisible();
  await child.getByRole('button',{name:/^Delete /}).click();await dialog(page).getByRole('button',{name:'Delete',exact:true}).click();await expect(child).toHaveCount(0);
});
test('vendor response validates CU and persists the recorded estimate',async({page})=>{
  await openRequirement(page,'overview');await page.getByRole('button',{name:'Edit vendor response',exact:true}).click();await dialog(page).getByLabel('Compliance',{exact:true}).selectOption('CU');await dialog(page).getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog(page).getByRole('alert')).toBeVisible();await dialog(page).getByLabel('Estimated hours',{exact:true}).fill('80');await dialog(page).getByLabel('Estimated cost, excluding VAT',{exact:true}).fill('6400');await save(page);await page.reload();await expect(page.locator('.vendor-panel')).toContainText('80');await expect(page.locator('.vendor-panel')).toContainText('6,400');
});
test('mobile layout, system diagram, source notes and read-only production gate',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/?preview=1');await expect(page.locator('h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/overview-mobile.png',fullPage:true});
  await page.goto('/system?preview=1');await expect(page.locator('h1')).toBeVisible();await page.screenshot({path:'test-results/system-mobile.png',fullPage:true});await page.goto('/sources?preview=1');await expect(page.locator('main')).toContainText('EXP-TAX-01');
  await page.goto('http://127.0.0.1:4173/requirements/FN-BKG-01?preview=1');await expect(page.getByRole('button',{name:'Continue with Microsoft'})).toBeVisible();await expect(page.getByRole('link',{name:'Open local development preview'})).toHaveCount(0);await expect(page.getByText('Multi-Channel Booking Intake',{exact:true})).toHaveCount(0);await page.screenshot({path:'test-results/login-production.png',fullPage:true});
  const response=await page.request.get('http://127.0.0.1:4173/__dev/seed');expect(response.headers()['content-type']).not.toContain('application/json');
});
