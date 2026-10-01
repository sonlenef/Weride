import {useId,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Check,Pencil,Send,Trash2} from 'lucide-react';
import {useWorkspace} from '../lib/store';
import {useAuth} from '../lib/auth';
import {useDraft} from '../lib/useDraft';
import {canEditReply,localeNames,replyError} from '../lib/collaboration';
import {blankText,locales} from '../lib/types';
import type {Entry,Locale,Reply} from '../lib/types';
import {formatDate} from '../lib/i18n';
import {Badge,LocalText,Modal,useToast} from './ui';
import {DraftNotice,LanguageTabs,TranslationField,readableError} from './Editors';
export const newReply=(questionId:string,locale:Locale):Reply=>({id:crypto.randomUUID(),questionId,body:blankText(),originalLocale:locale,version:0,createdBy:'',createdByName:'',updatedBy:'',updatedByName:''});
export function ReplyEditor({initial,onClose,draftKey}:{initial:Reply;onClose:()=>void;draftKey?:string}){
  const {t}=useTranslation(),{saveReply}=useWorkspace(),toast=useToast();
  const ds=useDraft(draftKey||`reply:${initial.id}`,initial,'reply',initial.questionId),[lang,setLang]=useState(initial.originalLocale),[busy,setBusy]=useState(false),[error,setError]=useState(''),id=useId();
  const save=async()=>{const issue=replyError(ds.draft);if(issue){setError(issue);setLang(ds.draft.originalLocale);requestAnimationFrame(()=>document.getElementById(id)?.focus());return;}setBusy(true);try{await saveReply(ds.draft);ds.clear();toast(t('uxReplySaved'));onClose();}catch(e){setError(readableError(e));}finally{setBusy(false);}};
  return <Modal title={t('uxReply')} onClose={()=>{if(!busy)onClose();}}><form noValidate onSubmit={e=>{e.preventDefault();void save();}}><div className="modal-body"><fieldset className="editor-fields" disabled={busy}><LanguageTabs lang={lang} setLang={setLang}/><TranslationField id={id} label={t('uxReplyText')} value={ds.draft.body} onChange={body=>ds.setDraft({...ds.draft,body})} lang={lang} error={error?t(error):undefined}/><DraftNotice {...ds}/></fieldset></div><footer className="modal-footer"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>{t('cancel')}</button><button className="button primary" disabled={busy}>{t(busy?'saving':'save')}</button></footer></form></Modal>;
}
export default function ReplyThread({question}:{question:Entry}){
  const {data,online,saveReply,deleteReply,acceptReply}=useWorkspace(),{member,preview}=useAuth(),{t,i18n}=useTranslation(),toast=useToast();
  const replies=(data?.replies||[]).filter(r=>r.questionId===question.id).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
  const resolution=data?.resolutions?.find(r=>r.id===question.id),ownQuestion=question.createdBy===member?.uid;
  const ds=useDraft(`reply:new:${question.id}`,newReply(question.id,i18n.language as Locale),'reply',question.requirementId||t('qhGeneral'));
  const [lang,setLang]=useState<Locale>(ds.draft.originalLocale),[busy,setBusy]=useState(false),[error,setError]=useState(''),[limit,setLimit]=useState(10);
  const [editing,setEditing]=useState<Reply|null>(null),[deleting,setDeleting]=useState<Reply|null>(null),id=useId();const writable=Boolean(member)&&(online||preview);
  const post=async()=>{const issue=replyError(ds.draft);if(issue){setError(issue);setLang(ds.draft.originalLocale);requestAnimationFrame(()=>document.getElementById(id)?.focus());return;}setBusy(true);setError('');try{await saveReply(ds.draft);ds.clear(newReply(question.id,lang));toast(t('uxReplySaved'));}catch(e){setError(readableError(e));}finally{setBusy(false);}};
  const resolve=async(replyId:string)=>{setBusy(true);setError('');try{await acceptReply(question.id,replyId,resolution?.version||0);toast(t(replyId?'uxAccepted':'uxReopen'));}catch(e){setError(readableError(e));}finally{setBusy(false);}};
  return <section className="reply-thread" aria-label={t('uxReplies')}><h4>{t('uxReplies')} <Badge>{replies.length}</Badge></h4><p className="small-note">{t('uxReplyPolicy')}</p>
    {replies.slice(0,limit).map(r=>{const accepted=resolution?.replyId===r.id&&resolution.replyVersion===r.version;const name=data?.members?.find(p=>p.uid===r.createdBy)?.displayName||r.createdByName;return <article className={`reply-card ${accepted?'is-accepted':''}`} key={r.id} data-reply-id={r.id}>
      <header><strong>{name}</strong><time dateTime={r.createdAt}>{formatDate(r.createdAt,i18n.language,true)}</time>{accepted&&<Badge tone="green">{t('uxAccepted')}</Badge>}</header>
      {r.external&&<p className="small-note"><Badge tone="blue">{t('cqClientSource')}</Badge> · {t(({answer:'cqAnswer',clarify:'cqClarify',not_applicable:'cqNotApplicable',later:'cqLater'} as Record<string,string>)[r.external.answerKind]||'cqClientSource')} · {r.external.publicationId.slice(0,8)}</p>}<LocalText as="p" value={r.body} showFallback/><footer><span>{t('version')} {r.version}</span>
        {canEditReply(r,member?.uid,data?.resolutions)&&<><button className="button secondary small" disabled={busy||!writable} onClick={()=>setEditing(r)}><Pencil size={14}/>{t('edit')}</button><button className="button secondary small" disabled={busy||!writable} onClick={()=>setDeleting(r)}><Trash2 size={14}/>{t('delete')}</button></>}
        {ownQuestion&&<button className="button secondary small" disabled={busy||!writable} onClick={()=>void resolve(accepted?'':r.id)}><Check size={14}/>{t(accepted?'uxReopen':'uxAccept')}</button>}
      </footer>{accepted&&<small>{t('uxAcceptedLocked')}</small>}</article>;})}
    {replies.length>limit&&<button className="button secondary small" onClick={()=>setLimit(n=>n+10)}>{t('aiLoadMore')}</button>}
    {!replies.length&&<p className="small-note">{t('uxNoReplies')}</p>}
    <form className="reply-composer" noValidate onSubmit={e=>{e.preventDefault();void post();}}><fieldset className="editor-fields" disabled={busy||!writable}>
      <label className="field"><span>{t('uxSourceLanguage')}</span><select aria-label={t('uxSourceLanguage')} value={lang} onChange={e=>{const l=e.target.value as Locale;setLang(l);if(!Object.values(ds.draft.body).some(v=>v.trim()))ds.setDraft({...ds.draft,originalLocale:l});}}>{locales.map(l=><option key={l} value={l}>{localeNames[l]}</option>)}</select></label>
      <TranslationField id={id} label={t('uxReplyText')} value={ds.draft.body} onChange={body=>{ds.setDraft({...ds.draft,body});setError('');}} lang={lang} rows={3} error={error==='uxReplyRequired'?t(error):undefined}/>
      {error&&<p className="error-banner" role="alert">{t(error)}</p>}<button className="button primary" type="submit" disabled={busy||!writable}><Send size={15}/>{t(busy?'saving':'uxPostReply')}</button><DraftNotice {...ds}/>
    </fieldset></form>
    {editing&&<ReplyEditor initial={editing} onClose={()=>setEditing(null)}/>}
    {deleting&&<Modal title={t('uxReplyDelete')} onClose={()=>{if(!busy)setDeleting(null);}}><div className="modal-body"><LocalText as="p" value={deleting.body}/>{error&&<p role="alert" className="error-banner">{t(error)}</p>}</div><footer className="modal-footer"><button className="button secondary" data-autofocus disabled={busy} onClick={()=>setDeleting(null)}>{t('cancel')}</button><button className="button danger" disabled={busy} onClick={async()=>{setBusy(true);try{await deleteReply(deleting);setDeleting(null);toast(t('deleted'));}catch(e){setError(readableError(e));}finally{setBusy(false);}}}>{t('delete')}</button></footer></Modal>}
  </section>;
}
