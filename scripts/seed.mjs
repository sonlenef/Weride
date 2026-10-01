import { Firestore, FieldValue } from '@google-cloud/firestore';
import { OAuth2Client } from 'google-auth-library';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1];
const project=args.includes('--project')?arg('--project'):null;
if(!project||!/^[a-z][a-z0-9-]{4,29}$/.test(project))throw new Error('Usage: npm run seed -- --project APPROVED_PROJECT_ID [--account APPROVED_GCLOUD_ACCOUNT]');
if(process.env.FIRESTORE_EMULATOR_HOST&&!project.startsWith('demo-'))throw new Error('Refusing production seed with FIRESTORE_EMULATOR_HOST set.');
const fixture=JSON.parse(await readFile(new URL('../private/seed.json',import.meta.url),'utf8'));
if(fixture.requirements.length!==30||new Set(fixture.requirements.map(r=>r.id)).size!==30)throw new Error('Invalid source fixture');
const account=args.includes('--account')?arg('--account'):null;
let authClient;
if(account){
  // Use the selected CLI identity in memory; never export a private key or persist/print tokens.
  authClient=new OAuth2Client({quotaProjectId:project});
  authClient.setCredentials({access_token:execFileSync('gcloud',['auth','print-access-token','--account',account],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(),expiry_date:Date.now()+3500000});
}
const db=new Firestore({projectId:project,...(authClient?{authClient}:{})});
const candidates=[{ref:db.doc('workspaces/weride'),data:fixture.project},...fixture.requirements.map(r=>({ref:db.doc(`workspaces/weride/requirements/${r.id}`),data:r})),...fixture.entries.map(e=>({ref:db.doc(`workspaces/weride/entries/${e.id}`),data:{...e,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()}}))];
try{
 // Respect explicitly retired seed questions; future provisioning must not resurrect them.
 const retirement=await db.doc('maintenance/retired-discovery-questions').get();
 const retired=retirement.exists?retirement.data().questionIds:[];
 if(!Array.isArray(retired)||retired.some(id=>typeof id!=='string'))throw new Error('Invalid seed retirement record; refusing to seed.');
 const retiredIds=new Set(retired);
 const docs=candidates.filter(d=>!(d.data.kind==='qa'&&d.data.origin==='proposal'&&retiredIds.has(d.data.id)));
 console.log(`Skipped ${candidates.length-docs.length} explicitly retired discovery questions.`);
 const existing=await db.getAll(...docs.map(d=>d.ref));const missing=docs.filter((_d,i)=>!existing[i].exists);
 if(args.includes('--dry-run'))console.log(`Project ${project}: would create ${missing.length} documents; preserve ${existing.length-missing.length}.`);
 else{if(missing.length){const batch=db.batch();for(const d of missing)batch.create(d.ref,d.data);await batch.commit();}console.log(`Seeded ${missing.length} new documents in ${project}. Existing project data and team changes were not overwritten.`);}
}finally{await db.terminate();}
