import {effectiveQuestionStatus} from '../lib/collaboration';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Download, Filter, MessageSquareText, Plus, Search, X } from 'lucide-react';
import { useWorkspace } from '../lib/store';
import { useAuth } from '../lib/auth';
import { text } from '../lib/i18n';
import { csvCell, download } from '../lib/helpers';
import { isGeneralQuestion, questionPriorities, selectQuestions } from '../lib/question-hub';
import { questionAuthor } from '../lib/questions';
import { newEntry } from '../lib/types';
import type { Entry } from '../lib/types';
import QuestionCard from '../components/QuestionCard';
import { EntryEditor, DeleteDialog } from '../components/Editors';
import './questions.css';
const PAGE_SIZE=20;
export default function Questions(){
  const {data,online}=useWorkspace(),{member,preview}=useAuth(),{t,i18n}=useTranslation();
  const [params,setParams]=useSearchParams(),[editing,setEditing]=useState<Entry|null>(null),[deleting,setDeleting]=useState<Entry|null>(null);
  const d=data!,all=d.entries.filter(e=>e.kind==='qa');
  const filters={search:params.get('q')||'',scope:params.get('scope')||'',priority:params.get('priority')||'',status:params.get('status')||'',author:params.get('author')||'',sort:params.get('sort')||'latest',questionId:params.get('question')||''};
  const evaluated=all.map(e=>({...e,status:effectiveQuestionStatus(e,d)}));
  const filtered=selectQuestions(evaluated,d.members||[],member?.uid||'',filters).map(e=>all.find(original=>original.id===e.id)!),pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const requestedPage=Number(params.get('page')||1),page=Number.isSafeInteger(requestedPage)&&requestedPage>0?Math.min(requestedPage,pages):1;
  const visible=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE),canWrite=Boolean(member)&&(preview||online);
  const update=(key:string,value:string)=>{const next=new URLSearchParams(window.location.search);value?next.set(key,value):next.delete(key);if(key!=='page'){next.delete('page');next.delete('question');}setParams(next,{replace:true});};
  const reset=(values:Record<string,string>={})=>setParams({...values,...(preview?{preview:'1'}:{})},{replace:true});
  const active=Boolean(filters.search||filters.scope||filters.priority||filters.status||filters.author||filters.questionId);
  const authors=[...new Set(all.filter(e=>e.origin==='team').map(e=>e.createdBy))].map(uid=>({uid,name:questionAuthor(all.find(e=>e.createdBy===uid)!,d.members)||t('qaUnknownAuthor')})).sort((a,b)=>a.name.localeCompare(b.name));
  useEffect(()=>{document.title=`${t('qhMenu')} · WeRide`;return()=>{document.title='WeRide · Discovery Workspace';};},[t]);
  const exportCsv=()=>{
    const rows=[['Question ID','Scope','Requirement ID','Question','Additional context','Answer','Priority','Status','Asked by','Origin','Version','Created at','Updated at'],...filtered.map(e=>[e.id,isGeneralQuestion(e)?'General project question':'Requirement',e.requirementId,text(e.title,i18n.language),text(e.body,i18n.language),text(e.answer,i18n.language),e.priority,effectiveQuestionStatus(e,d),questionAuthor(e,d.members),e.origin,String(e.version),e.createdAt||'',e.updatedAt||''])];
    download('weride-questions.csv','\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
  };
  const newQuestion=()=>setEditing(newEntry(d.requirements.some(r=>r.id===filters.scope)?filters.scope:'','qa'));
  const metrics=[{label:'qhAll',value:all.length,selected:!active,click:()=>reset()},
    {label:'qhOpen',value:all.filter(e=>effectiveQuestionStatus(e,d)==='open').length,selected:filters.status==='open',click:()=>reset({status:'open'})},
    {label:'qhGeneralCount',value:all.filter(isGeneralQuestion).length,selected:filters.scope==='general',click:()=>reset({scope:'general'})},
    {label:'qhMine',value:all.filter(e=>e.createdBy===member?.uid).length,selected:filters.author==='mine',click:()=>reset({author:'mine'})}];
  return <div className="page-enter questions-hub">
    <div className="page-heading"><div><span className="eyebrow">DISCOVERY / Q&A</span><h1>{t('qhTitle')}</h1><p>{t('qhSubtitle')}</p></div><div className="qh-actions"><Link className="button secondary" to={`/client-questions?ids=${encodeURIComponent(filtered.map(q=>q.id).slice(0,60).join(','))}`}>{t('cqPublishForClient')}</Link><button className="button secondary" disabled={!filtered.length} onClick={exportCsv}><Download size={16}/>{t('qhExport')}</button><button className="button primary" disabled={!canWrite} onClick={newQuestion}><Plus size={16}/>{t('addQa')}</button></div></div>
    <section className="qh-metrics" aria-label={t('qhMenu')}>{metrics.map(m=><button key={m.label} type="button" aria-pressed={m.selected} onClick={m.click}><span>{t(m.label)}</span><strong>{m.value}</strong></button>)}</section>
    <section className="panel qh-toolbar"><label className="search-field"><Search size={17}/><input aria-label={t('qhSearch')} placeholder={t('qhSearchHint')} value={filters.search} onChange={e=>update('q',e.target.value)}/>{filters.search&&<button aria-label={t('resetFilters')} onClick={()=>update('q','')}><X size={14}/></button>}</label>
      <div className="qh-filters"><Filter size={16} aria-hidden="true"/>
        <label><span>{t('qhScope')}</span><select aria-label={t('qhScope')} value={filters.scope} onChange={e=>update('scope',e.target.value)}><option value="">{t('qhAllScopes')}</option><option value="general">{t('qhGeneralCount')}</option><option value="linked">{t('qhLinked')}</option>{d.requirements.map(r=><option key={r.id} value={r.id}>{r.id} · {text(r.title,i18n.language)}</option>)}</select></label>
        <label><span>{t('priority')}</span><select aria-label={t('qhAllPriorities')} value={filters.priority} onChange={e=>update('priority',e.target.value)}><option value="">{t('qhAllPriorities')}</option><option value="urgent">{t('uxUrgent')}</option>{questionPriorities.map(p=><option key={p} value={p}>{t(p)}</option>)}</select></label>
        <label><span>{t('status')}</span><select aria-label={t('qhAllStatuses')} value={filters.status} onChange={e=>update('status',e.target.value)}><option value="">{t('qhAllStatuses')}</option>{['open','answered','resolved'].map(s=><option key={s} value={s}>{t(s)}</option>)}</select></label>
        <label><span>{t('qaAskedBy')}</span><select aria-label={t('qhAllAuthors')} value={filters.author} onChange={e=>update('author',e.target.value)}><option value="">{t('qhAllAuthors')}</option><option value="mine">{t('qhMine')}</option><option value="proposal">{t('qaSeedAuthor')}</option>{authors.map(a=><option key={a.uid} value={a.uid}>{a.name}</option>)}</select></label>
        <label><span>{t('qhSort')}</span><select aria-label={t('qhSort')} value={filters.sort} onChange={e=>update('sort',e.target.value)}><option value="latest">{t('qhLatest')}</option><option value="priority">{t('qhPriorityFirst')}</option><option value="oldest">{t('qhOldest')}</option></select></label>
      </div>
    </section>
    <div className="qh-results-bar"><span role="status" aria-live="polite">{t('qhShowing',{from:filtered.length?(page-1)*PAGE_SIZE+1:0,to:Math.min(page*PAGE_SIZE,filtered.length),count:filtered.length,total:all.length})}</span><button className="button secondary small" aria-pressed={params.get('view')==='expanded'} onClick={()=>update('view',params.get('view')==='expanded'?'':'expanded')}>{t(params.get('view')==='expanded'?'uxHideDiscussion':'uxShowDiscussion')}</button>{active&&<button className="button secondary small" onClick={()=>reset()}>{t('resetFilters')}<X size={13}/></button>}</div>
    {filters.questionId&&<p className="qh-info" role="status">{t('qhLinkedView')}</p>}
    <section className="qh-question-list" aria-label={t('qhAll')}>{visible.map(e=><QuestionCard key={e.id} entry={e} showScope compact={!filters.questionId&&params.get('view')!=='expanded'} onEdit={q=>setEditing(structuredClone(q))} onDelete={q=>setDeleting(structuredClone(q))}/>)}{!visible.length&&<div className="panel empty-state"><MessageSquareText size={32}/><h2>{t(filters.questionId?'uxNoSuchQuestion':!all.length?'uxNoQuestions':'qhNoResults')}</h2>{filters.questionId?<Link className="button secondary" to="/activity">{t('allActivity')}</Link>:!all.length?<button className="button primary" disabled={!canWrite} onClick={newQuestion}>{t('addQa')}</button>:<button className="button secondary" onClick={()=>reset()}>{t('uxClearFilters')}</button>}</div>}</section>
    {pages>1&&<nav className="qh-pagination" aria-label={t('qhPage',{page,total:pages})}><button className="button secondary small" disabled={page===1} onClick={()=>update('page',String(page-1))}><ArrowLeft size={15}/>{t('previous')}</button><span>{t('qhPage',{page,total:pages})}</span><button className="button secondary small" disabled={page===pages} onClick={()=>update('page',String(page+1))}>{t('next')}<ArrowRight size={15}/></button></nav>}
    <p className="qh-ownership-note">{t('qaOnlyAuthor')}</p>
    {editing&&<EntryEditor key={editing.id} initial={editing} allowQuestionScope onSaved={entry=>{if(!editing.version)reset({question:entry.id});}} onClose={()=>setEditing(null)}/>}{deleting&&<DeleteDialog entry={deleting} onClose={()=>setDeleting(null)}/>}
  </div>;
}
