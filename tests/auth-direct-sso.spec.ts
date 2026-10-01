import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
// Synthetic sessions + intercepted Firebase endpoints, ONLY against localhost.
// No real ID/access/refresh token, account, verification email or cloud write is used.
const env=Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const key=env.VITE_FIREBASE_API_KEY, project=env.VITE_FIREBASE_PROJECT_ID;
const base='http://127.0.0.1:4173';
async function session(page:Page,email='member@madison.dev',provider='microsoft.com',verified=false){
  const state={verified,sends:0,reads:0,refreshes:0};
  const uid='synthetic-browser-auth-regression';
  const jwt=()=>{
    const now=Math.floor(Date.now()/1000), encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url');
    return `${encode({alg:'none',typ:'JWT'})}.${encode({iss:`https://securetoken.google.com/${project}`,aud:project,sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,email,email_verified:state.verified,firebase:{identities:{[provider]:[uid],email:[email]},sign_in_provider:provider}})}.local-test-only`;
  };
  await page.route('https://**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='identitytoolkit.googleapis.com'&&url.pathname.endsWith('/accounts:lookup')){
      await route.fulfill({json:{users:[{localId:uid,email,emailVerified:state.verified,displayName:'Synthetic test member',providerUserInfo:[{providerId:provider,rawId:uid,federatedId:uid,email}],createdAt:'1700000000000',lastLoginAt:String(Date.now())}]}});return;
    }
    if(url.hostname==='identitytoolkit.googleapis.com'&&url.pathname.endsWith('/accounts:sendOobCode')){
      expect(route.request().postDataJSON().requestType).toBe('VERIFY_EMAIL');state.sends++;
      await route.fulfill({json:{email}});return;
    }
    if(url.hostname==='securetoken.googleapis.com'){
      state.refreshes++;await route.fulfill({json:{access_token:jwt(),id_token:jwt(),refresh_token:'synthetic-refresh',expires_in:'3600',token_type:'Bearer',user_id:uid,project_id:project}});return;
    }
    if(url.hostname==='firestore.googleapis.com')state.reads++;
    await route.abort();
  });
  const serialized={uid,email,emailVerified:state.verified,isAnonymous:false,displayName:'Synthetic test member',providerData:[{providerId:provider,uid,email,displayName:'Synthetic test member',photoURL:null}],stsTokenManager:{refreshToken:'synthetic-refresh',accessToken:jwt(),expirationTime:Date.now()+3600000},apiKey:key,appName:'[DEFAULT]',createdAt:'1700000000000',lastLoginAt:String(Date.now())};
  await page.addInitScript(({key,serialized})=>sessionStorage.setItem(`firebase:authUser:${key}:[DEFAULT]`,JSON.stringify(serialized)),{key,serialized});
  await page.goto(base);
  return state;
}
for (const verified of [false,true]) test(`Microsoft SSO enters workspace directly with emailVerified=${verified}`,async({page})=>{
  const state=await session(page,'member@madison.dev','microsoft.com',verified);
  await expect.poll(()=>state.reads).toBeGreaterThan(0);
  await expect(page.locator('.login-page')).toHaveCount(0);
  await expect(page.locator('.verification-panel')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Send verification email',exact:true})).toHaveCount(0);
  expect(state.sends).toBe(0);
  const previous=state.reads;
  await page.reload();
  await expect.poll(()=>state.reads).toBeGreaterThan(previous);
  await expect(page.locator('.login-page')).toHaveCount(0);
  expect(state.sends).toBe(0);
  // Only the production auth gate is exercised. No real cloud data is requested.
});
for(const [email,provider,message] of [
  ['member@outside.dev','microsoft.com','not in @madison.dev'],
  ['member@madison.dev','google.com','did not use Microsoft sign-in'],
  ['member@madison.dev','password','did not use Microsoft sign-in'],
  ['member@madison.dev','custom','did not use Microsoft sign-in'],
  ['member@madison.dev.evil.com','microsoft.com','not in @madison.dev'],
  ['member@sub.madison.dev','microsoft.com','not in @madison.dev'],
])test(`rejects ${email} / ${provider} with a specific reason`,async({page})=>{
  const state=await session(page,email,provider);
  await expect(page.getByRole('alert')).toContainText(message);
  await expect(page.locator('.verification-panel')).toHaveCount(0);
  expect(state.sends).toBe(0);expect(state.reads).toBe(0);
});

test('legacy tab session migrates to persistent storage and sign-out reaches other tabs',async({page,context})=>{
  await session(page);await expect(page.locator('.app-shell')).toBeVisible();
  const storageKey=`firebase:authUser:${key}:[DEFAULT]`;
  await expect.poll(()=>page.evaluate(k=>Boolean(localStorage.getItem(k)),storageKey)).toBe(true);
  await expect.poll(()=>page.evaluate(k=>sessionStorage.getItem(k),storageKey)).toBeNull();
  const second=await context.newPage();
  // No synthetic session request may leave localhost; the SDK can restore cached identity offline.
  await second.route('https://**/*',route=>route.abort());
  await second.goto(base+'/requirements/FN-BKG-01');
  await expect(second.locator('.app-shell')).toBeVisible();
  await expect(second.locator('.profile')).toContainText('Synthetic test member');
  await second.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(second.locator('.login-page')).toBeVisible();
  await expect(page.locator('.login-page')).toBeVisible();
  await expect.poll(()=>second.evaluate(k=>localStorage.getItem(k),storageKey)).toBeNull();
  await second.reload();await expect(second.locator('.login-page')).toBeVisible();
});
test('an open page signs out at the 24-hour limit without extending on token refresh',async({page})=>{
  await page.clock.install({time:new Date()});
  await session(page);await expect(page.locator('.app-shell')).toBeVisible();
  await page.clock.fastForward(86_401_000);
  await expect(page.locator('.login-page')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('24-hour session');
});

test('saved login survives an actual browser process restart on the same profile',async()=>{
  const {chromium}=await import('@playwright/test');
  const {mkdtempSync,rmSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');const {join}=await import('node:path');
  const profile=mkdtempSync(join(tmpdir(),'weride-session-test-'));
  let browser=await chromium.launchPersistentContext(profile,{headless:true});
  try{
    let page=await browser.newPage();await session(page);
    await expect(page.locator('.app-shell')).toBeVisible();
    const storageKey=`firebase:authUser:${key}:[DEFAULT]`;
    await expect.poll(()=>page.evaluate(k=>Boolean(localStorage.getItem(k)),storageKey)).toBe(true);
    await browser.close();
    browser=await chromium.launchPersistentContext(profile,{headless:true});
    await browser.route('https://**/*',route=>route.abort());
    page=await browser.newPage();await page.goto(base+'/requirements');
    await expect(page.locator('.app-shell')).toBeVisible();
    await expect(page.locator('.profile')).toContainText('Synthetic test member');
    await expect(page.locator('.login-page')).toHaveCount(0);
  }finally{await browser.close();rmSync(profile,{recursive:true,force:true});}
});
test('a sleeping page checks expiry when brought back into focus',async({page})=>{
  const now=new Date();await page.clock.install({time:now});
  await session(page);await expect(page.locator('.app-shell')).toBeVisible();
  await page.clock.setSystemTime(new Date(now.getTime()+86_401_000));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.login-page')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('24-hour session');
});
