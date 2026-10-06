import {useId,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Building2,CarFront,Check,Hotel,LoaderCircle,ShieldCheck,Smartphone,Trash2,UserRound,Webhook} from 'lucide-react';
import {useWorkspace} from '../lib/store';
import {formatDate,text} from '../lib/i18n';
import {baselineIds,buildTree,groupKeys,groups} from '../lib/product-tree';
import type {Locale,Localized,ProductItem,ProductStatus} from '../lib/types';
import {Badge,Modal,useToast} from './ui';
import {LanguageTabs,TranslationField,readableError} from './Editors';
const icons:Record<string,typeof Smartphone>={'a-passenger':Smartphone,'a-driver':CarFront,'a-hotel':Hotel,'a-admin':ShieldCheck,'a-fleet':Building2,'a-partner':Webhook};
export const actorIcon=(id:string)=>icons[id]||UserRound;
const tones:Record<ProductStatus,string>={confirmed:'green',derived:'blue',clarify:'amber'};
export function ProductStatusBadge({status}:{status:ProductStatus}){const {t}=useTranslation();return <Badge tone={tones[status]}><span className="status-dot"/>{t('ptStatus_'+status)}</Badge>;}
/** Compact "not translated" marker for tight spots; LocalText showFallback covers roomy ones. */
export function Untranslated({value}:{value:Localized}){const {t,i18n}=useTranslation();return i18n.language!=='en'&&!value[i18n.language as Locale]?.trim()?<abbr className="pt-untranslated" title={t('uxTranslationMissing',{language:'EN'})}>EN</abbr>:null;}
/** "Created by … · Last edited by …": who did what is the point of these records. Handover items say they were imported, not authored. */
export function Byline({item,short=false}:{item:ProductItem;short?:boolean}){
  const {t,i18n}=useTranslation(),edited=item.updatedAt&&item.updatedAt!==item.createdAt,origin=baselineIds.has(item.id)?'ptImportedBy':'ptCreatedBy';
  if(short)return edited?<small className="pm-byline">{t('ptUpdatedBy',{name:item.updatedByName,date:formatDate(item.updatedAt,i18n.language,true)})}</small>:origin==='ptCreatedBy'?<small className="pm-byline">{t(origin,{name:item.createdByName,date:formatDate(item.createdAt,i18n.language,true)})}</small>:null;
  return <p className="pm-byline">{t(origin,{name:item.createdByName,date:formatDate(item.createdAt,i18n.language,true)})}{edited&&<> · {t('ptUpdatedBy',{name:item.updatedByName,date:formatDate(item.updatedAt,i18n.language,true)})}</>}</p>;
}
function useProductForm(initial:ProductItem){
  const [draft,setDraft]=useState(initial),[lang,setLang]=useState<Locale>(initial.version?initial.originalLocale:'en'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const change=<K extends keyof ProductItem>(k:K,v:ProductItem[K])=>{setDraft(d=>({...d,[k]:v}));setError('');};
  return {draft,change,lang,setLang,busy,setBusy,error,setError};
}
type Form=ReturnType<typeof useProductForm>;
function Fields({form,actors}:{form:Form;actors:ProductItem[]}){
  const {t,i18n}=useTranslation(),{draft,change,lang,setLang,error}=form,id=useId();
  return <>
    <LanguageTabs lang={lang} setLang={setLang}/>
    <TranslationField id={id+'-name'} label={t('ptName')+(lang==='en'?' *':'')} value={draft.name} onChange={v=>change('name',v)} lang={lang} title rows={1} error={error==='ptNameRequired'?t(error):undefined}/>
    {draft.kind==='actor'&&<TranslationField label={t('ptChannel')} value={draft.channel} onChange={v=>change('channel',v)} lang={lang} title rows={1}/>}
    <TranslationField label={t('details')} value={draft.description} onChange={v=>change('description',v)} lang={lang} rows={2}/>
    <div className="form-grid">
      <label className="field"><span>{t('status')}</span><select value={draft.status} onChange={e=>change('status',e.target.value as ProductStatus)}>{(['confirmed','derived','clarify'] as const).map(s=><option key={s} value={s}>{t('ptStatus_'+s)}</option>)}</select></label>
      {draft.kind==='module'&&<label className="field"><span>{t('ptGroup')}</span><select value={draft.group} onChange={e=>change('group',e.target.value as ProductItem['group'])} aria-invalid={error==='ptGroupRequired'||undefined}><option value="" disabled>—</option>{groupKeys.map(g=><option key={g} value={g}>{text(groups[g],i18n.language)}</option>)}</select>{error==='ptGroupRequired'&&<span className="field-error">{t(error)}</span>}</label>}
    </div>
    {draft.kind==='module'&&<fieldset className="pm-actor-picks"><legend>{t('ptActorsField')}</legend>{actors.map(a=>{const Icon=actorIcon(a.id),on=draft.actors.includes(a.id);
      return <div key={a.id} className={`pm-pick ${on?'is-on':''}`}>
        <label><input type="checkbox" checked={on} onChange={e=>{change('actors',e.target.checked?[...draft.actors,a.id]:draft.actors.filter(x=>x!==a.id));if(!e.target.checked)change('indirect',draft.indirect.filter(x=>x!==a.id));}}/><Icon size={15}/>{text(a.name,i18n.language)}</label>
        <label className="pm-pick-indirect"><input type="checkbox" disabled={!on} checked={draft.indirect.includes(a.id)} onChange={e=>change('indirect',e.target.checked?[...draft.indirect,a.id]:draft.indirect.filter(x=>x!==a.id))}/>{t('ptIndirect')}</label>
      </div>;})}</fieldset>}
  </>;
}
async function submit(form:Form,save:(i:ProductItem)=>Promise<ProductItem>,done:(i:ProductItem)=>void){
  form.setBusy(true);
  try{const next=await save({...form.draft,originalLocale:form.draft.version?form.draft.originalLocale:form.lang});done(next);}
  catch(e){const m=readableError(e);if(m==='ptNameRequired')form.setLang('en');form.setError(m);}
  finally{form.setBusy(false);}
}
/** Actor and module editor. Deleting is a second, explicit step inside the same dialog. */
export function ProductEditor({initial,onClose,onSaved,onDeleted}:{initial:ProductItem;onClose:()=>void;onSaved?:(i:ProductItem)=>void;onDeleted?:()=>void}){
  const {t}=useTranslation(),{data,saveProductItem,deleteProductItem}=useWorkspace(),toast=useToast(),form=useProductForm(initial),[confirming,setConfirming]=useState(false);
  const tree=buildTree(data?.productItems),subs=initial.kind==='module'?tree.subsOf(initial.id).length:0,creating=!initial.version;
  const title=t(creating?(initial.kind==='actor'?'ptNewActor':'ptNewModule'):(initial.kind==='actor'?'ptEditActor':'ptEditModule'));
  const remove=async()=>{form.setBusy(true);try{await deleteProductItem(initial);toast(t('deleted'));onClose();onDeleted?.();}catch(e){form.setError(readableError(e));form.setBusy(false);}};
  if(confirming)return <Modal title={t(initial.kind==='actor'?'ptDeleteActor':'ptDeleteModule')} onClose={()=>{if(!form.busy)setConfirming(false);}}><div className="modal-body"><span className="delete-icon"><Trash2 size={24}/></span><p>{initial.kind==='module'?t('ptDeleteModuleBody',{count:subs}):t('ptDeleteBody')}</p><strong className="delete-target">{text(initial.name,'en')}</strong>{form.error&&<p className="error-banner" role="alert">{t(form.error)}</p>}</div>
    <footer className="modal-footer"><button className="button secondary" data-autofocus disabled={form.busy} onClick={()=>setConfirming(false)}>{t('cancel')}</button><button className="button danger" disabled={form.busy} onClick={()=>void remove()}>{form.busy?<LoaderCircle className="spin" size={16}/>:<Trash2 size={16}/>}{t('delete')}</button></footer></Modal>;
  return <Modal title={title} onClose={()=>{if(!form.busy)onClose();}} wide><form noValidate onSubmit={e=>{e.preventDefault();void submit(form,saveProductItem,i=>{toast(t('saved'));onClose();onSaved?.(i);});}}>
    <div className="modal-body"><fieldset className="editor-fields" disabled={form.busy}><Fields form={form} actors={tree.actors}/>{form.error&&!['ptNameRequired','ptGroupRequired'].includes(form.error)&&<p className="error-banner" role="alert">{t(form.error)}</p>}</fieldset>
      {!creating&&<Byline item={initial}/>}</div>
    <footer className="modal-footer">{!creating&&<button type="button" className="button secondary pm-danger" disabled={form.busy} onClick={()=>setConfirming(true)}><Trash2 size={15}/>{t(initial.kind==='actor'?'ptDeleteActor':'ptDeleteModule')}</button>}
      <button type="button" className="button secondary" disabled={form.busy} onClick={onClose}>{t('cancel')}</button><button className="button primary" disabled={form.busy}>{form.busy?<LoaderCircle className="spin" size={16}/>:<Check size={16}/>}{t(form.busy?'saving':creating?(initial.kind==='actor'?'ptAddActor':'ptAddModule'):'save')}</button></footer>
  </form></Modal>;
}
/** Submodules are edited in place, inside the module page list. */
export function SubForm({initial,onDone}:{initial:ProductItem;onDone:()=>void}){
  const {t}=useTranslation(),{saveProductItem}=useWorkspace(),toast=useToast(),form=useProductForm(initial);
  return <form className="pm-subform" noValidate onSubmit={e=>{e.preventDefault();void submit(form,saveProductItem,()=>{toast(t('saved'));onDone();});}} onKeyDown={e=>{if(e.key==='Escape'&&!form.busy){e.stopPropagation();onDone();}}}>
    <fieldset className="editor-fields" disabled={form.busy}><Fields form={form} actors={[]}/>{form.error&&form.error!=='ptNameRequired'&&<p className="error-banner" role="alert">{t(form.error)}</p>}</fieldset>
    <div className="pm-subform-actions"><button type="button" className="button secondary small" disabled={form.busy} onClick={onDone}>{t('cancel')}</button><button className="button primary small" disabled={form.busy}>{form.busy?<LoaderCircle className="spin" size={15}/>:<Check size={15}/>}{t(form.busy?'saving':initial.version?'save':'ptAddSub')}</button></div>
  </form>;
}
export function ProductDeleteDialog({item,onClose}:{item:ProductItem;onClose:()=>void}){
  const {t}=useTranslation(),{deleteProductItem}=useWorkspace(),toast=useToast(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const remove=async()=>{setBusy(true);try{await deleteProductItem(item);toast(t('deleted'));onClose();}catch(e){setError(readableError(e));setBusy(false);}};
  return <Modal title={t('deleteTitle')} onClose={()=>{if(!busy)onClose();}}><div className="modal-body"><span className="delete-icon"><Trash2 size={24}/></span><p>{t('ptDeleteBody')}</p><strong className="delete-target">{text(item.name,'en')}</strong>{error&&<p className="error-banner" role="alert">{t(error)}</p>}</div>
    <footer className="modal-footer"><button className="button secondary" data-autofocus disabled={busy} onClick={onClose}>{t('cancel')}</button><button className="button danger" disabled={busy} onClick={()=>void remove()}>{busy?<LoaderCircle className="spin" size={16}/>:<Trash2 size={16}/>}{t('delete')}</button></footer></Modal>;
}
