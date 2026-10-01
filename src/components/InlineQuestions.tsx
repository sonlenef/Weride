import { useDraft } from '../lib/useDraft';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Globe2, LoaderCircle, MessageSquareText, Send } from 'lucide-react';
import { useWorkspace } from '../lib/store';
import { useAuth } from '../lib/auth';
import { entryError } from '../lib/helpers';
import { orderedQuestions } from '../lib/questions';
import { locales, newEntry } from '../lib/types';
import type { Entry, Locale } from '../lib/types';
import { Badge, useToast } from './ui';
import { DeleteDialog, EntryEditor, DraftNotice } from './Editors';
import ReviewPackButton from './ReviewPackButton';
import QuestionCard from './QuestionCard';
import { QuestionPriorityField } from './QuestionPriority';
const languageNames = {en:'English',vi:'Tiếng Việt',sv:'Svenska'};
export { QuestionAuthor } from './QuestionAuthor';
interface Props { requirementId:string; draft:Entry; onDraftChange:(draft:Entry)=>void; onBusy:(busy:boolean)=>void; }
export default function InlineQuestions({requirementId,draft:initial,onDraftChange:notifyParent,onBusy}:Props) {
  const {data,online,saveEntry}=useWorkspace(),{member,preview}=useAuth(),{t,i18n}=useTranslation(),toast=useToast();
  const ds=useDraft<Entry>(`entry:new:qa:${requirementId}`,{...initial,originalLocale:initial.originalLocale||i18n.language as Locale},'entry',requirementId);
  const draft=ds.draft;const onDraftChange=(next:Entry)=>{ds.setDraft(next);notifyParent(next);};
  const [lang,setLang]=useState<Locale>(draft.originalLocale||i18n.language as Locale),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [editing,setEditing]=useState<Entry|null>(null),[deleting,setDeleting]=useState<Entry|null>(null);
  const questions=orderedQuestions(data?.entries||[],requirementId),canWrite=(online||preview)&&Boolean(member);
  const post=async()=>{
    const issue=entryError(draft);if(issue){setError(issue);setLang(draft.originalLocale||'en');requestAnimationFrame(()=>document.getElementById('inline-question-'+requirementId)?.focus());return;}
    setBusy(true);onBusy(true);setError('');
    try{await saveEntry(draft);const next={...newEntry(requirementId,'qa'),originalLocale:lang};ds.clear(next);notifyParent(next);toast(t('qaPosted'));}
    catch(e){const message=(e as Error).message;setError(message==='conflict'?'qaSavedConflict':message==='qaOnlyAuthor'?message:'writeError');}
    finally{setBusy(false);onBusy(false);}
  };
  return <section className="inline-qa" aria-label={`${t('qaInlineTitle')} ${requirementId}`} data-requirement-id={requirementId}>
    <header className="inline-qa-header"><div><h3><MessageSquareText size={18}/>{t('qaInlineTitle')}<Badge>{questions.length}</Badge></h3><p>{t('qaInlineHint')}</p></div><div className="inline-qa-links"><ReviewPackButton requirementId={requirementId}/><Link className="button secondary small" to={`/requirements/${requirementId}?tab=qa`}>{t('qaFullDetail')}<ArrowUpRight size={15}/></Link></div></header>
    <div className="inline-qa-layout"><div className="inline-qa-list">
      {questions.slice(0,5).map(q=><QuestionCard key={q.id} entry={q} compact onEdit={e=>setEditing(structuredClone(e))} onDelete={e=>setDeleting(structuredClone(e))}/>)}
      {questions.length>5&&<Link className="button secondary" to={`/questions?scope=${requirementId}`}>{t('uxViewAllQuestions',{count:questions.length})}</Link>}
      {!questions.length&&<div className="inline-qa-empty"><MessageSquareText size={26}/><p>{t('qaEmpty')}</p></div>}
    </div><form className="inline-question-composer" onSubmit={e=>{e.preventDefault();void post();}} aria-label={`${t('qaCompose')} ${requirementId}`}>
      <h4><Send size={16}/>{t('qaCompose')}</h4><p className="composer-person">{member?.name}</p>
      <fieldset disabled={busy||!canWrite}>
        <div className="qa-language-tabs" role="group" aria-label={t('contentLanguage')}><Globe2 size={14}/>{locales.map(l=><button key={l} type="button" aria-pressed={lang===l} onClick={()=>{setLang(l);if(!Object.values(draft.title).some(v=>v.trim()))onDraftChange({...draft,originalLocale:l});}}>{languageNames[l]}</button>)}</div>
        <label className="qa-field"><span>{t('qaQuestionLabel')} · {languageNames[lang]}</span><textarea id={'inline-question-'+requirementId} lang={lang} aria-invalid={Boolean(error)||undefined} aria-describedby={error?'inline-error-'+requirementId:undefined} aria-label={`${t('qaQuestionLabel')} · ${languageNames[lang]}`} rows={4} maxLength={2000} value={draft.title[lang]} placeholder={t('qaQuestionHint')} onChange={e=>onDraftChange({...draft,title:{...draft.title,[lang]:e.target.value}})}/></label>
        <small className="qa-field-hint">{t('uxAnyLanguage')}</small><QuestionPriorityField value={draft.priority} onChange={priority=>onDraftChange({...draft,priority})}/>
        <details className="qa-context-field"><summary>{t('qaContextLabel')}</summary><label className="qa-field"><span className="sr-only">{t('qaContextLabel')}</span><textarea aria-label={`${t('qaContextLabel')} · ${languageNames[lang]}`} rows={3} maxLength={12000} value={draft.body[lang]} onChange={e=>onDraftChange({...draft,body:{...draft.body,[lang]:e.target.value}})}/></label></details>
        {error&&<p id={'inline-error-'+requirementId} className="error-banner" role="alert">{t(error)}</p>}
        <button type="submit" className="button primary" disabled={busy||!canWrite||!Object.values(draft.title).some(v=>v.trim())}>{busy?<LoaderCircle size={16} className="spin"/>:<Send size={16}/>} {t(busy?'saving':'qaPost')}</button>
      </fieldset><DraftNotice {...ds}/>{!canWrite&&<p className="error-banner">{t('offline')}</p>}
    </form></div>
    {editing&&<EntryEditor key={editing.id} initial={editing} allowQuestionScope onClose={()=>setEditing(null)}/>}{deleting&&<DeleteDialog entry={deleting} onClose={()=>setDeleting(null)}/>}
  </section>;
}
