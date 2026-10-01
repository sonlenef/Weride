import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Globe2, LoaderCircle, X } from 'lucide-react';
import type { Localized } from '../lib/types';
import { text, resolvedLocale } from '../lib/i18n';
import { hasTranslation } from '../lib/helpers';
export function Brand({compact=false}:{compact?:boolean}) {return <div className="brand"><span className="brand-mark"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m8 12 6 17 6-12 6 12 6-17"/></svg></span>{!compact&&<span>we<span className="brand-light">ride</span><small>DISCOVERY</small></span>}</div>;}
export function LocaleSwitch(){const {i18n,t}=useTranslation();return <label className="locale-switch"><Globe2 size={15}/><span className="sr-only">{t('displayLanguage')}</span><select value={i18n.language} onChange={e=>void i18n.changeLanguage(e.target.value)} aria-label={t('displayLanguage')}><option value="en">English</option><option value="vi">Tiếng Việt</option><option value="sv">Svenska</option></select><ChevronDown size={12}/></label>;}
export function LocalText({value,as:Tag='span',className='',showFallback=false}:{value:Localized|undefined;as?:'span'|'p'|'h2'|'h3';className?:string;showFallback?:boolean}){const {i18n,t}=useTranslation();return <Tag className={className} lang={resolvedLocale(value,i18n.language)}>{text(value,i18n.language)}{showFallback&&value&&!hasTranslation(value,i18n.language)&&<small className="fallback">{t('uxTranslationMissing',{language:resolvedLocale(value,i18n.language).toUpperCase()})}</small>}</Tag>;}
export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:string}){return <span className={`badge badge-${tone}`}>{children}</span>;}
export const statusTone=(status:string)=>['done','resolved','confirmed','scoped','FC'].includes(status)?'green':['open','unvalidated','reviewing','PC','CU'].includes(status)?'amber':['rejected','critical','NC'].includes(status)?'red':['progress','answered','clarified','RD'].includes(status)?'blue':'neutral';
export function StatusBadge({status}:{status:string}){const{t}=useTranslation();return <Badge tone={statusTone(status)}><span className="status-dot"/>{t(status||'unassessed')}</Badge>;}
export function Spinner(){const{t}=useTranslation();return <div className="loading-state"><LoaderCircle className="spin" size={26}/><p>{t('loading')}</p></div>;}
export function Modal({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}) {
  const dialog=useRef<HTMLDialogElement>(null),id=useId();const{t}=useTranslation();
  const opener=useRef<HTMLElement|null>(typeof document!=='undefined'?document.activeElement as HTMLElement:null);
  useEffect(()=>{
    const d=dialog.current;if(!d)return;const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';d.showModal();
    const frame=requestAnimationFrame(()=>{
      const first=d.querySelector<HTMLElement>('[data-autofocus],textarea:not([disabled]),input:not([disabled]),select:not([disabled])');
      (first||d.querySelector<HTMLElement>('button'))?.focus({preventScroll:true});
    });
    return()=>{
      cancelAnimationFrame(frame);d.close();document.body.style.overflow=overflow;
      requestAnimationFrame(()=>{
        if(d.isConnected)return;
        const trigger=opener.current;
        if(trigger?.isConnected&&!trigger.closest('[inert]'))trigger.focus({preventScroll:true});
        else{const heading=document.querySelector<HTMLElement>('#main h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
      });
    };
  },[]);
  return <dialog className={`modal ${wide?'modal-wide':''}`} ref={dialog} aria-labelledby={id} onCancel={e=>{e.preventDefault();onClose();}}><header className="modal-header"><h2 id={id}>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label={t('close')}><X size={20}/></button></header>{children}</dialog>;
}
const ToastContext=createContext<(message:string)=>void>(()=>{});
export function ToastProvider({children}:{children:ReactNode}) {const[toast,setToast]=useState('');useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(timer);},[toast]);return <ToastContext.Provider value={setToast}>{children}{toast&&<div className="toast" role="status"><Check size={18}/>{toast}</div>}</ToastContext.Provider>;}
export const useToast=()=>useContext(ToastContext);
