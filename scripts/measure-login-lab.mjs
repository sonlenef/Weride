import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),samples=[];
try{
  for(let i=0;i<3;i++){
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
    const cdp=await context.newCDPSession(page);
    await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    await page.addInitScript(()=>{
      window.__lab={lcp:0,cls:0};
      new PerformanceObserver(list=>{for(const e of list.getEntries())window.__lab.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
      new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__lab.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
    });
    await page.goto('https://weride-discovery.web.app');
    await page.getByRole('button',{name:'Continue with Microsoft',exact:true}).waitFor();
    await page.waitForTimeout(1000);
    samples.push(await page.evaluate(()=>({lcpMs:window.__lab.lcp,cls:window.__lab.cls,fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,navigationMs:performance.getEntriesByType('navigation')[0]?.duration,resources:performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.js')).map(r=>({asset:new URL(r.name).pathname,transfer:r.transferSize,decoded:r.decodedBodySize}))})));
    await context.close();
  }
}finally{await browser.close();}
const report={surface:'Production login shell only; no credentials submitted',conditions:{viewport:'390x844',cache:'disabled',cpuThrottle:4,latencyMs:150,downloadMbps:1.6,uploadMbps:0.75},samples,limits:'Three lab samples, not field p75, INP, a real mobile device, or authenticated data-ready timing.'};
await mkdir('.backups/uiux-remediation-20260929',{recursive:true});
await writeFile('.backups/uiux-remediation-20260929/login-lab.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
