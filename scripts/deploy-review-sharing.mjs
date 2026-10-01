import {execFileSync} from 'node:child_process';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
const args=process.argv.slice(2),account=args[args.indexOf('--account')+1];
const project=JSON.parse(await readFile('.firebaserc','utf8')).projects.default;
if(!args.includes('--account')||!account||project!=='weride-discovery')throw new Error('Use npm run deploy:review-sharing -- --account APPROVED_ACCOUNT from the weride project.');
const cloud=(a,pipe=false)=>execFileSync('gcloud',[...a,'--account',account],{encoding:'utf8',stdio:pipe?['ignore','pipe','pipe']:'inherit'});
const billing=JSON.parse(cloud(['billing','projects','describe',project,'--format=json(projectId,billingEnabled)'],true));
if(billing.billingEnabled!==true)throw new Error('BLAZE_REQUIRED: enable billing for weride-discovery in Firebase Console. No billing account will be attached by this script. Copy/Markdown Hosting may be deployed independently with npm run deploy.');
for(const cmd of ['test','build','test:review-api'])execFileSync('npm',['run',cmd],{stdio:'inherit'});
const serviceAccount=`weride-review-sharing@${project}.iam.gserviceaccount.com`;
try{cloud(['iam','service-accounts','describe',serviceAccount,'--project',project,'--format=value(email)'],true);}catch{cloud(['iam','service-accounts','create','weride-review-sharing','--project',project,'--display-name=WeRide Review Sharing']);}
for(const role of ['roles/datastore.user','roles/firebaseauth.viewer'])cloud(['projects','add-iam-policy-binding',project,'--member',`serviceAccount:${serviceAccount}`,'--role',role,'--condition=None','--quiet']);
execFileSync('firebase',['deploy','--only','functions:review-sharing','--project',project,'--account',account,'--non-interactive'],{stdio:'inherit'});
// Only install rewrites after the function really exists. No fake /sharing URLs.
const config=JSON.parse(await readFile('firebase.json','utf8'));
config.hosting.rewrites=[{source:'/s/**',function:{functionId:'reviewSharing',region:'europe-west1'}},{source:'/api/review-packs/**',function:{functionId:'reviewSharing',region:'europe-west1'}},...config.hosting.rewrites.filter(r=>!['/s/**','/api/review-packs/**'].includes(r.source))];
await copyFile('firebase.json','.firebase.review-sharing.json');
await writeFile('firebase.json',JSON.stringify(config,null,2)+'\n');
execFileSync('firebase',['deploy','--only','firestore:rules,firestore:indexes,hosting','--project',project,'--account',account,'--non-interactive'],{stdio:'inherit'});
console.log('Deployed review sharing at https://weride-discovery.web.app/review-packs. Verify public snapshot expiry/revocation before wider rollout.');
