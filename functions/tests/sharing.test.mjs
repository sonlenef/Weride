import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createSharingApp,packHtml} from '../lib/sharing.js';
import {buildPack,defaultOptions,PackError,packMarkdown} from '../lib/pack.js';
const loc=en=>({en,vi:'',sv:''});
const source=()=>({project:{id:'weride',name:'Synthetic WeRide',client:'Synthetic Client',reference:'SYNTHETIC-TEST',sourceFile:'synthetic.txt',summary:loc('Only synthetic test data.'),fleetReference:1,fleetReferencePage:1,milestones:[],clarifications:[]},requirements:[{id:'FN-TEST-01',module:'A',tier:'L1',title:loc('Synthetic requirement'),description:loc('Test a booking.'),sourcePage:1,sourceSection:'Test',order:1}],entries:[],reviews:[]});
class MemoryRepository {
  rows=new Map();owners=new Map();
  async create(uid,id,pack,ttl){
    const key=uid+':'+id;if(this.owners.has(key))return this.owners.get(key);
    const token=randomBytes(32).toString('base64url'),row={id,snapshotId:pack.snapshotId,scope:pack.content.options.scope.id||'Complete matrix',createdAt:pack.createdAt,expiresAt:new Date(Date.now()+ttl*3600000).toISOString(),state:'active',sourceHash:pack.sourceHash,token,ttlHours:ttl};
    this.owners.set(key,row);this.rows.set(token,{pack:structuredClone(pack),state:'active',expiresAt:row.expiresAt});return row;
  }
  async list(uid){return {items:[...this.owners].filter(([k])=>k.startsWith(uid+':')).map(([,v])=>v),nextCursor:null};}
  async revoke(uid,id){const row=this.owners.get(uid+':'+id);if(!row)throw new PackError('SHARE_UNAVAILABLE',404);this.rows.set(row.token,{state:'revoked',expiresAt:row.expiresAt});row.state='revoked';delete row.token;}
  async get(token){return this.rows.get(token)||null;}
}
async function setup(t){
  const d=source(),repo=new MemoryRepository();let now=Date.now();const authTime=Math.floor(now/1000);
  const app=createSharingApp({publicOrigin:'https://weride-discovery.web.app',allowedOrigins:['https://weride-discovery.web.app'],repository:repo,loadWorkspace:async()=>d,now:()=>now,
    verifyToken:async token=>{if(token==='bad-token-00000000000000')throw Error();return {auth_time:authTime,uid:token.startsWith('other')?'other':'member',email:token.startsWith('foreign')?'a@other.dev':'a@madison.dev',firebase:{sign_in_provider:token.startsWith('google')?'google.com':'microsoft.com'},email_verified:false};}});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
  const base=`http://127.0.0.1:${server.address().port}`,headers={Authorization:'Bearer member-token-00000000000000','Content-Type':'application/json'};
  const pack=await buildPack(d,defaultOptions());
  const body={options:pack.content.options,snapshotId:pack.snapshotId,expectedSourceHash:pack.sourceHash,requestId:crypto.randomUUID(),ttlHours:1,acknowledgeDisclosure:true};
  const create=()=>fetch(base+'/api/review-packs/shares',{method:'POST',headers,body:JSON.stringify(body)});
  return {d,repo,base,headers,body,pack,create,advance:ms=>now+=ms};
}
test('status is public and all management operations require authorization',async t=>{const s=await setup(t);assert.equal((await fetch(s.base+'/api/review-packs/status')).status,200);for(const [path,method] of [['shares','GET'],['shares','POST'],[`shares/${s.body.requestId}/revoke`,'POST']])assert.equal((await fetch(s.base+'/api/review-packs/'+path,{method})).status,401);});
test('Microsoft exact-domain identity can create with email_verified false, and receives a read-only random link',async t=>{const s=await setup(t),r=await s.create();assert.equal(r.status,201);const row=await r.json();assert.match(row.url,/\/s\/[A-Za-z0-9_-]{43}$/);assert.equal(row.token,undefined);assert.equal(row.sourceHash,s.pack.sourceHash);});
for(const token of ['bad-token-00000000000000','foreign-token-00000000000000','google-token-00000000000000'])test(`rejects ineligible token ${token.split('-')[0]}`,async t=>{const s=await setup(t),r=await fetch(s.base+'/api/review-packs/shares',{headers:{Authorization:'Bearer '+token}});assert.ok([401,403].includes(r.status));});
test('blocks cross-origin management even with a token',async t=>{const s=await setup(t);const r=await fetch(s.base+'/api/review-packs/shares',{headers:{...s.headers,Origin:'https://unrelated.example'}});assert.equal(r.status,403);});
test('requires explicit disclosure, bounded lifetime and strict option schema',async t=>{for(const override of [{acknowledgeDisclosure:false},{ttlHours:0},{ttlHours:10000},{rawMarkdown:'INJECTED'},{requestId:'../other'}]){const s=await setup(t);const r=await fetch(s.base+'/api/review-packs/shares',{method:'POST',headers:s.headers,body:JSON.stringify({...s.body,...override})});assert.equal(r.status,400);assert.equal(s.repo.rows.size,0);}});
test('rejects stale preview without publishing',async t=>{const s=await setup(t);s.d.requirements[0].description.en+=' Modified';const r=await s.create();assert.equal(r.status,409);assert.equal((await r.json()).error,'CONTEXT_CHANGED');assert.equal(s.repo.rows.size,0);});
test('HTML is readable without JS and Markdown contains the same full snapshot',async t=>{const s=await setup(t),row=await(await s.create()).json(),path=new URL(row.url).pathname;const html=await fetch(s.base+path),text=await html.text();assert.equal(html.status,200);assert.match(html.headers.get('cache-control'),/no-store/);assert.match(html.headers.get('x-robots-tag'),/noindex/);assert.equal(html.headers.get('referrer-policy'),'no-referrer');assert.ok(text.includes(s.pack.snapshotId));assert.ok(text.includes('Synthetic requirement'));assert.ok(text.includes('END OF WERIDE REVIEW PACK'));assert.ok(!text.includes('<script'));const raw=await fetch(s.base+path+'/context.md');assert.match(raw.headers.get('content-type'),/text\/markdown/);assert.ok((await raw.text()).includes(s.pack.sourceHash));});
test('Accept text/markdown and download disposition are supported',async t=>{const s=await setup(t),row=await(await s.create()).json(),path=new URL(row.url).pathname;const raw=await fetch(s.base+path,{headers:{Accept:'text/markdown'}});assert.match(raw.headers.get('content-type'),/text\/markdown/);const dl=await fetch(s.base+path+'/context.md?download=1');assert.match(dl.headers.get('content-disposition'),/attachment; filename="weride-/);});
test('snapshot does not change when live source is edited',async t=>{const s=await setup(t),row=await(await s.create()).json(),path=new URL(row.url).pathname;const before=await(await fetch(s.base+path+'/context.md')).text();s.d.requirements[0].title.en='CHANGED LIVE';const after=await(await fetch(s.base+path+'/context.md')).text();assert.equal(before,after);});
test('expired links return no source content and no cacheable response',async t=>{const s=await setup(t),row=await(await s.create()).json();s.advance(2*3600000);const r=await fetch(s.base+new URL(row.url).pathname);assert.equal(r.status,410);assert.match(r.headers.get('cache-control'),/no-store/);assert.ok(!(await r.text()).includes('Synthetic requirement'));});
test('revocation is owner-only, removes shared content, and blocks HTML and Markdown',async t=>{const s=await setup(t),row=await(await s.create()).json();const wrong=await fetch(s.base+`/api/review-packs/shares/${row.id}/revoke`,{method:'POST',headers:{...s.headers,Authorization:'Bearer other-token-00000000000000'}});assert.equal(wrong.status,404);const good=await fetch(s.base+`/api/review-packs/shares/${row.id}/revoke`,{method:'POST',headers:s.headers});assert.equal(good.status,200);for(const suffix of ['','/context.md'])assert.equal((await fetch(s.base+new URL(row.url).pathname+suffix)).status,410);assert.equal([...s.repo.rows.values()][0].pack,undefined);});
test('owners cannot list other members links',async t=>{const s=await setup(t);await s.create();const other=await fetch(s.base+'/api/review-packs/shares',{headers:{Authorization:'Bearer other-token-00000000000000'}});assert.deepEqual((await other.json()).items,[]);});
test('invalid share paths cannot enumerate private data or execute writes',async t=>{const s=await setup(t);for(const path of ['/s/FN-TEST-01','/s/short','/s/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']){const r=await fetch(s.base+path);assert.equal(r.status,404);assert.ok(!(await r.text()).includes('Synthetic requirement'));}assert.equal((await fetch(s.base+'/s/'+'a'.repeat(43),{method:'POST'})).status,405);});
test('unsafe source HTML/Markdown cannot inject executable content or outbound images',async t=>{const s=await setup(t);s.d.requirements[0].title.en='<img src=x onerror=alert(1)>';s.d.requirements[0].description.en='```\n<script>alert(2)</script>\n![exfil](https://example.test/pixel)';const p=await buildPack(s.d,defaultOptions());const html=packHtml(p,'a'.repeat(43),new Date().toISOString());assert.ok(!html.includes('<script'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(packMarkdown(p).includes('````text'));});

test('authenticated sharing operations require login again after 24 hours',async t=>{
  const s=await setup(t);await s.create();s.advance(86_400_000);
  for(const [path,method] of [['shares','GET'],['shares','POST'],[`shares/${s.body.requestId}/revoke`,'POST']]){
    const response=await fetch(s.base+'/api/review-packs/'+path,{method,headers:s.headers,...(method==='POST'?{body:JSON.stringify(s.body)}:{})});
    assert.equal(response.status,401);assert.equal((await response.json()).error,'AUTH_REQUIRED');
  }
});
test('public snapshot availability depends on its own lifetime, not creator login age',async t=>{
  const s=await setup(t);s.body.ttlHours=168;
  const row=await(await s.create()).json();s.advance(25*3600000);
  const publicPage=await fetch(s.base+new URL(row.url).pathname);
  assert.equal(publicPage.status,200);
  assert.equal((await fetch(s.base+'/api/review-packs/shares',{headers:s.headers})).status,401);
});
