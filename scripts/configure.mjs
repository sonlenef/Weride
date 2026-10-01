import { execFileSync } from 'node:child_process';
import { writeFile, access, copyFile } from 'node:fs/promises';
const args=process.argv.slice(2);const arg=k=>args[args.indexOf(k)+1];
const project=args.includes('--project')?arg('--project'):null;
const account=args.includes('--account')?arg('--account'):null;
const tenant=args.includes('--tenant')?arg('--tenant'):'madison.dev';
if(!project||!account||!/^[a-z][a-z0-9-]{4,29}$/.test(project))throw new Error('Usage: npm run configure -- --project APPROVED_PROJECT_ID --account FIREBASE_CLI_ACCOUNT [--tenant ENTRA_TENANT_ID] [--create-app]');
const run=(command)=>{try{return JSON.parse(execFileSync('firebase',[...command,'--project',project,'--account',account,'--json'],{encoding:'utf8',maxBuffer:4e6})).result;}catch{throw new Error(`Firebase ${command[0]} failed. Check the selected account/project without pasting credentials into chat.`);}};
let apps=run(['apps:list','WEB']);apps=Array.isArray(apps)?apps:apps?.apps;
if(!apps?.length){if(!args.includes('--create-app'))throw new Error('No web app exists. Repeat with --create-app to create a dedicated web app in this approved project.');run(['apps:create','WEB','WeRide Discovery']);apps=run(['apps:list','WEB']);apps=Array.isArray(apps)?apps:apps?.apps;}
const app=apps.find(a=>a.displayName==='WeRide Discovery')||(apps.length===1?apps[0]:null);
if(!app)throw new Error('Multiple web apps exist. Create a dedicated app named "WeRide Discovery" rather than choosing another application automatically.');
const configResult=run(['apps:sdkconfig','WEB',app.appId]);const config=configResult?.sdkConfig||configResult;
if(!config?.apiKey||config.projectId!==project||!config.appId||!config.authDomain)throw new Error('Unexpected Firebase web configuration response. No local configuration was overwritten.');
try{await access('.env.local');await copyFile('.env.local','.env.backup.local');}catch{}
await writeFile('.env.local',`VITE_FIREBASE_API_KEY=${config.apiKey}\nVITE_FIREBASE_AUTH_DOMAIN=${config.authDomain}\nVITE_FIREBASE_PROJECT_ID=${project}\nVITE_FIREBASE_APP_ID=${config.appId}\nVITE_MICROSOFT_TENANT_ID=${tenant}\nVITE_MICROSOFT_AUTH_READY=false\n`,{mode:0o600});
await writeFile('.firebaserc',JSON.stringify({projects:{default:project}},null,2)+'\n');
console.log(`Configured ${project}. Microsoft client secret must be stored only in Firebase Authentication provider settings, never VITE_* or source files.`);
console.log(`Register Web redirect URI: https://${config.authDomain}/__/auth/handler`);
