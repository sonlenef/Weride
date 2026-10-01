import {readFile,writeFile,mkdir,open} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {maintenanceApi,listDocuments,WORKSPACE,BASE,PROJECT,ACCOUNT,digest,str} from './maintenance-firestore.mjs';
const api=await maintenanceApi(),args=process.argv.slice(2);
const seed=JSON.parse(await readFile('private/seed.json','utf8'));
const seedIds=new Set(seed.entries.filter(e=>e.kind==='qa'&&e.origin==='proposal').map(e=>e.id));
const targetQuestion=(d,uids)=>str(d,'kind')==='qa'&&str(d,'origin')==='proposal'&&!uids.has(str(d,'createdBy'));
async function safeWrite(file,body){const handle=await open(file,'wx',0o600);try{await handle.writeFile(body);await handle.sync();}finally{await handle.close();}assert.equal(await readFile(file,'utf8'),body);}
if(args.length===0||args[0]==='--prepare'){
  const readTime=new Date(Date.now()-2000).toISOString();
  const parent=(await api.get(WORKSPACE,{queryParams:{readTime}})).body;
  const names=[];let pageToken;
  do{const {body}=await api.post(WORKSPACE+':listCollectionIds',{pageSize:100,readTime,...(pageToken?{pageToken}:{})});names.push(...(body.collectionIds||[]));pageToken=body.nextPageToken;}while(pageToken);
  const docs=[parent];for(const name of names)docs.push(...await listDocuments(api,WORKSPACE+'/'+name,readTime,true));
  assert(docs.every(d=>d.name===WORKSPACE||d.name.startsWith(WORKSPACE+'/')));
  const members=docs.filter(d=>d.name.startsWith(WORKSPACE+'/members/')),uids=new Set(members.map(d=>str(d,'uid')));
  const entries=docs.filter(d=>d.name.startsWith(WORKSPACE+'/entries/'));
  const targets=entries.filter(d=>targetQuestion(d,uids));
  assert.equal(targets.length,30,'Expected exactly the 30 original discovery questions; manual review required otherwise.');
  assert(targets.every(d=>str(d,'createdBy')==='seed'&&seedIds.has(str(d,'id'))&&d.updateTime));
  const dir=path.resolve('.backups/data/'+new Date().toISOString().replace(/[:.]/g,'-')+'-before-draft-qa-removal');
  await mkdir(dir,{recursive:true,mode:0o700});
  const raw=JSON.stringify({schema:'weride.workspace-raw-backup.v1',project:PROJECT,readTime,scope:WORKSPACE,collections:names,documents:docs},null,2)+'\n';
  await safeWrite(path.join(dir,'workspace.raw.json'),raw);
  await safeWrite(path.join(dir,'questions-to-remove.raw.json'),JSON.stringify({project:PROJECT,documents:targets},null,2)+'\n');
  const manifest={schema:1,operationId:randomUUID(),project:PROJECT,readTime,workspaceFile:'workspace.raw.json',workspaceSha256:digest(raw),targetPaths:targets.map(d=>d.name),counts:{documents:docs.length,questions:entries.filter(d=>str(d,'kind')==='qa').length,targetQuestions:targets.length,preservedQuestions:entries.filter(d=>str(d,'kind')==='qa').length-targets.length}};
  await safeWrite(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({mode:'backup-complete-no-deletion',backupDirectory:dir,...manifest.counts,sha256:manifest.workspaceSha256},null,2));
}else if(args[0]==='--apply'&&args[1]){
  const dir=path.resolve(args[1]);assert(dir.startsWith(path.resolve('.backups/data')+path.sep));
  const manifest=JSON.parse(await readFile(path.join(dir,'manifest.json'),'utf8'));
  const raw=await readFile(path.join(dir,'workspace.raw.json'),'utf8');assert.equal(digest(raw),manifest.workspaceSha256);assert.equal(manifest.project,PROJECT);
  const backup=JSON.parse(raw),targets=backup.documents.filter(d=>manifest.targetPaths.includes(d.name));
  assert.equal(targets.length,30);assert.equal(new Set(targets.map(d=>d.name)).size,30);
  const current=(await api.post(BASE+':batchGet',{documents:targets.map(d=>d.name)})).body;
  const live=current.map(r=>r.found).filter(Boolean);assert.equal(live.length,targets.length);
  const members=await listDocuments(api,WORKSPACE+'/members'),uids=new Set(members.map(d=>str(d,'uid')));
  for(const d of targets){const now=live.find(r=>r.name===d.name);assert(targetQuestion(now,uids)&&str(now,'createdBy')==='seed'&&seedIds.has(str(now,'id')));assert.equal(now.updateTime,d.updateTime,'Question changed after backup; abort.');}
  const writes=[];
  for(const d of targets){
    writes.push({delete:d.name,currentDocument:{updateTime:d.updateTime}});
    const id=randomUUID(),fields={id:{stringValue:id},action:{stringValue:'delete'},requirementId:d.fields.requirementId,entryId:d.fields.id,kind:{stringValue:'qa'},title:d.fields.title,actor:{stringValue:'admin:'+ACCOUNT},actorName:{stringValue:'Workspace administrator'},before:{mapValue:{fields:d.fields}},after:{nullValue:null}};
    writes.push({update:{name:WORKSPACE+'/activities/'+id,fields},currentDocument:{exists:false},updateTransforms:[{fieldPath:'at',setToServerValue:'REQUEST_TIME'}]});
  }
  const retired={operationId:{stringValue:manifest.operationId},questionIds:{arrayValue:{values:targets.map(d=>d.fields.id)}},backupSha256:{stringValue:manifest.workspaceSha256},executedBy:{stringValue:'admin:'+ACCOUNT},reason:{stringValue:'Owner requested removal of all Madison discovery-draft questions.'}};
  writes.push({update:{name:BASE+'/maintenance/retired-discovery-questions',fields:retired},currentDocument:{exists:false},updateTransforms:[{fieldPath:'deletedAt',setToServerValue:'REQUEST_TIME'}]});
  const result=(await api.post(BASE+':commit',{writes})).body;
  await safeWrite(path.join(dir,'deletion-receipt.json'),JSON.stringify({operationId:manifest.operationId,deleted:targets.length,commitTime:result.commitTime,writeCount:result.writeResults.length},null,2)+'\n');
  const entries=await listDocuments(api,WORKSPACE+'/entries');assert.equal(entries.filter(d=>targetQuestion(d,uids)).length,0);
  const old=backup.documents.filter(d=>d.name.startsWith(WORKSPACE+'/entries/')&&!manifest.targetPaths.includes(d.name));
  const unchanged=old.filter(d=>entries.some(now=>now.name===d.name&&now.updateTime===d.updateTime));
  assert.equal(unchanged.length,old.length,'An unrelated entry changed concurrently; inspect before reporting.');
  const report={deletedDraftQuestions:30,remainingQuestions:entries.filter(d=>str(d,'kind')==='qa').length,remainingDraftQuestions:0,unchangedOtherEntries:unchanged.length,breakdowns:entries.filter(d=>str(d,'kind')==='breakdown').length,assumptions:entries.filter(d=>str(d,'kind')==='assumption').length,backupDirectory:dir,commitTime:result.commitTime};
  await safeWrite(path.join(dir,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}else throw Error('Usage: --prepare, or --apply BACKUP_DIRECTORY.');
