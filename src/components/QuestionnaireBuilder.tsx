import {useEffect,useMemo,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {ArrowDown,ArrowUp,Check,Clipboard,ExternalLink,Send,ShieldCheck} from 'lucide-react';
import {useWorkspace} from '../lib/store';
import {useAuth} from '../lib/auth';
import {text} from '../lib/i18n';
import {canonical,sha256} from '../../functions/src/pack';
import {makeSnapshot,parsePublish,safeLocalized} from '../../functions/src/questionnaire-model';
import type {Publication,PublishOptions,Locale} from '../../functions/src/questionnaire-model';
import {publishClientQuestions,clientInvitation} from '../lib/client-questionnaire-api';
import {newClientSecret,questionnaireRequest} from '../lib/client-questionnaire-http';
import {clientErrorKey} from '../lib/client-questionnaire-i18n';
import {Badge,useToast} from './ui';
export default function QuestionnaireBuilder({initialIds=[]}:{initialIds?:string[]}){
  const {data,online}=useWorkspace(),{preview}=useAuth(),{t}=useTranslation(),toast=useToast();
  const d=data!,questions=d.entries.filter(e=>e.kind==='qa');
  const [options,setOptions]=useState<PublishOptions>({title:'WeRide · Discovery questions',introduction:'Please help us clarify the questions below. Provide the information currently available and flag anything that needs follow-up.',language:'en',questionIds:initialIds.filter(id=>questions.some(q=>q.id===id)).slice(0,60),includeDetails:false,includeBaseline:true,ttlDays:14,dueDate:''});
  const [search,setSearch]=useState(''),[protect,setProtect]=useState(true),[code,setCode]=useState(()=>newClientSecret().slice(0,16));
  const [ack,setAck]=useState(false),[showPreview,setShowPreview]=useState(false),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),[created,setCreated]=useState<Publication|null>(null);
  const requestId=useRef(crypto.randomUUID());
  const check=async()=>{try{const r=await questionnaireRequest<{available:boolean}>('status');setReady(r.available===true);}catch{setReady(false);}};
  useEffect(()=>{if(!preview)void check();},[preview]);
  const snapshot=useMemo(()=>{try{return options.questionIds.length?makeSnapshot(d,parsePublish(options)):null;}catch{return null;}},[d,options]);
  const signature=canonical({snapshot,options,protect,code});
  useEffect(()=>{setAck(false);setCreated(null);requestId.current=crypto.randomUUID();},[signature]);
  const change=(patch:Partial<PublishOptions>)=>setOptions(old=>({...old,...patch}));
  const needle=search.trim().toLocaleLowerCase(),matches=questions.filter(q=>[q.id,q.requirementId,...Object.values(q.title)].join(' ').toLocaleLowerCase().includes(needle));
  const toggle=(id:string)=>change({questionIds:options.questionIds.includes(id)?options.questionIds.filter(q=>q!==id):[...options.questionIds,id].slice(0,60)});
  const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value);toast(t('cqCopied'));}catch{setError('NETWORK');}};
  const publish=async()=>{
    if(!ack||!snapshot||busy||preview||!online)return;
    setBusy(true);setError('');
    try{const valid=parsePublish(options);if(protect&&code.trim().length<12)throw Error('CODE_LENGTH');
      const result=await publishClientQuestions(valid,requestId.current,await sha256(canonical(snapshot)),protect?code.trim():'');setCreated(result);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const move=(index:number,delta:number)=>{const ids=[...options.questionIds];[ids[index],ids[index+delta]]=[ids[index+delta],ids[index]];change({questionIds:ids});};
  return <div className="cq-builder">
    {!questions.length&&<div className="panel empty-state"><p>{t('cqNoQuestions')}</p><Link className="button primary" to="/questions">{t('addQa')}</Link></div>}
    {error&&<p role="alert" className="error-banner">{t(clientErrorKey(Error(error)))}</p>}
    <div className="cq-builder-grid"><section className="panel"><h2>{t('cqSelect')}</h2>
      <label className="field"><span>{t('cqSearch')}</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('cqSearch')}/></label>
      <div className="cq-actions"><Badge>{options.questionIds.length} / 60 {t('cqSelected')}</Badge>
        <button className="button secondary small" disabled={busy} onClick={()=>change({questionIds:[...new Set([...options.questionIds,...matches.map(q=>q.id)])].slice(0,60)})}>{t('cqSelectFiltered')}</button>
        <button className="button secondary small" disabled={busy} onClick={()=>change({questionIds:[]})}>{t('cqClear')}</button></div>
      <div className="cq-picker">{matches.map(q=><label key={q.id} className="cq-pick"><input type="checkbox" disabled={busy||!options.questionIds.includes(q.id)&&options.questionIds.length>=60} checked={options.questionIds.includes(q.id)} onChange={()=>toggle(q.id)}/><span><strong>{text(q.title,options.language)}</strong><small>{q.requirementId||t('cqGeneral')} · {t(q.priority)} · v{q.version}</small></span></label>)}</div>
    </section><section className="panel"><h2>{t('cqConfigure')}</h2><fieldset className="editor-fields" disabled={busy}>
      <label className="field"><span>{t('cqName')}</span><input maxLength={160} value={options.title} onChange={e=>change({title:e.target.value})}/></label>
      <label className="field"><span>{t('cqIntro')}</span><textarea maxLength={4000} rows={4} value={options.introduction} onChange={e=>change({introduction:e.target.value})}/></label>
      <div className="form-grid"><label className="field"><span>{t('cqLanguage')}</span><select value={options.language} onChange={e=>change({language:e.target.value as Locale})}><option value="en">English</option><option value="vi">Tiếng Việt</option><option value="sv">Svenska</option></select></label>
        <label className="field"><span>{t('cqLifetime')}</span><select value={options.ttlDays} onChange={e=>change({ttlDays:Number(e.target.value)})}>{[7,14,30].map(n=><option value={n} key={n}>{n} {t('cqDays')}</option>)}</select></label></div>
      <label className="field"><span>{t('cqDue')}</span><input type="date" min={new Date().toISOString().slice(0,10)} max={new Date(Date.now()+options.ttlDays*86400000).toISOString().slice(0,10)} value={options.dueDate} onChange={e=>change({dueDate:e.target.value})}/><small>{t('cqDueHelp')}</small></label>
      <label className="cq-check"><input type="checkbox" checked={options.includeDetails} onChange={e=>change({includeDetails:e.target.checked})}/>{t('cqDetails')}</label>
      <label className="cq-check"><input type="checkbox" checked={options.includeBaseline} onChange={e=>change({includeBaseline:e.target.checked})}/>{t('cqBaseline')}</label>
      <label className="cq-check"><input type="checkbox" checked={protect} onChange={e=>setProtect(e.target.checked)}/>{t('cqProtect')}</label>
      {protect&&<label className="field"><span>{t('cqCode')}</span><input aria-label={t('cqCode')} aria-describedby="client-access-code-help" autoComplete="off" spellCheck={false} minLength={12} maxLength={64} value={code} onChange={e=>setCode(e.target.value)}/><small id="client-access-code-help">{t('cqCodeHelp')}</small><button type="button" className="button secondary small" onClick={()=>setCode(newClientSecret().slice(0,16))}>{t('cqRegenerate')}</button></label>}
    </fieldset></section></div>
    <section className="panel cq-publish-panel"><h2>{t('cqPreview')}</h2><p className="cq-notice"><ShieldCheck size={20}/>{t('cqDisclosure')}</p><p className="small-note">{t('cqFrozen')}</p>
      <button className="button secondary" aria-expanded={showPreview} disabled={!snapshot} onClick={()=>setShowPreview(v=>!v)}>{t('cqPreview')} · {options.questionIds.length}</button>
      {showPreview&&snapshot&&<div className="cq-snapshot"><h3>{snapshot.title}</h3><p>{snapshot.introduction}</p>{snapshot.questions.map((q,index)=>{
        const title=safeLocalized(q.title,options.language),detail=safeLocalized(q.details,options.language);
        return <article key={q.id} className="cq-preview-question"><header><strong>{index+1}. {q.requirementId||t('cqGeneral')}</strong><Badge>{t(q.priority)}</Badge><span className="cq-actions"><button className="icon-button" disabled={index===0||busy} aria-label={`${t('cqUp')} ${index+1}`} onClick={()=>move(index,-1)}><ArrowUp size={16}/></button><button className="icon-button" disabled={index===snapshot.questions.length-1||busy} aria-label={`${t('cqDown')} ${index+1}`} onClick={()=>move(index,1)}><ArrowDown size={16}/></button></span></header>
          <h4 lang={title.language}>{title.text}</h4>{detail.text&&<p lang={detail.language}>{detail.text}</p>}
          {q.baseline&&<details><summary>{t('cqBaselineLabel')} · {q.requirementId}</summary><p lang={safeLocalized(q.baseline.description,options.language).language}>{safeLocalized(q.baseline.description,options.language).text}</p><small>{snapshot.sourceReference} · {q.baseline.sourceSection} · p. {q.baseline.sourcePage}</small></details>}
        </article>;
      })}</div>}
      <label className="cq-check cq-consent"><input type="checkbox" checked={ack} disabled={!snapshot||!showPreview||busy} onChange={e=>setAck(e.target.checked)}/>{t('cqAcknowledge')}</label>
      {preview?<p className="cq-notice">{t('cqPreviewOnly')}</p>:!ready&&<p className="cq-notice">{t('cqErrorUNAVAILABLE')} <button className="button secondary small" onClick={()=>void check()}>{t('cqRefresh')}</button></p>}
      <button className="button primary" disabled={!ack||!snapshot||busy||!ready||preview||!online||Boolean(created)} onClick={()=>void publish()}><Send size={16}/>{t(busy?'cqWorking':'cqPublish')}</button>
      {created&&<div className="cq-created" role="status"><h3><Check size={20}/>{t('cqCreated')}</h3><label className="field"><span>{t('cqCopy')}</span><input readOnly value={created.url||''} onFocus={e=>e.target.select()}/></label><div className="cq-actions">
        <button className="button secondary" onClick={()=>void copy(clientInvitation(created))}><Clipboard size={16}/>{t('cqInvite')}</button>
        <button className="button secondary" onClick={()=>void copy(created.url||'')}>{t('cqCopy')}</button>
        {protect&&<button className="button secondary" onClick={()=>void copy(code)}>{t('cqCopyCode')}</button>}
        <a className="button secondary" href={created.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>{t('cqOpen')}</a>
        <Link className="button secondary" to={`/client-questions?tab=published&id=${created.id}`}>{t('cqManage')}</Link>
      </div></div>}
    </section>
  </div>;
}
