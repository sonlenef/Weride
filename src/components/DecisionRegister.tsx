import {useId,useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {Plus,Pencil,Check} from 'lucide-react';
import {useWorkspace} from '../lib/store';
import {useAuth} from '../lib/auth';
import {useDraft} from '../lib/useDraft';
import {decisionError,localeNames} from '../lib/collaboration';
import {blankText,locales} from '../lib/types';
import type {Decision,Locale} from '../lib/types';
import {formatDate,text} from '../lib/i18n';
import {Badge,LocalText,Modal,useToast} from './ui';
import {DraftNotice,LanguageTabs,TranslationField,readableError} from './Editors';
export const newDecision=(locale:Locale):Decision=>({id:crypto.randomUUID(),title:blankText(),body:blankText(),originalLocale:locale,state:'proposed',source:'',ownerUid:'',requirementIds:[],version:0,createdBy:'',createdByName:'',updatedBy:'',updatedByName:'',confirmedBy:'',confirmedAt:null});
export function DecisionEditor({initial,onClose,draftKey}:{initial:Decision;onClose:()=>void;draftKey?:string}){
  const {data,saveDecision}=useWorkspace(),{t}=useTranslation(),toast=useToast();
  const ds=useDraft(draftKey||`decision:${initial.version?initial.id:'new'}`,initial,'decision',text(initial.title,'en')||t('uxDecisionNew'));
  const [lang,setLang]=useState(ds.draft.originalLocale),[busy,setBusy]=useState(false),[error,setError]=useState(''),id=useId();
  const change=<K extends keyof Decision>(k:K,v:Decision[K])=>{ds.setDraft({...ds.draft,[k]:v});setError('');};
  const save=async()=>{const issue=decisionError(ds.draft);if(issue){setError(issue);requestAnimationFrame(()=>document.getElementById(id+(issue==='uxDecisionEvidence'?'-source':'-title'))?.focus());return;}setBusy(true);try{await saveDecision(ds.draft);ds.clear();toast(t('saved'));onClose();}catch(e){setError(readableError(e));}finally{setBusy(false);}};
  return <Modal title={t(initial.version?'edit':'uxDecisionNew')} onClose={()=>{if(!busy)onClose();}} wide><form noValidate onSubmit={e=>{e.preventDefault();void save();}}><div className="modal-body"><fieldset className="editor-fields" disabled={busy}>
    <p className="small-note">{t('uxDecisionPolicy')}</p><LanguageTabs lang={lang} setLang={l=>{setLang(l);if(!Object.values(ds.draft.title).some(v=>v.trim()))change('originalLocale',l);}}/>
    <TranslationField id={id+'-title'} label={t('title')} value={ds.draft.title} onChange={v=>change('title',v)} lang={lang} title error={error==='uxQuestionRequired'?t(error):undefined}/>
    <TranslationField label={t('details')} value={ds.draft.body} onChange={v=>change('body',v)} lang={lang} rows={4}/>
    <div className="form-grid"><label className="field"><span>{t('status')}</span><select aria-label={t('status')} value={ds.draft.state} onChange={e=>change('state',e.target.value as Decision['state'])}><option value="proposed">{t('uxProposed')}</option><option value="confirmed">{t('confirmed')}</option><option value="superseded">{t('uxSuperseded')}</option></select></label>
    <label className="field"><span>{t('uxDecisionOwner')}</span><select aria-label={t('uxDecisionOwner')} value={ds.draft.ownerUid} onChange={e=>change('ownerUid',e.target.value)}><option value="">{t('unassigned')}</option>{data?.members?.filter(p=>p.active).map(p=><option key={p.uid} value={p.uid}>{p.displayName}</option>)}</select></label></div>
    <label className="field"><span>{t('uxDecisionSource')}</span><textarea id={id+'-source'} aria-label={t('uxDecisionSource')} value={ds.draft.source} onChange={e=>change('source',e.target.value)} rows={3} maxLength={4000} aria-invalid={error==='uxDecisionEvidence'||undefined}/>{error==='uxDecisionEvidence'&&<span className="field-error">{t(error)}</span>}</label>
    <details className="editor-advanced"><summary>{t('uxDecisionRelated')} · {ds.draft.requirementIds.length}</summary><div className="decision-requirements">{data?.requirements.map(r=><label key={r.id}><input type="checkbox" checked={ds.draft.requirementIds.includes(r.id)} onChange={e=>change('requirementIds',e.target.checked?[...ds.draft.requirementIds,r.id]:ds.draft.requirementIds.filter(x=>x!==r.id))}/>{r.id} · {text(r.title,lang)}</label>)}</div></details>
    <label className="field"><span>{t('uxSourceLanguage')}</span><select value={ds.draft.originalLocale} onChange={e=>change('originalLocale',e.target.value as Locale)}>{locales.map(l=><option value={l} key={l}>{localeNames[l]}</option>)}</select></label>
    {error&&<p className="error-banner" role="alert">{t(error)}</p>}<DraftNotice {...ds}/></fieldset></div><footer className="modal-footer"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>{t('cancel')}</button><button className="button primary" disabled={busy}><Check size={15}/>{t(busy?'saving':'save')}</button></footer></form></Modal>;
}
export default function DecisionRegister(){
  const {data,online}=useWorkspace(),{member,preview}=useAuth(),{t,i18n}=useTranslation();
  const [editing,setEditing]=useState<Decision|null>(null),[status,setStatus]=useState('');
  const decisions=(data?.decisions||[]).filter(d=>!status||d.state===status).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
  return <section className="panel decision-register" id="decisions"><header className="section-heading"><div><h2>{t('uxDecisions')}</h2><p>{t('uxDecisionPolicy')}</p></div><button className="button primary" disabled={!online&&!preview} onClick={()=>setEditing(newDecision(i18n.language as Locale))}><Plus size={16}/>{t('uxDecisionNew')}</button></header>
    <label className="field"><span>{t('status')}</span><select value={status} aria-label={t('status')} onChange={e=>setStatus(e.target.value)}><option value="">{t('allStatuses')}</option><option value="proposed">{t('uxProposed')}</option><option value="confirmed">{t('confirmed')}</option><option value="superseded">{t('uxSuperseded')}</option></select></label>
    {!decisions.length&&<p className="small-note">{t('uxNoDecisions')}</p>}
    {decisions.map(d=><article className="decision-card" id={'decision-'+d.id} key={d.id}><header><Badge tone={d.state==='confirmed'?'green':'neutral'}>{t(d.state==='proposed'?'uxProposed':d.state==='superseded'?'uxSuperseded':'confirmed')}</Badge><span>{t('version')} {d.version}</span>{d.createdBy===member?.uid&&<button className="button secondary small" disabled={!online&&!preview} onClick={()=>setEditing(d)}><Pencil size={14}/>{t('edit')}</button>}</header><LocalText as="h3" value={d.title} showFallback/><LocalText as="p" value={d.body} showFallback/>
      <dl><dt>{t('uxDecisionSource')}</dt><dd>{d.source||t('uxNoRecord')}</dd><dt>{t('uxDecisionOwner')}</dt><dd>{data?.members?.find(p=>p.uid===d.ownerUid)?.displayName||t('unassigned')}</dd>{d.confirmedBy&&<><dt>{t('uxDecisionRecorded')}</dt><dd>{data?.members?.find(p=>p.uid===d.confirmedBy)?.displayName||d.updatedByName} · {formatDate(d.confirmedAt||'',i18n.language,true)}</dd></>}</dl>
      <nav aria-label={t('uxDecisionRelated')}>{d.requirementIds.map(id=><Link key={id} className="button secondary small" to={`/requirements/${id}`}>{id}</Link>)}</nav>
    </article>)}
    <details className="decision-source-issues"><summary>{t('attention')}</summary>{data?.project.clarifications.map(c=><div key={c.id}><strong>{text(c.title,i18n.language)}</strong><button className="button secondary small" disabled={!online&&!preview} onClick={()=>setEditing({...newDecision('en'),title:{...c.title},body:{...c.body},source:c.pages})}>{t('uxDecisionNew')}</button></div>)}</details>
    {editing&&<DecisionEditor initial={editing} onClose={()=>setEditing(null)}/>}
  </section>;
}
