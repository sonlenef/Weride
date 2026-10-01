import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, UserRound, UserRoundPlus, Pencil, Check, LoaderCircle } from 'lucide-react';
import { useWorkspace } from '../lib/store';
import { useAuth } from '../lib/auth';
import { eligiblePic, memberLabel } from '../lib/assignment';
import { formatDate } from '../lib/i18n';
import type { Assignment } from '../lib/types';
import { Modal, useToast } from './ui';
function PicEditor({id,initial,onClose}:{id:string;initial:Assignment|null;onClose:()=>void}) {
  const {data,saveAssignment,directoryError}=useWorkspace(),{member}=useAuth();
  const {t}=useTranslation(),toast=useToast();
  const [uid,setUid]=useState(initial?.assigneeUid||''),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const people=(data?.members||[]).filter(eligiblePic).sort((a,b)=>memberLabel(a).localeCompare(memberLabel(b)));
  const matches=people.filter(p=>p.uid===uid||`${memberLabel(p)} ${p.email}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));
  const selected=people.find(p=>p.uid===uid),unchanged=uid===(initial?.assigneeUid||'');
  const submit=async()=>{
    setError('');setBusy(true);
    try {await saveAssignment(id,uid,initial?.version||0);toast(t(uid?'picSaved':'picRemoved'));onClose();}
    catch(e){const message=(e as Error).message;setError(['conflict','picInvalidMember','notFound'].includes(message)?message:'writeError');}
    finally {setBusy(false);}
  };
  return <Modal title={`${t('picAssign')} · ${id}`} onClose={()=>{if(!busy)onClose();}}>
    <form onSubmit={e=>{e.preventDefault();void submit();}}>
      <div className="modal-body pic-editor"><p className="pic-help">{t('picHelp')}</p>
        {directoryError&&<p className="error-banner" role="alert">{t(directoryError)}</p>}
        {error&&<p className="error-banner" role="alert">{t(error)}</p>}
        <label className="pic-field"><span>{t('picSearch')}</span><span className="search-field"><Search size={16}/><input aria-label={t('picSearch')} value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('picSearchPlaceholder')} /></span></label>
        <label className="pic-field"><span>{t('picSelect')}</span><select aria-label={t('picSelect')} value={uid} disabled={busy} onChange={e=>setUid(e.target.value)}>
          <option value="">{t('picUnassigned')}</option>
          {uid&&!selected&&<option value={uid} disabled>{t('picUnavailable')}</option>}
          {matches.map(p=><option key={p.uid} value={p.uid}>{memberLabel(p)} · {p.email}</option>)}
        </select></label>
        {!people.length&&<p className="pic-help">{t('picEmpty')}</p>}
        {query&&people.length>0&&matches.length===0&&<p className="pic-help">{t('picNoMatches')}</p>}
        {selected&&<div className="pic-person-preview"><span className="pic-avatar">{memberLabel(selected).split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase()}</span><div><strong>{memberLabel(selected)}</strong><small>{selected.email}</small></div><Check size={17}/></div>}
        <div className="pic-shortcuts">{people.some(p=>p.uid===member?.uid)&&<button type="button" className="button secondary small" disabled={busy||uid===member?.uid} onClick={()=>setUid(member!.uid)}>{t('picAssignMe')}</button>}{uid&&<button type="button" className="button secondary small" disabled={busy} onClick={()=>setUid('')}>{t('picRemove')}</button>}</div>
        <p className="pic-help">{t('picNoAccessChange')}</p>
      </div><footer className="modal-footer"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>{t('cancel')}</button><button type="submit" className="button primary" disabled={busy||unchanged||Boolean(uid&&!selected)}>{busy&&<LoaderCircle size={15} className="spin"/>}{t(busy?'saving':'picSave')}</button></footer>
    </form>
  </Modal>;
}
export default function PicAssignment({requirementId,compact=false}:{requirementId:string;compact?:boolean}) {
  const {data,online}=useWorkspace(),{preview}=useAuth(),{t,i18n}=useTranslation();
  const [editing,setEditing]=useState<{initial:Assignment|null}|null>(null);
  const current=data?.assignments?.find(a=>a.id===requirementId),person=data?.members?.find(p=>p.uid===current?.assigneeUid);
  const assigned=Boolean(current?.assigneeUid),name=assigned?memberLabel(person)||t('picUnavailable'):t('picUnassigned');
  const button=<button type="button" className={`pic-button ${assigned?'is-assigned':''}`} disabled={!online&&!preview} onClick={()=>setEditing({initial:current?{...current}:null})} aria-label={`${t('picAssign')} ${requirementId}`} title={name}>
    {assigned?<span className="pic-avatar">{name.split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase()}</span>:<UserRoundPlus size={17}/>}
    <span className="pic-person-name">{name}{assigned&&person?.active===false&&<small>{t('picInactive')}</small>}</span><Pencil size={13} className="pic-edit-icon"/>
  </button>;
  return <>{compact?button:<section className="pic-panel" aria-label={t('picLabel')}><div className="pic-panel-label"><UserRound size={18}/><div><strong>{t('picLabel')}</strong><p>{t('picPanelHint')}</p></div></div><div className="pic-panel-value">{button}{current?.updatedAt&&<small>{t('picUpdated')} {formatDate(current.updatedAt,i18n.language,true)}</small>}</div></section>}{editing&&<PicEditor key={requirementId} id={requirementId} initial={editing.initial} onClose={()=>setEditing(null)}/>}</>;
}
