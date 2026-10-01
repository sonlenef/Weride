import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Check, Clipboard, Download, Sparkles, Link2, LoaderCircle, RefreshCw, ShieldCheck, Unlink } from 'lucide-react';
import { useWorkspace } from '../lib/store';
import { useAuth } from '../lib/auth';
import { text } from '../lib/i18n';
import { download } from '../lib/helpers';
import { Badge, Modal, useToast } from '../components/ui';
import { buildPack, defaultOptions, packFilename, packMarkdown, reviewPrompt } from '../../functions/src/pack';
import type { Language, PackOptions, ReviewPack, Scope } from '../../functions/src/pack';
import { createSharedLink, listSharedLinks, revokeSharedLink, reviewErrorKey, sharingState } from '../lib/review-api';
import type { SharedLink } from '../lib/review-api';
import './review-packs.css';

function initialScope(params:URLSearchParams):Scope{
  const id=params.get('requirement'),module=params.get('module');
  return id?{kind:'requirement',id,relatedIds:[]}:module&&['A','B','C'].includes(module)?{kind:'module',id:module,relatedIds:[]}:{kind:'all',id:'',relatedIds:[]};
}
export default function ReviewPacks(){
  const {data,online}=useWorkspace(),{preview}=useAuth(),{t,i18n}=useTranslation(),toast=useToast();
  const [params,setParams]=useSearchParams();
  const [options,setOptions]=useState<PackOptions>(()=>defaultOptions(initialScope(params)));
  const [pack,setPack]=useState<ReviewPack|null>(null),[building,setBuilding]=useState(true),[error,setError]=useState('');
  const [tab,setTab]=useState<'prepare'|'links'>('prepare'),[ready,setReady]=useState<boolean|null>(null);
  const [serviceState,setServiceState]=useState('checking'),[healthAttempt,setHealthAttempt]=useState(0);
  const [ttl,setTtl]=useState(168),[ack,setAck]=useState(false),[busy,setBusy]=useState(false),[created,setCreated]=useState<SharedLink|null>(null);
  const [links,setLinks]=useState<SharedLink[]>([]),[next,setNext]=useState<string|null>(null),[linksLoading,setLinksLoading]=useState(false),[revoke,setRevoke]=useState<SharedLink|null>(null);
  const generation=useRef(0),requestKey=useRef({signature:'',id:''}),contentRef=useRef<HTMLTextAreaElement>(null),dataRef=useRef(data);dataRef.current=data;
  const d=data!;
  const optionsRef=useRef(options);optionsRef.current=options;
  const refresh=async()=>{
    const id=++generation.current;setBuilding(true);setError('');setCreated(null);setAck(false);
    try{const result=await buildPack(dataRef.current!,optionsRef.current);if(id===generation.current)setPack(result);}
    catch(e){if(id===generation.current){setPack(null);setError(reviewErrorKey(e));}}
    finally{if(id===generation.current)setBuilding(false);}
  };
  // Deliberately freeze a preview until its options change or the user refreshes it.
  useEffect(()=>{void refresh();return()=>{generation.current++;};},[options]);
  useEffect(()=>{const controller=new AbortController();if(preview){setReady(false);return;}
    setReady(null);setServiceState('checking');void sharingState(controller.signal).then(v=>{if(!controller.signal.aborted){setReady(v==='available');setServiceState(v);}});return()=>controller.abort();
  },[preview,online,healthAttempt]);
  const serviceMessage=serviceState==='offline'?'uxSharingOffline':serviceState==='unauthorized'?'uxSharingAuth':serviceState==='checking'?'uxChecking':'uxSharingUnavailable';
  const serviceNotice=<div className="ai-checking-state" role="status"><p>{t(preview?'aiLocalOnly':serviceMessage)}</p>{!preview&&<button className="button secondary small" disabled={ready===null} onClick={()=>setHealthAttempt(n=>n+1)}>{t('retry')}</button>}</div>;
  const scopeParam=params.get('requirement')||params.get('module')||'';
  useEffect(()=>{const scope=initialScope(params);setOptions(o=>o.scope.kind===scope.kind&&o.scope.id===scope.id?o:{...o,scope,excludedEntryIds:[],excludedDecisionIds:[]});},[scopeParam]);
  useEffect(()=>{document.title='AI Review Packs · WeRide';return()=>{document.title='WeRide · Discovery Workspace';};},[]);
  const markdown=useMemo(()=>pack?packMarkdown(pack):'',[pack]);
  const selectedIds=new Set(d.requirements.filter(r=>options.scope.kind==='all'||(options.scope.kind==='module'?r.module===options.scope.id:r.id===options.scope.id)||options.scope.relatedIds.includes(r.id)).map(r=>r.id));
  const selectableItems=d.entries.filter(e=>(selectedIds.has(e.requirementId)||(options.includeGeneralQa&&e.kind==='qa'&&e.requirementId===''))&&(e.kind==='qa'?options.includeQa:e.kind==='breakdown'?options.includeBreakdown:options.includeAssumptions));
  const selectedItemCount=selectableItems.filter(e=>!options.excludedEntryIds.includes(e.id)).length;
  const eligibleDecisions=(d.decisions||[]).filter(x=>!x.requirementIds.length||x.requirementIds.some(id=>selectedIds.has(id)));
  const change=(patch:Partial<PackOptions>)=>setOptions(o=>({...o,...patch,...(patch.includeGeneralQa===true?{includeQa:true}:{}),...(patch.includeQa===false?{includeGeneralQa:false}:{})}));
  const scopeValue=options.scope.kind==='all'?'all':`${options.scope.kind}:${options.scope.id}`;
  const setScope=(value:string)=>{const [kind,id]=value.split(':');const scope={kind:kind as Scope['kind'],id:id||'',relatedIds:[]};setOptions(o=>({...o,scope,excludedEntryIds:[],excludedDecisionIds:[]}));const q=new URLSearchParams();if(preview)q.set('preview','1');if(scope.kind==='requirement')q.set('requirement',scope.id);if(scope.kind==='module')q.set('module',scope.id);setParams(q,{replace:true});};
  const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value);toast(t('aiCopied'));}catch{setError('aiCopyFallback');contentRef.current?.focus();contentRef.current?.select();}};
  const loadLinks=async(append=false)=>{if(!ready||preview)return;setLinksLoading(true);setError('');try{const res=await listSharedLinks(append?next||undefined:undefined);setLinks(old=>append?[...old,...res.items]:res.items);setNext(res.nextCursor);}catch(e){setError(reviewErrorKey(e));}finally{setLinksLoading(false);}};
  useEffect(()=>{if(tab==='links')void loadLinks();},[tab,ready]);
  const share=async()=>{
    if(!pack||!ack||busy||!ready||preview||!online)return;
    setBusy(true);setError('');
    const signature=`${pack.snapshotId}:${ttl}`;if(requestKey.current.signature!==signature)requestKey.current={signature,id:crypto.randomUUID()};
    try{const result=await createSharedLink({options:pack.content.options,snapshotId:pack.snapshotId,expectedSourceHash:pack.sourceHash,requestId:requestKey.current.id,ttlHours:ttl,acknowledgeDisclosure:ack});setCreated(result);toast(t('aiLinkCreated'));}
    catch(e){setError(reviewErrorKey(e));}finally{setBusy(false);}
  };
  const revokeLink=async()=>{if(!revoke)return;setBusy(true);setError('');try{await revokeSharedLink(revoke.id);if(created?.id===revoke.id)setCreated(null);setRevoke(null);await loadLinks();toast(t('aiRevokedDone'));}catch(e){setError(reviewErrorKey(e));}finally{setBusy(false);}};
  const formatTime=(v:string)=>new Intl.DateTimeFormat(i18n.language,{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
  return <div className="page-enter ai-page">
    <div className="page-heading"><div><span className="eyebrow">DISCOVERY / AI REVIEW</span><h1>{t('aiTitle')}</h1><p>{t('aiSubtitle')}</p></div><span className="ai-page-mark"><Sparkles size={30}/></span></div>
    <nav className="ai-tabs" aria-label={t('aiPacks')}><button aria-current={tab==='prepare'?'page':undefined} onClick={()=>setTab('prepare')}><Sparkles size={16}/>{t('aiPrepare')}</button><button aria-current={tab==='links'?'page':undefined} onClick={()=>setTab('links')}><Link2 size={16}/>{t('aiMyLinks')}</button></nav>
    {error&&<div className="error-banner" role="alert">{t(error)}{error==='aiErrorCONTEXT_CHANGED'&&<button className="button secondary small" onClick={()=>void refresh()}>{t('aiRefresh')}</button>}</div>}
    {tab==='prepare'?<div className="ai-builder">
      <aside className="ai-options panel"><fieldset disabled={busy}>
        <label className="ai-field"><span>{t('aiScope')}</span><select value={scopeValue} onChange={e=>setScope(e.target.value)}><option value="all">{t('aiAll')}</option><optgroup label={t('allModules')}>{['A','B','C'].map(m=><option value={`module:${m}`} key={m}>Module {m} · {t('module'+m)}</option>)}</optgroup><optgroup label={t('requirement')}>{d.requirements.map(r=><option key={r.id} value={`requirement:${r.id}`}>{r.id} · {text(r.title,i18n.language)}</option>)}</optgroup></select><small>{t('aiScopeNote')}</small></label>
        <label className="ai-field"><span>{t('aiLanguage')}</span><select value={options.language} onChange={e=>change({language:e.target.value as Language})}><option value="en">English</option><option value="vi">Tiếng Việt</option><option value="sv">Svenska</option></select><small>{t('aiEnglish')}</small></label>
        <div className="ai-option-group"><h3>{t('aiContents')}</h3><p className="ai-always"><Check size={15}/>{t('aiBaseline')}</p>{([['includeQa','qa'],['includeBreakdown','breakdown'],['includeAssumptions','assumption'],['includeVendor','aiVendor'],['includeEstimates','aiEstimates']] as const).map(([key,label])=><label className="ai-check" key={key}><input type="checkbox" checked={options[key]} onChange={e=>change({[key]:e.target.checked})}/><span>{t(label)}</span></label>)}<small>{t('aiPrivateDefault')}</small></div>
        <div className="ai-option-group"><h3>{t('uxGeneralContext')}</h3><label className="ai-check"><input type="checkbox" checked={options.includeGeneralQa} onChange={e=>change({includeGeneralQa:e.target.checked})}/><span>{t('uxGeneralContext')}</span></label><label className="ai-check"><input type="checkbox" checked={options.includeDecisions} onChange={e=>change({includeDecisions:e.target.checked})}/><span>{t('uxDecisionContext')}</span></label><small>{t('uxContextWarning')}</small></div>
        {options.includeDecisions&&<details className="ai-details"><summary>{t('uxDecisions')} <Badge>{eligibleDecisions.filter(x=>!options.excludedDecisionIds.includes(x.id)).length}/{eligibleDecisions.length}</Badge></summary><div className="ai-item-picker">{eligibleDecisions.map(x=><label className="ai-check" key={x.id}><input type="checkbox" checked={!options.excludedDecisionIds.includes(x.id)} onChange={e=>change({excludedDecisionIds:e.target.checked?options.excludedDecisionIds.filter(id=>id!==x.id):[...options.excludedDecisionIds,x.id]})}/><span><strong>{x.id} · {t(x.state==='proposed'?'uxProposed':x.state==='superseded'?'uxSuperseded':x.state)}</strong><small>{text(x.title,i18n.language)}</small></span></label>)}</div></details>}
        {options.scope.kind==='requirement'&&<details className="ai-details"><summary>{t('aiRelated')} <Badge>{options.scope.relatedIds.length}</Badge></summary><p>{t('aiRelatedNote')}</p><div className="ai-item-picker">{d.requirements.filter(r=>r.id!==options.scope.id).map(r=><label className="ai-check" key={r.id}><input type="checkbox" checked={options.scope.relatedIds.includes(r.id)} onChange={e=>change({scope:{...options.scope,relatedIds:e.target.checked?[...options.scope.relatedIds,r.id]:options.scope.relatedIds.filter(id=>id!==r.id)},excludedEntryIds:[]})}/><span><strong>{r.id}</strong><small>{text(r.title,i18n.language)}</small></span></label>)}</div></details>}
        <details className="ai-details"><summary>{t('aiExclude')} <Badge>{selectedItemCount}/{selectableItems.length}</Badge></summary><div className="ai-item-picker">{selectableItems.length?selectableItems.map(e=><label className="ai-check" key={e.id}><input type="checkbox" checked={!options.excludedEntryIds.includes(e.id)} onChange={event=>change({excludedEntryIds:event.target.checked?options.excludedEntryIds.filter(id=>id!==e.id):[...options.excludedEntryIds,e.id]})}/><span><strong>{e.id} · {e.requirementId||t('qhGeneral')} · {t(e.kind)}</strong><small>{text(e.title,i18n.language)}</small></span></label>):<p>{t('aiNoItems')}</p>}</div></details>
        <label className="ai-field"><span>{t('aiFocus')}</span><textarea rows={3} maxLength={2000} placeholder={t('aiFocusHint')} value={options.note} onChange={e=>change({note:e.target.value})}/><small>{t('aiFocusNote')}</small></label>
      </fieldset><div className="ai-disclosure"><ShieldCheck size={19}/><strong>{t('aiPrivacyTitle')}</strong><p>{t('aiPrivacy')}</p></div></aside>
      <div className="ai-output">
        <section className="panel ai-preview-panel"><div className="section-heading"><h2>{t('aiPreview')}</h2><button className="button secondary small" disabled={busy||building} onClick={()=>void refresh()}><RefreshCw size={14}/>{t('aiRefresh')}</button></div>
          {pack&&<><div className="ai-metrics"><span><strong>{pack.content.coverage.targetIds.length}</strong>{t('requirement')}</span><span><strong>{pack.content.coverage.includedEntries}</strong>{t('aiItems')}</span><span><strong>{pack.content.coverage.omittedEntries}</strong>{t('aiOmitted')}</span><span><strong>{markdown.length.toLocaleString(i18n.language)}</strong>{t('aiCharacters')}</span></div><div className="ai-snapshot-meta"><span>{t('aiCaptured')}: {formatTime(pack.createdAt)}</span><code>{pack.snapshotId.slice(0,8)}</code></div></>}
          <p className="ai-caption">{t('aiFrozen')}</p><p className="ai-caption" role="status">{t('uxEnabledItems',{selected:selectedItemCount,eligible:selectableItems.length})}{pack&&` · ${t('uxDecisions')}: ${pack.content.coverage.decisionsIncluded||0} · ${t('uxReplies')}: ${(pack.content.replies||[]).length}`}</p>{building?<div className="ai-building" role="status"><LoaderCircle className="spin" size={22}/>{t('loading')}</div>:<textarea ref={contentRef} readOnly className="ai-context-preview" aria-label={t('aiPreview')} value={markdown} spellCheck={false}/>}
          {markdown.length>60000&&<p className="ai-large-warning">{t('aiLarge')}</p>}
          <div className="ai-export-actions"><button className="button primary" disabled={!pack||building} onClick={()=>void copy(markdown)}><Clipboard size={16}/>{t('aiCopy')}</button><button className="button secondary" disabled={!pack||building} onClick={()=>pack&&download(packFilename(pack),markdown,'text/markdown;charset=utf-8')}><Download size={16}/>{t('aiDownload')}</button></div>
        </section>
        <section className="panel ai-share-panel"><div className="section-heading"><div><h2><Link2 size={19}/>{t('aiShareTitle')}</h2><p>{t('aiShareBody')}</p></div></div>
          {preview||ready!==true?serviceNotice:<>
          <p className="ai-share-warning">{t('aiAccessWarning')}</p><label className="ai-field ai-lifetime"><span>{t('aiExpiry')}</span><select value={ttl} disabled={busy} onChange={e=>{setTtl(Number(e.target.value));setCreated(null);}}>{[[1,'aiHour'],[24,'aiDay'],[168,'aiWeek'],[720,'aiMonth']].map(([v,label])=><option key={v} value={v}>{t(String(label))}</option>)}</select></label>
          <label className="ai-check ai-consent"><input type="checkbox" checked={ack} disabled={busy} onChange={e=>setAck(e.target.checked)}/><span>{t('aiAcknowledge')}</span></label><button className="button primary" disabled={!ack||!pack||building||busy||!online} onClick={()=>void share()}>{busy?<LoaderCircle className="spin" size={16}/>:<Link2 size={16}/>} {t(busy?'aiCreating':'aiCreate')}</button>
          </>}
          {created?.url&&pack&&<div className="ai-created" role="status"><strong><Check size={17}/>{t('aiLinkCreated')}</strong><input readOnly aria-label={t('aiCopyLink')} value={created.url} onFocus={e=>e.target.select()}/><p>{t('aiExpiry')}: {formatTime(created.expiresAt)}</p><div className="ai-link-actions"><button className="button secondary small" onClick={()=>void copy(reviewPrompt(pack,created.url))}>{t('aiCopyLinkPrompt')}</button><button className="button secondary small" onClick={()=>void copy(created.url!)}>{t('aiCopyLink')}</button><a className="button secondary small" href={created.url} target="_blank" rel="noopener noreferrer">{t('aiOpenLink')}<ArrowUpRight size={14}/></a><button className="button ghost small" onClick={()=>setRevoke(created)}>{t('aiRevoke')}</button></div></div>}
        </section>
      </div>
    </div>:<section className="panel ai-links-panel"><div className="section-heading"><div><h2>{t('aiMyLinks')}</h2><p>{t('aiLinksBody')}</p></div><button className="button secondary small" disabled={!ready||linksLoading} onClick={()=>void loadLinks()}><RefreshCw size={14}/>{t('retry')}</button></div>
      {!ready||preview?serviceNotice:<>{!links.length&&!linksLoading&&<div className="empty-state"><Link2 size={30}/><p>{t('aiNoLinks')}</p></div>}{links.map(link=>{const state=link.state==='revoked'?'aiRevoked':Date.parse(link.expiresAt)<=Date.now()?'aiExpired':'aiActive';return <article className="ai-link-row" key={link.id}><div><strong>{link.scope}</strong><p>{t('aiCaptured')}: {formatTime(link.createdAt)} · {t('aiExpiry')}: {formatTime(link.expiresAt)}</p><code>{link.snapshotId.slice(0,8)}</code></div><Badge tone={state==='aiActive'?'green':'neutral'}>{t(state)}</Badge><div className="ai-link-actions">{link.url&&state==='aiActive'&&<><button className="button secondary small" onClick={()=>void copy(link.url!)}>{t('aiCopyLink')}</button><a className="icon-button" href={link.url} target="_blank" rel="noopener noreferrer" aria-label={t('aiOpenLink')}><ArrowUpRight size={17}/></a></>}{link.state!=='revoked'&&<button className="button secondary small" disabled={busy} onClick={()=>setRevoke(link)}><Unlink size={15}/>{t('aiRevoke')}</button>}</div></article>;})}{linksLoading&&<p role="status">{t('loading')}</p>}{next&&<button className="button secondary" disabled={linksLoading} onClick={()=>void loadLinks(true)}>{t('aiLoadMore')}</button>}</>}
    </section>}
    {revoke&&<Modal title={t('aiRevokeTitle')} onClose={()=>{if(!busy)setRevoke(null);}}><div className="ai-revoke-body"><strong>{revoke.scope}</strong><p>{t('aiRevokeBody')}</p></div><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={()=>setRevoke(null)}>{t('cancel')}</button><button className="button danger" disabled={busy} onClick={()=>void revokeLink()}>{t('aiRevoke')}</button></div></Modal>}
  </div>;
}
