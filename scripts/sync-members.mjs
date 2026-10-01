import { Firestore, FieldValue } from '@google-cloud/firestore';
import { OAuth2Client } from 'google-auth-library';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];
const project=value('--project'),account=value('--account'),dry=args.includes('--dry-run');
if(!args.includes('--project')||project!=='weride-discovery'||!args.includes('--account')||!account||process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Use --project weride-discovery --account APPROVED_ACCOUNT [--dry-run].');
// Use the selected administrator token in memory. Never export auth records or credentials.
const token=execFileSync('gcloud',['auth','print-access-token','--account',account],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const authClient=new OAuth2Client({quotaProjectId:project});
authClient.setCredentials({access_token:token,expiry_date:Date.now()+3500000});
const db=new Firestore({projectId:project,authClient});
try{
  let pageToken='';const accounts=[];
  do{
    const url=new URL(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchGet`);
    url.searchParams.set('maxResults','1000');
    url.searchParams.set('fields','users(localId,displayName,email,disabled,providerUserInfo(providerId)),nextPageToken');
    if(pageToken)url.searchParams.set('nextPageToken',pageToken);
    const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`,'x-goog-user-project':project},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`Auth directory read failed (${response.status}). No writes performed.`);
    const page=await response.json();accounts.push(...(page.users||[]));pageToken=page.nextPageToken||'';
    if(accounts.length>100000)throw new Error('Unexpected directory size. No writes performed.');
  }while(pageToken);
  const existing=await db.collection('workspaces/weride/members').get();
  const old=new Map(existing.docs.map(d=>[d.id,d.data()]));
  const eligible=accounts.filter(u=>!u.disabled&&/^[a-z0-9._%+-]+@madison[.]dev$/i.test(u.email||'')&&u.providerUserInfo?.some(p=>p.providerId==='microsoft.com'));
  const activeUids=new Set(eligible.map(u=>u.localId));const writes=[];
  let created=0,updated=0,deactivated=0;
  for(const user of eligible){
    const uid=user.localId,previous=old.get(uid),email=user.email.toLowerCase(),displayName=(user.displayName?.trim()||email).slice(0,200);
    if(previous?.active===true&&previous.email===email&&previous.displayName===displayName&&previous.provider==='microsoft.com')continue;
    const data={uid,email,displayName,provider:'microsoft.com',active:true,createdAt:previous?.createdAt||FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()};
    writes.push({ref:db.doc(`workspaces/weride/members/${uid}`),data});if(previous)updated++;else created++;
  }
  for(const [uid,previous] of old){
    if(previous.active&&!activeUids.has(uid)){writes.push({ref:db.doc(`workspaces/weride/members/${uid}`),data:{...previous,active:false,updatedAt:FieldValue.serverTimestamp()}});deactivated++;}
  }
  console.log(JSON.stringify({mode:dry?'dry-run':'sync',authAccounts:accounts.length,eligibleMicrosoftMembers:eligible.length,directoryBefore:old.size,create:created,update:updated,deactivate:deactivated,requestedExampleAccountAvailable:eligible.some(u=>u.email.toLowerCase()==='son.le@madison.dev')},null,2));
  if(!dry&&writes.length){
    const directory=`.backups/member-directory-${new Date().toISOString().replace(/[:.]/g,'-')}`;await mkdir(directory,{recursive:true});
    await writeFile(`${directory}/members-before.json`,JSON.stringify(Object.fromEntries(old),null,2),{mode:0o600});
    for(let i=0;i<writes.length;i+=400){const batch=db.batch();for(const item of writes.slice(i,i+400))batch.set(item.ref,item.data);await batch.commit();}
    console.log('Minimal directory synchronized. Auth users, requirements, assignments and team work were NOT changed.');
  }
}finally{await db.terminate();}
