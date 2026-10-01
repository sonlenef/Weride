import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {Clipboard,Download,RefreshCw} from 'lucide-react';
import {useAuth} from '../lib/auth';
import {clientManagement,clientInvitation} from '../lib/client-questionnaire-api';
import type {PublicationSummary,QuestionnaireDetail,SubmissionDetail} from '../lib/client-questionnaire-api';
import {clientErrorKey} from '../lib/client-questionnaire-i18n';
import {safeLocalized} from '../../functions/src/questionnaire-model';
import type {Publication,Locale} from '../../functions/src/questionnaire-model';
import {csvCell,download} from '../lib/helpers';
import {Badge,Modal,useToast} from './ui';
const statusKey=(p:Publication)=>p.state==='revoked'?'cqStateRevoked':Date.parse(p.expiresAt)<=Date.now()?'cqExpired':p.state==='closed'?'cqStateClosed':'cqStatePublished';
export default function QuestionnaireManager(){
  const {t,i18n}=useTranslation(),{preview}=useAuth(),toast=useToast(),[params,setParams]=useSearchParams();
  const [items,setItems]=useState<PublicationSummary[]>([]),[cursor,setCursor]=useState<string|null>(null),[detail,setDetail]=useState<QuestionnaireDetail|null>(null),[response,setResponse]=useState<SubmissionDetail|null>(null);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [stateAction,setStateAction]=useState<Publication['state']|null>(null),[importId,setImportId]=useState<string|null>(null);
  const id=params.get('id')||'',locale=i18n.language as Locale;
  const list=async(append=false)=>{if(preview)return;setLoading(true);setError('');try{const r=await clientManagement<{items:PublicationSummary[];nextCursor:string|null}>(append&&cursor?`?cursor=${cursor}`:'');setItems(old=>append?[...old,...r.items]:r.items);setCursor(r.nextCursor);}catch(e){setError((e as Error).message);}finally{setLoading(false);}};
  const load=async()=>{if(!id||preview)return;setLoading(true);setError('');try{setDetail(await clientManagement<QuestionnaireDetail>(`/${id}`));}catch(e){setDetail(null);setError((e as Error).message);}finally{setLoading(false);}};
  useEffect(()=>{void list();},[preview]);
  useEffect(()=>{setResponse(null);setDetail(null);void load();},[id,preview]);
  const select=(value:string)=>setParams({...Object.fromEntries(params),tab:'published',id:value});
  const submission=async(sid:string)=>{setBusy(true);setError('');try{setResponse(await clientManagement<SubmissionDetail>(`/${id}/submissions/${sid}`));}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value);toast(t('cqCopied'));}catch{setError('NETWORK');}};
  const changeState=async()=>{if(!detail||!stateAction)return;setBusy(true);try{await clientManagement(`/${id}/state`,{state:stateAction,version:detail.publication.version});setStateAction(null);await load();await list();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  const importAnswer=async()=>{if(!response||!importId)return;setBusy(true);try{await clientManagement(`/${id}/submissions/${response.submission.id}/import`,{questionId:importId});setImportId(null);await submission(response.submission.id);toast(t('cqImported'));}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  const exportResponse=()=>{
    if(!response||!detail)return;const s=response.submission;
    const rows=[['Publication','Submission','Respondent (self-reported)','Email (unverified)','Submitted at','Question ID','Requirement','Published question','Question version','Response type','Response language','Response','Imported reply'],...detail.publication.snapshot.questions.map(q=>[id,s.id,s.name,s.email,s.submittedAt||'',q.id,q.requirementId,safeLocalized(q.title,locale).text,q.version,s.answers[q.id]?.kind||'',s.answers[q.id]?.language||'',s.answers[q.id]?.text||'',s.imported[q.id]?.replyId||''])];
    download(`weride-client-response-${s.id.slice(0,8)}.csv`,'\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
  };
  if(preview)return <section className="panel"><p>{t('cqPreviewOnly')}</p></section>;
  return <div className="cq-management"><p className="cq-notice">{t('cqOwnerOnly')}</p>
    {error&&<p className="error-banner" role="alert">{t(clientErrorKey(Error(error)))}</p>}
    <div className="cq-actions"><button className="button secondary" disabled={loading||busy} onClick={()=>{void list();void load();}}><RefreshCw size={16}/>{t('cqRefresh')}</button>{loading&&<span role="status">{t('cqWorking')}</span>}</div>
    {!items.length&&!loading&&<div className="panel empty-state">{t('cqEmpty')}</div>}
    <div className="cq-publication-list">{items.map(p=><article className={`panel cq-publication ${id===p.id?'is-selected':''}`} key={p.id}><div><h2>{p.snapshot.title}</h2><p>{p.questionCount} {t('cqQuestionCount')} · {p.submissionCount} {t('cqSubmitted')} · {t('cqExpires')}: {new Date(p.expiresAt).toLocaleDateString(locale)}</p><Badge>{t(statusKey(p))}</Badge>{p.protected&&<Badge>{t('cqCode')}</Badge>}</div><button className="button secondary" aria-pressed={id===p.id} disabled={busy} onClick={()=>select(p.id)}>{t('cqManage')}</button></article>)}</div>
    {cursor&&<button className="button secondary" disabled={loading} onClick={()=>void list(true)}>{t('aiLoadMore')}</button>}
    {detail&&<section className="panel cq-inbox"><h2>{detail.publication.snapshot.title}</h2><p className="small-note">{t('cqFrozen')}</p>
      <div className="cq-actions">{detail.publication.url&&<><button className="button secondary small" onClick={()=>void copy(detail.publication.url!)}>{t('cqCopy')}</button><button className="button secondary small" onClick={()=>void copy(clientInvitation(detail.publication))}><Clipboard size={15}/>{t('cqInvite')}</button></>}
        {detail.publication.state!=='revoked'&&<><button className="button secondary small" disabled={busy||Date.parse(detail.publication.expiresAt)<=Date.now()} onClick={()=>setStateAction(detail.publication.state==='published'?'closed':'published')}>{t(detail.publication.state==='published'?'cqClose':'cqReopen')}</button><button className="button secondary small" disabled={busy} onClick={()=>setStateAction('revoked')}>{t('cqRevoke')}</button></>}
      </div><p className="cq-notice">{t('cqIdentityNotice')}</p>
      {!detail.respondents.length?<p>{t('cqNoResponses')}</p>:<div className="cq-respondents">{detail.respondents.map(s=><article key={s.id}><div><strong>{s.name}</strong><small>{s.email}</small><span>{t(s.state==='submitted'?'cqSubmitted':'cqDraft')} · {s.counts?.completed||0}/{detail.publication.snapshot.questions.length} · {new Date(s.savedAt).toLocaleString(locale)}</span></div>{s.state==='submitted'&&<button className="button secondary small" disabled={busy} onClick={()=>void submission(s.id)}>{t('cqManage')}</button>}</article>)}</div>}
      {response&&<div className="cq-submission"><div className="section-heading"><div><h3>{response.submission.name}</h3><p>{t('cqReceipt')}: {response.submission.id}</p></div><button className="button secondary small" onClick={exportResponse}><Download size={15}/>{t('cqExport')}</button></div>
        {detail.publication.snapshot.questions.map((q,index)=>{const a=response.submission.answers[q.id],added=response.submission.imported[q.id],current=response.sourceState[q.id]==='current';return <article key={q.id} className="cq-preview-question"><header><strong>{index+1}. {q.requirementId||t('cqGeneral')}</strong><Badge>v{q.version}</Badge></header><h4 lang={safeLocalized(q.title,locale).language}>{safeLocalized(q.title,locale).text}</h4>
          {a?<><Badge>{t(({answer:'cqAnswer',clarify:'cqClarify',not_applicable:'cqNotApplicable',later:'cqLater'})[a.kind])}</Badge><p lang={a.language}>{a.text||t('cqLater')}</p></>:<p>{t('cqUnanswered')}</p>}
          {!current&&!added&&<p className="cq-notice">{t('cqSourceChanged')}</p>}
          {added?<p><Badge tone="green">{t('cqImported')}</Badge><Link className="button secondary small" to={`/questions?question=${q.id}`}>{t('cqViewQ')}</Link></p>:a&&(a.text.trim()||a.kind==='later')&&<button className="button secondary small" disabled={!current||busy} onClick={()=>setImportId(q.id)}>{t('cqImport')}</button>}
        </article>;})}
      </div>}
    </section>}
    {stateAction&&<Modal title={t(stateAction==='revoked'?'cqRevoke':stateAction==='closed'?'cqClose':'cqReopen')} onClose={()=>{if(!busy)setStateAction(null);}}><div className="modal-body"><p>{t('cqStateConfirm')}</p>{error&&<p role="alert" className="error-banner">{t(clientErrorKey(Error(error)))}</p>}</div><footer className="modal-footer"><button className="button secondary" disabled={busy} onClick={()=>setStateAction(null)}>{t('cancel')}</button><button className="button danger" disabled={busy} onClick={()=>void changeState()}>{t(busy?'cqWorking':'save')}</button></footer></Modal>}
    {importId&&<Modal title={t('cqImport')} onClose={()=>{if(!busy)setImportId(null);}}><div className="modal-body"><p>{t('cqImportHelp')}</p><p>{t('cqIdentityNotice')}</p>{error&&<p role="alert" className="error-banner">{t(clientErrorKey(Error(error)))}</p>}</div><footer className="modal-footer"><button className="button secondary" disabled={busy} onClick={()=>setImportId(null)}>{t('cancel')}</button><button className="button primary" disabled={busy} onClick={()=>void importAnswer()}>{t(busy?'cqWorking':'cqImport')}</button></footer></Modal>}
  </div>;
}
