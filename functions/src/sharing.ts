import { sessionIsCurrent } from './session-policy.js';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import MarkdownIt from 'markdown-it';
import { buildPack, packMarkdown, parseOptions, PackError, packFilename, scopeTitle } from './pack.js';
import type { ReviewPack, SourceWorkspace } from './pack.js';

export interface ShareRow {
  id:string; snapshotId:string; scope:string; createdAt:string; expiresAt:string;
  state:'active'|'revoked'; sourceHash:string; token?:string; ttlHours:number;
}
export interface StoredShare { pack?:ReviewPack; expiresAt:string; state:'active'|'revoked'; }
export interface ShareRepository {
  create(uid:string,requestId:string,pack:ReviewPack,ttlHours:number):Promise<ShareRow>;
  list(uid:string,cursor?:string):Promise<{items:ShareRow[];nextCursor:string|null}>;
  revoke(uid:string,id:string):Promise<void>;
  get(token:string):Promise<StoredShare|null>;
}
export interface SharingDependencies {
  verifyToken:(token:string)=>Promise<{uid:string;auth_time?:unknown;email?:string;firebase?:{sign_in_provider?:string}}>;
  loadWorkspace:()=>Promise<SourceWorkspace>;
  repository:ShareRepository;
  publicOrigin:string;
  allowedOrigins:string[];
  now?:()=>number;
}
const escapeHtml=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const md=new MarkdownIt({html:false,linkify:false,typographer:false}).disable(['image','link','autolink']);
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const css=`:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f5f7f3;color:#213c31;font:16px/1.7 system-ui,-apple-system,sans-serif}header{background:#173329;color:#e8f4df;padding:28px max(24px,calc((100vw - 1000px)/2))}header .brand{font-size:25px;font-weight:750;letter-spacing:-1px}header small{display:block;letter-spacing:3px;font-size:10px;text-transform:uppercase;color:#c8dfb3}main{max-width:1050px;padding:40px 24px 80px;margin:auto}.intro{background:white;border:1px solid #dbe6d5;border-radius:16px;padding:28px;margin-bottom:28px}.tag{display:inline-block;background:#e9f2e2;border-radius:5px;font-size:12px;padding:4px 9px;margin-right:8px}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.actions a{background:#285c47;color:white;text-decoration:none;border-radius:7px;padding:10px 16px;font-weight:650}.fine{font-size:13px;color:#586b5d}.warning{padding:16px;background:#faf5e6;border-left:3px solid #b2934d;font-size:14px}article{background:white;border:1px solid #dbe6d5;border-radius:16px;padding:36px}h1{font-size:30px;letter-spacing:-.6px;line-height:1.25}h2{margin-top:48px;padding-top:18px;border-top:1px solid #dbe6d5;font-size:24px;line-height:1.35}h3{font-size:19px;margin-top:30px}h4{font:650 15px ui-monospace,monospace;margin-top:25px}p,li{overflow-wrap:anywhere}pre{padding:16px 20px;background:#f5f8f2;border-left:3px solid #adc19a;border-radius:4px;white-space:pre-wrap;overflow-wrap:anywhere;tab-size:2}pre code{font:inherit;color:#2b4439}code{font-size:13px}ul{padding-left:25px}footer{font-size:12px;text-align:center;color:#66786c;margin-top:32px}@media(max-width:600px){main{padding:20px 14px}.intro,article{padding:20px}h1{font-size:25px}h2{font-size:21px}pre{padding:12px}body{font-size:15px}}@media print{body{background:white}.actions{display:none}article,.intro{border:0;padding:0}header{padding:10px;background:white;color:#173329}main{max-width:none;padding:0}pre{break-inside:avoid}h2,h3,h4{break-after:avoid}}`;
export function packHtml(pack:ReviewPack,token:string,expiresAt:string):string {
  const language=pack.content.options.language;
  const words={en:{read:'Read-only snapshot',raw:'Raw Markdown',download:'Download Markdown',warning:'Anyone with this link can read this snapshot until expiry or revocation. No Microsoft login is required. Workspace changes do not change this snapshot.',expires:'Expires',created:'Created',contents:'Contents',requirements:'requirements',matrix:'Complete matrix',footer:'No automatic edits, analytics or external scripts.'},vi:{read:'Bản chụp chỉ đọc',raw:'Xem Markdown',download:'Tải Markdown',warning:'Ai có link này đều đọc được bản chụp đến khi hết hạn hoặc bị thu hồi. Không cần đăng nhập Microsoft. Thay đổi workspace không làm thay đổi bản chụp.',expires:'Hết hạn',created:'Đã tạo',contents:'Mục lục',requirements:'yêu cầu',matrix:'Toàn bộ ma trận',footer:'Không tự chỉnh sửa, theo dõi hoặc tải script ngoài.'},sv:{read:'Skrivskyddad ögonblicksbild',raw:'Visa Markdown',download:'Hämta Markdown',warning:'Alla med länken kan läsa ögonblicksbilden tills den löper ut eller återkallas. Ingen Microsoft-inloggning krävs. Ändringar i arbetsytan ändrar inte denna ögonblicksbild.',expires:'Giltig till',created:'Skapad',contents:'Innehåll',requirements:'krav',matrix:'Hela matrisen',footer:'Inga automatiska ändringar, analyser eller externa skript.'}}[language];
  const title=pack.content.options.scope.kind==='all'?words.matrix:scopeTitle(pack.content.options.scope);
  const tokens=md.parse(packMarkdown(pack),{}),toc:string[]=[];let index=0;
  for(let i=0;i<tokens.length;i++){
    const token=tokens[i];if(token.type==='heading_open'){
      const level=Number(token.tag.slice(1)),anchor=`section-${++index}`;
      token.attrSet('id',anchor);token.tag=`h${Math.min(6,level+1)}`;
      if(level<=3)toc.push(`<li class="toc-depth-${level}"><a href="#${anchor}">${escapeHtml(tokens[i+1]?.content||anchor)}</a></li>`);
    }else if(token.type==='heading_close')token.tag=`h${Math.min(6,Number(token.tag.slice(1))+1)}`;
  }
  const rendered=md.renderer.render(tokens,md.options,{});
  const date=(value:string)=>{const parsed=new Date(value);return Number.isFinite(parsed.getTime())?new Intl.DateTimeFormat(language,{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Stockholm'}).format(parsed)+' · Europe/Stockholm':value;};
  const extra='.pack-toc{padding:18px 22px;border:1px solid #cad9c2;border-radius:10px;margin:22px 0;background:#fff}.pack-toc summary{font-weight:700;cursor:pointer;padding:8px 0}.pack-toc ol{padding-left:24px}.pack-toc li{margin:6px 0}.pack-toc a{color:#275238;text-decoration:underline;display:inline-block;padding:3px 0}.toc-depth-2{margin-left:16px!important}.toc-depth-3{margin-left:28px!important;font-size:14px}article h2,article h3,article h4{scroll-margin-top:20px}a:focus-visible,summary:focus-visible{outline:3px solid #155cac;outline-offset:3px}';
  if(!tokenPattern.test(token))throw new PackError('SHARE_UNAVAILABLE',404);
  const documentParts=[
    `<!doctype html><html lang="${language}"><head>`,
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><meta name="referrer" content="no-referrer">',
    `<title>${escapeHtml(title)} · WeRide AI Review Pack</title><style>${css}${extra}</style></head><body>`,
    '<header><span class="brand">weride</span><small>Discovery / AI Review Pack</small></header><main>',
    `<section class="intro"><span class="tag">${words.read}</span>`,
    `<span class="tag">${pack.content.coverage.targetIds.length} ${language==='en'&&pack.content.coverage.targetIds.length===1?'requirement':words.requirements}</span>`,
    `<h1>${escapeHtml(title)}</h1><p class="fine">Snapshot ${escapeHtml(pack.snapshotId)}<br>`,
    `${words.created}: <time datetime="${escapeHtml(pack.createdAt)}">${escapeHtml(date(pack.createdAt))}</time><br>`,
    `${words.expires}: <time datetime="${escapeHtml(expiresAt)}">${escapeHtml(date(expiresAt))}</time></p>`,
    `<p class="warning">${words.warning}</p><nav class="actions">`,
    `<a href="/s/${token}/context.md">${words.raw}</a>`,
    `<a href="/s/${token}/context.md?download=1" download>${words.download}</a></nav></section>`,
    `<details class="pack-toc" ${pack.content.requirements.length<5?'open':''}><summary>${words.contents}</summary>`,
    `<nav aria-label="${words.contents}"><ol>${toc.join('')}</ol></nav></details><article>${rendered}</article>`,
    `<footer>Madison Technologies · WeRide Discovery · ${words.footer}</footer></main></body></html>`,
  ];
  return documentParts.join('');
}
function unavailableHtml():string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link unavailable · WeRide</title><style>${css}</style></head><body><header><span class="brand">weride</span><small>AI Review Pack</small></header><main><section class="intro"><h1>This review link is unavailable</h1><p>It may have expired, been revoked, or be invalid. Ask the person who shared it for a new link.</p><p>No workspace content is included in this response.</p></section></main></body></html>`;
}
export function createSharingApp(deps:SharingDependencies) {
  const app=express();app.disable('x-powered-by');app.disable('etag');
  app.use((_req,res,next)=>{
    res.set({'Cache-Control':'private, no-store, max-age=0, must-revalidate','CDN-Cache-Control':'no-store','Pragma':'no-cache','Expires':'0','X-Robots-Tag':'noindex, nofollow, noarchive, nosnippet','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});next();
  });
  app.use(express.json({limit:'32kb',strict:true}));
  const authenticate=async(req:Request)=>{
    if(req.headers.origin&&!deps.allowedOrigins.includes(req.headers.origin))throw new PackError('FORBIDDEN',403);
    const match=/^Bearer (\S{20,8192})$/.exec(req.headers.authorization||'');
    if(!match)throw new PackError('AUTH_REQUIRED',401);
    let user;try{user=await deps.verifyToken(match[1]);}catch{throw new PackError('AUTH_REQUIRED',401);}
    // Preserve the approved direct-Microsoft SSO model. No additional verification email.
    if(!user.uid||!user.email||!(/^[a-z0-9._%+-]+@madison[.]dev$/i.test(user.email))||user.firebase?.sign_in_provider!=='microsoft.com')throw new PackError('FORBIDDEN',403);
    if(!sessionIsCurrent(user,(deps.now||Date.now)()))throw new PackError('AUTH_REQUIRED',401);
    return user;
  };
  const serializeRow=(r:ShareRow)=>({...r,token:undefined,url:r.token&&r.state==='active'?`${deps.publicOrigin}/s/${r.token}`:undefined});
  app.use(async(req,res,next)=>{
    try{
      const path=req.path;
      if(path==='/api/review-packs/status'&&req.method==='GET'){res.json({service:'weride-review-sharing',version:1,available:true});return;}
      if(path.startsWith('/s/')){
        if(!['GET','HEAD'].includes(req.method)){res.status(405).set('Allow','GET, HEAD').send('Method not allowed');return;}
        const match=/^\/s\/([A-Za-z0-9_-]{43})(\/context\.md)?\/?$/.exec(path);
        if(!match||!tokenPattern.test(match[1])){res.status(404).type('html').send(unavailableHtml());return;}
        const row=await deps.repository.get(match[1]),now=(deps.now||Date.now)();
        if(!row){res.status(404).type('html').send(unavailableHtml());return;}
        if(row.state!=='active'||Date.parse(row.expiresAt)<=now||!row.pack){res.status(410).type('html').send(unavailableHtml());return;}
        const markdown=Boolean(match[2])||String(req.headers.accept).includes('text/markdown');
        if(markdown){res.type('text/markdown; charset=utf-8');if(req.query.download==='1')res.set('Content-Disposition',`attachment; filename="${packFilename(row.pack)}"`);res.send(packMarkdown(row.pack));}
        else res.type('html').send(packHtml(row.pack,match[1],row.expiresAt));
        return;
      }
      if(!path.startsWith('/api/review-packs/')){res.status(404).json({error:'NOT_FOUND'});return;}
      const user=await authenticate(req);
      if(path==='/api/review-packs/shares'&&req.method==='POST'){
        if(!req.is('application/json'))throw new PackError('VALIDATION',415);
        const b=req.body as Record<string,unknown>;
        if(!b||Object.keys(b).some(k=>!['options','snapshotId','expectedSourceHash','requestId','ttlHours','acknowledgeDisclosure'].includes(k))||b.acknowledgeDisclosure!==true||!uuidPattern.test(String(b.requestId))||!uuidPattern.test(String(b.snapshotId))||!/^[a-f0-9]{64}$/.test(String(b.expectedSourceHash))||![1,24,168,720].includes(Number(b.ttlHours))||typeof b.ttlHours!=='number')throw new PackError('VALIDATION');
        const options=parseOptions(b.options);
        const pack=await buildPack(await deps.loadWorkspace(),options,String(b.snapshotId) as `${string}-${string}-${string}-${string}-${string}`);
        if(pack.sourceHash!==b.expectedSourceHash)throw new PackError('CONTEXT_CHANGED',409);
        const created=await deps.repository.create(user.uid,String(b.requestId),pack,b.ttlHours);
        res.status(201).json(serializeRow(created));return;
      }
      if(path==='/api/review-packs/shares'&&req.method==='GET'){
        const cursor=req.query.cursor;
        if(cursor!==undefined&&(typeof cursor!=='string'||!uuidPattern.test(cursor)))throw new PackError('VALIDATION');
        const result=await deps.repository.list(user.uid,cursor as string|undefined);
        res.json({...result,items:result.items.map(serializeRow)});return;
      }
      const revoke=/^\/api\/review-packs\/shares\/([a-f0-9-]{36})\/revoke$/.exec(path);
      if(revoke&&req.method==='POST'){
        if(!uuidPattern.test(revoke[1]))throw new PackError('VALIDATION');
        await deps.repository.revoke(user.uid,revoke[1]);res.json({ok:true});return;
      }
      res.status(404).json({error:'NOT_FOUND'});
    }catch(error){next(error);}
  });
  app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    const e=error as {type?:string};
    if(error instanceof PackError){res.status(error.httpStatus).json({error:error.code});return;}
    if(e.type==='entity.too.large'){res.status(413).json({error:'PACK_TOO_LARGE'});return;}
    if(e.type==='entity.parse.failed'){res.status(400).json({error:'VALIDATION'});return;}
    console.error('Review sharing request failed. Request content and credentials omitted.');
    res.status(500).json({error:'UNAVAILABLE'});
  });
  return app;
}
