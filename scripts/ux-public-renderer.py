from pathlib import Path
p=Path('functions/src/sharing.ts');s=p.read_text()
a=s.index('export function packHtml(');b=s.index('function unavailableHtml()',a)
code='''export function packHtml(pack:ReviewPack,token:string,expiresAt:string):string {
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
'''
code+='''  if(!tokenPattern.test(token))throw new PackError('SHARE_UNAVAILABLE',404);
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
'''
s=s[:a]+code+s[b:]
p.write_text(s)
print('Updated readable public snapshot framing, heading hierarchy and in-document navigation.')
