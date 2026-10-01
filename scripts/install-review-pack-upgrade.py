from pathlib import Path
import json, shutil, datetime
root=Path.cwd()
assert root.name=='weride' and json.loads((root/'.firebaserc').read_text())['projects']['default']=='weride-discovery'
backup=root/'.backups'/('ai-review-pack-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True)
changed=[]
def edit(name,old,new):
 p=root/name;s=p.read_text()
 if old not in s:
  if new in s:return
  raise RuntimeError('Patch anchor not found: '+name+' / '+old[:75])
 target=backup/name;target.parent.mkdir(parents=True,exist_ok=True)
 if not target.exists():shutil.copy2(p,target)
 p.write_text(s.replace(old,new,1));changed.append(name)
def save_json(name,mutate):
 p=root/name;obj=json.loads(p.read_text());target=backup/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target);mutate(obj);p.write_text(json.dumps(obj,indent=2)+'\n');changed.append(name)
# Pure data contract copy for the shared generator; no application runtime or secrets.
(root/'functions/src/workspace-types.ts').write_text((root/'src/lib/types.ts').read_text())
edit('src/lib/types.ts',"export type Locale", "import type { ReviewContext } from '../../functions/src/pack';\nexport type Locale")
edit('src/lib/types.ts','activities: Activity[]; }','activities: Activity[]; reviewContext?: ReviewContext | null; }')
edit('src/lib/i18n.ts',"import i18n from 'i18next';", "import i18n from 'i18next';\nimport { reviewDictionary } from './review-i18n';")
edit('src/lib/i18n.ts','const dictionary: Record<string, [string, string, string]> = {','const dictionary: Record<string, [string, string, string]> = {\n  ...reviewDictionary,')
edit('src/lib/store.tsx','ready.size===5','ready.size===6')
edit('src/lib/store.tsx','loaded=cached;','loaded={...cached,reviewContext:seed.reviewContext||null};')
edit('src/lib/store.tsx','const stops=[onSnapshot(',"const stops=[onSnapshot(doc(db,base,'context','ai-review'),snap=>update('reviewContext',snap.exists()?decode(snap.data()):null),fail),onSnapshot(")
edit('vite.config.ts',"res.end(await readFile(new URL('./private/seed.json', import.meta.url), 'utf8'));", "res.end(JSON.stringify({...JSON.parse(await readFile(new URL('./private/seed.json', import.meta.url), 'utf8')),reviewContext:JSON.parse(await readFile(new URL('./private/review-context.json',import.meta.url),'utf8'))}));")
edit('src/pages/Requirement.tsx',"import { useEffect, useState } from 'react';", "import { useEffect, useState } from 'react';\nimport ReviewPackButton from '../components/ReviewPackButton';")
edit('src/pages/Requirement.tsx','</Link></div></div>\n    <section className="source-card">','</Link><ReviewPackButton requirementId={r.id}/></div></div>\n    <section className="source-card">')
edit('src/pages/Matrix.tsx',"import { useState } from 'react';", "import { useState } from 'react';\nimport ReviewPackButton from '../components/ReviewPackButton';")
edit('src/pages/Matrix.tsx','<div className="export-control">','<div className="ai-page-actions"><ReviewPackButton module={module}/><div className="export-control">')
edit('src/pages/Matrix.tsx','</div>}</div></div>\n    <div className="matrix-summary">','</div>}</div></div></div>\n    <div className="matrix-summary">')
edit('src/App.tsx',"import { useState } from 'react';", "import { useState, lazy, Suspense } from 'react';")
edit('src/App.tsx',"function Gate(","const ReviewPacks=lazy(()=>import('./pages/ReviewPacks'));\nfunction Gate(")
edit('src/App.tsx','<Route path="system" element={<SystemPage/>}/>','<Route path="review-packs" element={<Suspense fallback={<Spinner/>}><ReviewPacks/></Suspense>}/><Route path="system" element={<SystemPage/>}/>')
edit('src/components/Shell.tsx','import { Activity,','import { FileSparkles, Activity,')
edit('src/components/Shell.tsx',"{to:'/system',label:'system',icon:Network}","{to:'/review-packs',label:'aiPacks',icon:FileSparkles},{to:'/system',label:'system',icon:Network}")
edit('firestore.rules','match /requirements/{id} { allow read: if member(); allow write: if false; }','match /requirements/{id} { allow read: if member(); allow write: if false; }\n      // Source-referenced context is provisioned by an administrator; clients cannot amend it.\n      match /context/{id} { allow read: if member(); allow write: if false; }')
edit('firestore.rules','match /{document=**} { allow read, write: if false; }','// Shares, bearer secrets, owner indexes and limits are server-only. No public Firestore grants.\n    match /reviewShares/{document=**} { allow read, write: if false; }\n    match /reviewShareOwners/{document=**} { allow read, write: if false; }\n    match /reviewShareLimits/{document=**} { allow read, write: if false; }\n    match /{document=**} { allow read, write: if false; }')
edit('scripts/check-bundle.mjs',"'private/seed.json',","'private/seed.json','private/review-context.json','The specified interconnected subsystems are:',")
edit('playwright.config.ts',"'auth-direct-sso.spec.ts'","'auth-direct-sso.spec.ts','review-pack.spec.ts'")
p=root/'vitest.config.ts';s=p.read_text();
if "'tests/review-pack.test.ts'" not in s:edit('vitest.config.ts',"'tests/access.test.ts'","'tests/access.test.ts','tests/review-pack.test.ts'")
def package(o):
 o['scripts'].update({'seed:review-context':'node scripts/seed-review-context.mjs','test:review-api':'npm --prefix functions test','test:review-integration':"firebase emulators:exec --only firestore --project demo-weride 'npm --prefix functions run test:integration'",'deploy:review-sharing':'node scripts/deploy-review-sharing.mjs'})
save_json('package.json',package)
def function_package(o):o['scripts']['test:integration']='npm run build && node --test tests/repository.integration.mjs'
save_json('functions/package.json',function_package)
def firebase(o):
 o['functions']=[{'source':'functions','codebase':'review-sharing','ignore':['node_modules','.git','*-debug.log','tests','*.local'],'predeploy':['npm --prefix "$RESOURCE_DIR" run build']}]
 for path in ['/s/**','/api/review-packs/**']:
  if not any(h.get('source')==path for h in o['hosting'].get('headers',[])):
   o['hosting']['headers'].append({'source':path,'headers':[{'key':'Cache-Control','value':'private, no-store, max-age=0, must-revalidate'},{'key':'X-Robots-Tag','value':'noindex, nofollow, noarchive, nosnippet'},{'key':'Referrer-Policy','value':'no-referrer'}]})
save_json('firebase.json',firebase)
def indexes(o):
 f=o.setdefault('fieldOverrides',[])
 if not any(x.get('collectionGroup')=='reviewShares' and x.get('fieldPath')=='pack' for x in f):f.append({'collectionGroup':'reviewShares','fieldPath':'pack','indexes':[]})
save_json('firestore.indexes.json',indexes)
with (root/'src/styles.css').open('a') as f:f.write('\n/* AI Review Pack entry points (available before the lazy-loaded pack page). */\n.ai-page-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.detail-meta>.ai-review-button{margin-left:auto}.ai-review-button{text-decoration:none!important;white-space:nowrap}@media(max-width:850px){.detail-meta>.ai-review-button{margin-left:0}.ai-page-actions{justify-content:flex-start}}\n')
with (root/'.gitignore').open('a') as f:f.write('\nfunctions/node_modules/\nfunctions/lib/\n.review-upgrade-transfer*\n.firebase.review-sharing.json\n')
with (root/'tests/firestore.rules.test.mjs').open('a') as f:f.write('''\ntest('review context is readable only by Microsoft members and immutable to clients',async()=>{const member=context(),anon=env.unauthenticatedContext().firestore();await assertSucceeds(getDoc(doc(member,'workspaces/weride/context/ai-review')));await assertFails(getDoc(doc(anon,'workspaces/weride/context/ai-review')));await assertFails(setDoc(doc(member,'workspaces/weride/context/ai-review'),{version:99}));});
for(const path of ['reviewShares/private-token-hash','reviewShareOwners/reviewer/links/private-link','reviewShareLimits/reviewer-2026-09-29'])test(`server-only review storage is closed: ${path}`,async()=>{for(const db of [context(),env.unauthenticatedContext().firestore()]){await assertFails(getDoc(doc(db,path)));await assertFails(setDoc(doc(db,path),{public:true}));}});
''')
print('Installed AI Review Pack integration. Existing-source backups:',backup)
print('Patched:',', '.join(sorted(set(changed))))
