import { Firestore } from '@google-cloud/firestore';
import { OAuth2Client } from 'google-auth-library';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];
if(value('--project')!=='weride-discovery'||!args.includes('--account')||process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Use --project weride-discovery --account APPROVED_ACCOUNT; emulator must be unset.');
const authClient=new OAuth2Client({quotaProjectId:'weride-discovery'});
authClient.setCredentials({access_token:execFileSync('gcloud',['auth','print-access-token','--account',value('--account')],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(),expiry_date:Date.now()+3500000});
const db=new Firestore({projectId:'weride-discovery',authClient});
try{
  const data=JSON.parse(await readFile(new URL('../private/review-context.json',import.meta.url),'utf8'));
  const ref=db.doc('workspaces/weride/context/ai-review'),current=await ref.get();
  if(current.exists)console.log('Context already exists; preserved without changes.');
  else if(args.includes('--dry-run'))console.log('Would add one source-referenced AI context document. No existing requirement or team entry is changed.');
  else{await ref.create(data);console.log('Added one source-referenced AI context document. Original requirements and team entries unchanged.');}
}finally{await db.terminate();}
