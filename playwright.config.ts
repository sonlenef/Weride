import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'tests',testMatch:['workspace.spec.ts','auth-direct-sso.spec.ts','review-pack.spec.ts','pic.spec.ts','inline-qa.spec.ts','question-hub.spec.ts'],fullyParallel:false,workers:1,timeout:30000,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:5173',reducedMotion:'reduce',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1040}}}],
  webServer:[
    {command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:true},
    {command:'npm run preview -- --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:true}
  ]
});
