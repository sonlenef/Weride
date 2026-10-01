import cli from '/opt/homebrew/lib/node_modules/firebase-tools/lib/index.js';
import {Client} from '/opt/homebrew/lib/node_modules/firebase-tools/lib/apiv2.js';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const PROJECT='weride-discovery';
export const BASE=`projects/${PROJECT}/databases/(default)/documents`;
export const WORKSPACE=`${BASE}/workspaces/weride`;
export const ACCOUNT='sonledn98@gmail.com';
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const str=(doc,key)=>doc.fields?.[key]?.stringValue||'';
export async function maintenanceApi(){
  if(process.env.FIRESTORE_EMULATOR_HOST)throw Error('Production maintenance requires the emulator environment to be unset.');
  const rc=JSON.parse(await readFile('.firebaserc','utf8'));
  if(rc.projects.default!==PROJECT)throw Error('Unexpected project; refused.');
  // The official CLI handles the selected account. Never extract or persist credentials.
  await cli.firestore.databases.get('(default)',{project:PROJECT,account:ACCOUNT,cwd:process.cwd(),nonInteractive:true});
  return new Client({auth:true,apiVersion:'v1',urlPrefix:'https://firestore.googleapis.com'});
}
export async function listDocuments(api,collection,readTime,recursive=false){
  const documents=[];let pageToken;
  do{const params={pageSize:500,...(readTime?{readTime}:{}),...(recursive?{recursive:true}:{}),...(pageToken?{pageToken}:{})};
    const {body}=await api.get(collection,{queryParams:params});documents.push(...(body.documents||[]));pageToken=body.nextPageToken;
  }while(pageToken);
  return documents;
}
