import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const args=process.argv.slice(2),idx=args.indexOf('--account');const account=idx>=0?args[idx+1]:null;
const locked=args.includes('--locked');
if(!account||(!locked&&!args.includes('--confirm-microsoft')))throw new Error('Usage: npm run deploy -- --account APPROVED_CLI_ACCOUNT --locked (SSO pending), or --confirm-microsoft after completing docs/DEPLOYMENT.md.');
let project,env;
try{project=JSON.parse(await readFile('.firebaserc','utf8')).projects.default;env=await readFile('.env.local','utf8');}catch{throw new Error('Run npm run configure with an approved project before deploying.');}
if(!project||!/^[a-z][a-z0-9-]{4,29}$/.test(project)||!env.includes(`VITE_FIREBASE_PROJECT_ID=${project}`))throw new Error('Missing or inconsistent project configuration.');
const ready=/^VITE_MICROSOFT_AUTH_READY=true\s*$/m.test(env);
if(locked&&ready)throw new Error('Locked deployment requires VITE_MICROSOFT_AUTH_READY=false.');
if(!locked&&!ready)throw new Error('Configure and verify Microsoft SSO first, then set VITE_MICROSOFT_AUTH_READY=true.');
for(const command of ['test','build'])execFileSync('npm',['run',command],{stdio:'inherit'});
execFileSync('firebase',['deploy','--only','firestore:rules,firestore:indexes,hosting','--project',project,'--account',account,'--non-interactive'],{stdio:'inherit'});
console.log(`Hosting deployed: https://${project}.web.app`);
console.log(locked?'SSO setup pending: public login shell only; all workspace data remains protected.':'Complete real Microsoft-account acceptance tests in docs/DEPLOYMENT.md before declaring SSO ready.');
