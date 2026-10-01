import {useId,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {AlertCircle,Check,Globe2,LoaderCircle,Trash2} from 'lucide-react';
import {Modal,useToast} from './ui';
import {useWorkspace} from '../lib/store';
import {useDraft} from '../lib/useDraft';
import {entryError,reviewError} from '../lib/helpers';
import {text} from '../lib/i18n';
import {locales,states} from '../lib/types';
import type {Entry,Locale,Localized,Review} from '../lib/types';
import {QuestionPriorityField} from './QuestionPriority';
const langNames={en:'English',vi:'Tiếng Việt',sv:'Svenska'};
export function LanguageTabs({lang,setLang}:{lang:Locale;setLang:(l:Locale)=>void}){const {t}=useTranslation();return <div className="editor-language"><span><Globe2 size={15}/>{t('contentLanguage')}</span><div role="group" aria-label={t('contentLanguage')}>{locales.map(l=><button type="button" aria-pressed={l===lang} key={l} onClick={()=>setLang(l)} className={l===lang?'active':''}>{langNames[l]}</button>)}</div></div>;}
export function TranslationField({label,value,onChange,lang,title=false,rows=3,error,id}:{label:string;value:Localized;onChange:(v:Localized)=>void;lang:Locale;title?:boolean;rows?:number;error?:string;id?:string}){
  const ownId=useId(),fieldId=id||ownId;
  return <label className="field" htmlFor={fieldId}><span>{label}<small>{langNames[lang]}</small></span><textarea id={fieldId} lang={lang} rows={rows} value={value[lang]} maxLength={title?2000:12000} onChange={e=>onChange({...value,[lang]:e.target.value})} aria-invalid={error?true:undefined} aria-describedby={error?fieldId+'-error':undefined}/>{error&&<span className="field-error" id={fieldId+'-error'}>{error}</span>}</label>;
}
export const readableError=(e:unknown)=>e instanceof Error&&['conflict','invalidTitle','invalidNumber','requiredAnswer','requiredRoadmap','qaOnlyAuthor','qhScopeInvalid','invalidPriority','uxQuestionRequired','uxAnswerRequired','uxReplyRequired','uxAcceptedLocked','uxRestorePermission','uxDecisionEvidence'].includes(e.message)?e.message:'writeError';
export function DraftNotice({saved,persisted,dirty}:{saved:boolean;persisted:boolean;dirty:boolean}){const {t}=useTranslation();return dirty?<p className={persisted?'draft-notice':'error-banner'} role="status">{t(saved&&persisted?'uxDraftSaved':'uxDraftMemory')}</p>:null;}
export function EntryEditor({initial,onClose,allowQuestionScope=false,onSaved,draftKey}:{initial:Entry;onClose:()=>void;allowQuestionScope?:boolean;onSaved?:(entry:Entry)=>void;draftKey?:string}){
  const {t,i18n}=useTranslation(),{saveEntry,data}=useWorkspace(),toast=useToast();
  const qa=initial.kind==='qa',creating=initial.version===0;
  const start={...initial,...(qa?{originalLocale:initial.originalLocale||(creating?i18n.language as Locale:'en')}: {})};
  const key=draftKey||`entry:${creating?'new:'+initial.kind+':'+initial.requirementId:initial.id}`;
  const draftState=useDraft(key,start,'entry',initial.requirementId||t('qhGeneral'));
  const {draft,setDraft,clear}=draftState;
  const [lang,setLang]=useState<Locale>(qa?draft.originalLocale||'en':i18n.language as Locale),[busy,setBusy]=useState(false),[error,setError]=useState(''),[fieldError,setFieldError]=useState('');
  const form=useRef<HTMLFormElement>(null),fieldId=useId();
  const change=<K extends keyof Entry>(name:K,value:Entry[K])=>{setDraft(d=>({...d,[name]:value}));setError('');setFieldError('');};
  const switchLanguage=(l:Locale)=>{setLang(l);if(qa&&creating&&!Object.values(draft.title).some(v=>v.trim()))setDraft(d=>({...d,originalLocale:l}));};
  const close=()=>{if(!busy)onClose();};
  const save=async()=>{
    const problem=entryError(draft);
    if(problem){const target=['invalidTitle','uxQuestionRequired'].includes(problem)?'title':problem==='uxAnswerRequired'?'answer':'number';setFieldError(target);setError(problem);if(target==='title')setLang(qa?draft.originalLocale||'en':'en');requestAnimationFrame(()=>document.getElementById(fieldId+'-'+target)?.focus());return;}
    setBusy(true);setError('');try{await saveEntry(draft);clear();toast(t('saved'));onSaved?.(draft);onClose();}catch(e){setError(readableError(e));}finally{setBusy(false);}
  };
  return <Modal title={`${t(creating?(qa?'addQa':initial.kind==='breakdown'?'addBreakdown':'addAssumption'):'edit')} · ${draft.requirementId||t('qhGeneral')}`} onClose={close} wide>
    <form ref={form} noValidate onSubmit={e=>{e.preventDefault();void save();}}><div className="modal-body"><fieldset className="editor-fields" disabled={busy}>
      {draftState.restored&&<p className="small-note">{t('uxDraftRestored')}</p>}
      <LanguageTabs lang={lang} setLang={switchLanguage}/><p className="small-note">{t(qa?'uxAnyLanguage':'requiredEnglish')}</p>
      <TranslationField id={fieldId+'-title'} label={t(qa?'question':'title')} value={draft.title} onChange={v=>change('title',v)} lang={lang} title rows={3} error={fieldError==='title'?t(error):undefined}/>
      <div className="form-grid">{qa&&(allowQuestionScope||!creating)&&<label className="field"><span>{t('qhScope')}</span><select aria-label={t('qhScope')} value={draft.requirementId} onChange={e=>change('requirementId',e.target.value)}><option value="">{t('qhGeneral')}</option>{data?.requirements.map(r=><option key={r.id} value={r.id}>{r.id} · {text(r.title,i18n.language)}</option>)}</select><small>{t(creating?'qhGeneralHelp':'uxScopeMoveHelp')}</small></label>}
      <QuestionPriorityField value={draft.priority} onChange={p=>change('priority',p)}/></div>
      {qa?<details className="editor-advanced" open={!creating||undefined}><summary>{t('uxAdvanced')}</summary><label className="field"><span>{t('uxSourceLanguage')}</span><select aria-label={t('uxSourceLanguage')} value={draft.originalLocale||'en'} onChange={e=>change('originalLocale',e.target.value as Locale)}>{locales.map(l=><option key={l} value={l}>{langNames[l]}</option>)}</select></label><TranslationField label={t('details')} value={draft.body} onChange={v=>change('body',v)} lang={lang}/></details>:<TranslationField label={t('details')} value={draft.body} onChange={v=>change('body',v)} lang={lang}/>}
      {qa&&!creating&&<><TranslationField id={fieldId+'-answer'} label={t('answer')} value={draft.answer} onChange={v=>change('answer',v)} lang={lang} error={fieldError==='answer'?t(error):undefined}/><p className="small-note">{t('uxReplyPolicy')}</p></>}
      {!qa&&<TranslationField label={t(initial.kind==='assumption'?'validation':'acceptance')} value={draft.acceptance} onChange={v=>change('acceptance',v)} lang={lang}/>}
      {(!qa||!creating)&&<div className="form-grid"><label className="field"><span>{t('status')}</span><select aria-label={t('status')} value={draft.status} onChange={e=>change('status',e.target.value)}>{states[draft.kind].map(s=><option key={s} value={s}>{t(s)}</option>)}</select></label>{!qa&&<label className="field"><span>{t('owner')}</span><input maxLength={200} value={draft.owner} placeholder={t('unassigned')} onChange={e=>change('owner',e.target.value)}/></label>}{initial.kind==='breakdown'&&<label className="field"><span>{t('hours')}</span><input id={fieldId+'-number'} aria-invalid={fieldError==='number'||undefined} type="number" min="0" max="100000" step="0.25" value={draft.estimateHours??''} onChange={e=>change('estimateHours',e.target.value===''?null:Number(e.target.value))}/></label>}</div>}
      {initial.parentId&&<p className="small-note">↳ {initial.parentId}</p>}{error&&<div className="error-banner" role="alert"><AlertCircle size={18}/>{t(error)}</div>}
      <DraftNotice {...draftState}/></fieldset></div><footer className="modal-footer"><button type="button" className="button secondary" disabled={busy} onClick={()=>{if(window.confirm(t('unsaved'))){clear();onClose();}}}>{t('uxDiscard')}</button><button type="button" className="button secondary" onClick={close} disabled={busy}>{t('cancel')}</button><button className="button primary" type="submit" disabled={busy}>{busy?<LoaderCircle className="spin" size={16}/>:<Check size={16}/>} {t(busy?'saving':'save')}</button></footer></form>
  </Modal>;
}
export function ReviewEditor({initial,onClose,draftKey}:{initial:Review;onClose:()=>void;draftKey?:string}){
  const {t,i18n}=useTranslation(),{saveReview}=useWorkspace(),toast=useToast();
  const draftState=useDraft(draftKey||`review:${initial.id}`,initial,'review',initial.id),{draft,setDraft,clear}=draftState;
  const [lang,setLang]=useState<Locale>(i18n.language as Locale),[busy,setBusy]=useState(false),[error,setError]=useState(''),[invalid,setInvalid]=useState('');const id=useId();
  const change=<K extends keyof Review>(key:K,value:Review[K])=>{setDraft(d=>({...d,[key]:value}));setInvalid('');setError('');};
  const close=()=>{if(!busy)onClose();};
  const save=async()=>{
    let field='',problem=reviewError(draft);
    if(draft.compliance==='CU'&&draft.effortHours===null){field='effortHours';problem='uxHoursRequired';}
    else if(draft.compliance==='CU'&&draft.cost===null){field='cost';problem='uxCostRequired';}
    else if(draft.compliance==='RD'&&(!draft.releaseDate||!Number.isFinite(Date.parse(draft.releaseDate)))){field='releaseDate';problem='uxDateRequired';}
    else if(problem==='invalidNumber')field=draft.effortHours!==null&&(!Number.isFinite(draft.effortHours)||draft.effortHours<0||draft.effortHours>100000)?'effortHours':'cost';
    if(problem){setError(problem);setInvalid(field);requestAnimationFrame(()=>document.getElementById(id+'-'+field)?.focus());return;}
    setBusy(true);setError('');try{await saveReview(draft);clear();toast(t('saved'));onClose();}catch(e){setError(readableError(e));}finally{setBusy(false);}
  };
  const described=(field:string)=>({'aria-invalid':invalid===field||undefined,'aria-describedby':invalid===field?id+'-error':undefined,id:id+'-'+field});
  return <Modal title={`${t('editReview')} · ${initial.id}`} onClose={close} wide><form noValidate onSubmit={e=>{e.preventDefault();void save();}}><div className="modal-body"><fieldset className="editor-fields" disabled={busy}>
    <p className="small-note">{t('reviewPrompt')}</p>{draftState.restored&&<p className="small-note">{t('uxDraftRestored')}</p>}
    <div className="form-grid"><label className="field"><span>{t('compliance')}</span><select aria-label={t('compliance')} value={draft.compliance} onChange={e=>change('compliance',e.target.value as Review['compliance'])}><option value="">{t('unassessed')}</option>{['FC','PC','RD','CU','NC'].map(c=><option value={c} key={c}>{t(c)}</option>)}</select></label>
    <label className="field"><span>{t('reviewStatus')}</span><select aria-label={t('reviewStatus')} value={draft.state} onChange={e=>change('state',e.target.value as Review['state'])}>{['unreviewed','reviewing','clarified','scoped'].map(s=><option key={s} value={s}>{t(s)}</option>)}</select></label>
    <label className="field"><span>{t('hours')}</span><input {...described('effortHours')} type="number" min="0" max="100000" step="0.25" value={draft.effortHours??''} onChange={e=>change('effortHours',e.target.value===''?null:Number(e.target.value))}/></label>
    <label className="field"><span>{t('cost')}</span><input {...described('cost')} type="number" min="0" max="100000000" step="0.01" value={draft.cost??''} onChange={e=>change('cost',e.target.value===''?null:Number(e.target.value))}/></label>
    <label className="field"><span>{t('currency')}</span><select aria-label={t('currency')} value={draft.currency} onChange={e=>change('currency',e.target.value as Review['currency'])}><option>EUR</option><option>SEK</option></select></label>
    <label className="field"><span>{t('releaseDate')}</span><input {...described('releaseDate')} type="date" value={draft.releaseDate} onChange={e=>change('releaseDate',e.target.value)}/></label></div>
    <LanguageTabs lang={lang} setLang={setLang}/><TranslationField label={t('comment')} value={draft.comments} onChange={v=>change('comments',v)} lang={lang} rows={5}/>
    {error&&<div id={id+'-error'} className="error-banner" role="alert"><AlertCircle size={18}/>{t(error)}</div>}<DraftNotice {...draftState}/>
    </fieldset></div><footer className="modal-footer"><button type="button" className="button secondary" disabled={busy} onClick={()=>{if(window.confirm(t('unsaved'))){clear();onClose();}}}>{t('uxDiscard')}</button><button className="button secondary" type="button" disabled={busy} onClick={close}>{t('cancel')}</button><button className="button primary" type="submit" disabled={busy}>{busy?<LoaderCircle className="spin" size={16}/>:<Check size={16}/>} {t(busy?'saving':'save')}</button></footer></form></Modal>;
}
export function DeleteDialog({entry,onClose}:{entry:Entry;onClose:()=>void}){
  const {t}=useTranslation(),{deleteEntry}=useWorkspace(),toast=useToast();const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const remove=async()=>{setBusy(true);try{await deleteEntry(entry);toast(t('deleted'));onClose();}catch(e){setError(readableError(e));}finally{setBusy(false);}};
  return <Modal title={t('deleteTitle')} onClose={()=>{if(!busy)onClose();}}><div className="modal-body"><span className="delete-icon"><Trash2 size={24}/></span><p>{t('deleteBody')}</p><p className="small-note">{t('uxRestoreHelp')}</p><strong className="delete-target">{text(entry.title,'en')}</strong>{error&&<p className="error-banner" role="alert">{t(error)}</p>}</div><footer className="modal-footer"><button className="button secondary" data-autofocus disabled={busy} onClick={onClose}>{t('cancel')}</button><button className="button danger" disabled={busy} onClick={()=>void remove()}>{busy?<LoaderCircle className="spin" size={16}/>:<Trash2 size={16}/>} {t('delete')}</button></footer></Modal>;
}
