import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
// Source data must live behind Firestore authorization, never inside public JavaScript.
async function visit(dir){const out=[];for(const item of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())out.push(...await visit(p));else out.push(p);}return out;}
const files=await visit('dist');
const forbidden=['Support ride requests from mobile apps, web dispatch console','olle@weride.eu','Secure storage capturing reportable driver data','private/seed.json','private/review-context.json','The specified interconnected subsystems are:','/__dev/seed','weride.local-preview.v1'];
for(const f of files){if(/\.(pdf|map)$/i.test(f))throw new Error(`Private/source-map asset in production: ${f}`);if(/\.(js|html|json|css)$/.test(f)){const body=await readFile(f,'utf8');for(const term of forbidden)if(body.includes(term))throw new Error(`Private fixture/development marker in public bundle: ${term}`);}}
console.log(`PASS: ${files.length} public assets checked; no RFP fixture, PDF or development seed endpoint is published.`);
