import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {ArrowRight,Building2,CarFront,CircleHelp,Download,Hotel,MessageSquareText,ShieldCheck,Smartphone,UsersRound,X} from 'lucide-react';
import {useWorkspace} from '../lib/store';
import {actors,actorsOf,actorMapCsv,features,featureOf} from '../lib/actor-map';
import type {Actor} from '../lib/actor-map';
import {download} from '../lib/helpers';
import type {Requirement} from '../lib/types';
import {Badge,LocalText} from '../components/ui';
import './actor-map.css';
const icons:Record<string,typeof Smartphone>={actorPassenger:Smartphone,actorDriver:CarFront,actorHotel:Hotel,actorAdmin:ShieldCheck,actorCarrier:Building2};
export default function ActorMap(){
  const {data}=useWorkspace(),{t,i18n}=useTranslation(),[params,setParams]=useSearchParams(),[hover,setHover]=useState<string[]>([]);
  const d=data!,byId=new Map(d.requirements.map(r=>[r.id,r])),req=byId.get(params.get('l')||''),pinned=req?.id||'',shared=params.get('shared')==='1',unsureOnly=params.get('unsure')==='1';
  const keep=(a:Actor,id:string)=>(!shared||actorsOf(id).length>1)&&(!unsureOnly||a.unsure.includes(id)),questions=new Map<string,number>();
  for(const e of d.entries)if(e.kind==='qa')questions.set(e.requirementId,(questions.get(e.requirementId)||0)+1);
  const feature=req?undefined:features.find(f=>f.key===params.get('f')),reqFeature=req&&featureOf(req.id);
  const update=(changes:Record<string,string>)=>{const next=new URLSearchParams(window.location.search);for(const [k,v] of Object.entries(changes))v?next.set(k,v):next.delete(k);setParams(next,{replace:true});};
  useEffect(()=>{if(!pinned&&!feature)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')update({l:'',f:''});};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[pinned,feature]);
  const active=new Set(hover.length?hover:pinned?[pinned]:feature?.ids||[]),state=(on:boolean)=>active.size?on?'is-linked':'is-dim':'',hits=(ids:string[])=>ids.some(id=>active.has(id));
  const hoverProps=(ids:string[])=>({onMouseEnter:()=>setHover(ids),onMouseLeave:()=>setHover([]),onFocus:()=>setHover(ids),onBlur:()=>setHover([])});
  const pill=(f:typeof features[number])=><button type="button" key={f.key} aria-pressed={feature===f} className="am-pill" {...hoverProps(f.ids)} onClick={()=>update({f:feature===f?'':f.key,l:''})}>{t(f.label)}<span>{f.ids.length}</span></button>;
  return <div className="page-enter am-page">
    <div className="page-heading"><div><h1>{t('actorMapTitle')}</h1><p>{t('actorMapSubtitle')}</p></div><div className="am-controls"><label className="am-toggle"><input type="checkbox" checked={shared} onChange={e=>update({shared:e.target.checked?'1':''})}/>{t('actorSharedOnly')}</label><label className="am-toggle"><input type="checkbox" checked={unsureOnly} onChange={e=>update({unsure:e.target.checked?'1':''})}/>{t('actorUnsureOnly')}</label><button type="button" className="button secondary small" onClick={()=>download('weride-actor-map.csv',actorMapCsv(d.requirements,keep,t,i18n.language),'text/csv;charset=utf-8')}><Download size={15}/>{t('actorExport')}</button></div></div>
    <div className="am-features" role="group" aria-label={t('actorFeatures')}><strong>{t('actorFeatures')}</strong>{features.map(pill)}</div>
    <section className="am-tree" aria-label={t('actorMap')}>
      <div className="am-root"><UsersRound size={19}/><strong>WeRide Sweden</strong><span>{d.requirements.length} {t('requirements')}</span></div>
      <div className="am-actors">{actors.map(a=>{const Icon=icons[a.key];
        return <div key={a.key} className={`am-actor ${state(hits(a.ids))}`}>
          <div className="am-actor-head"><Icon size={20}/><div><h2>{t(a.key)}</h2><span>{a.ids.length} {t('requirements')}</span></div></div>
          {features.map(f=>{const rows=f.ids.filter(id=>a.ids.includes(id)).map(id=>byId.get(id)).filter((r):r is Requirement=>!!r&&keep(a,r.id));
            return rows.length>0&&<div key={f.key} className={`am-feature ${state(hits(rows.map(r=>r.id)))}`}><h3>{t(f.label)}</h3><ul>{rows.map(r=>{const n=actorsOf(r.id).length,q=questions.get(r.id)||0,unsure=a.unsure.includes(r.id);
              return <li key={r.id}><button type="button" aria-pressed={pinned===r.id} className={`am-chip ${unsure?'is-unsure':''} ${state(active.has(r.id))}`} title={unsure?t('actorUnsure'):undefined} {...hoverProps([r.id])} onClick={()=>update({l:pinned===r.id?'':r.id,f:''})}>
                <span className="am-id">{r.id}</span><span className={`am-tag ${r.tier==='L2'?'is-l2':''}`}>{r.tier==='L2'?'L2':r.module}</span><LocalText value={r.title} className="am-title"/>{unsure&&<span className="sr-only">{t('actorUnsure')}</span>}<span className={`am-q ${q?'':'is-empty'}`} aria-label={t('actorQuestionCount',{count:q})} title={t('actorQuestionCount',{count:q})}><MessageSquareText size={12}/>{q}</span>{n>1&&<span className="am-shared" aria-label={t('actorShared',{count:n})}><UsersRound size={12}/>{n}</span>}
              </button></li>;})}</ul></div>;})}
        </div>;})}</div>
    </section>
    {req&&<section className="am-detail" aria-label={req.id}>
      <div className="am-detail-head"><div><span className="am-id">{req.id}</span><Badge tone={req.tier==='L2'?'purple':'green'}>{req.tier}</Badge><Badge>{t('actorModule'+req.module)}</Badge></div><button type="button" className="icon-button" onClick={()=>update({l:''})} aria-label={t('actorUnpin')} title={t('actorUnpin')}><X size={18}/></button></div>
      <LocalText as="h2" value={req.title}/><LocalText as="p" value={req.description}/>
      <div className="am-used"><strong>{t('actorUsedBy')}</strong>{actorsOf(req.id).map(a=>{const unsure=a.unsure.includes(req.id);return <span key={a.key} className={unsure?'is-unsure':''} title={unsure?t('actorUnsure'):undefined}>{t(a.key)}{unsure&&<CircleHelp size={13} aria-label={t('actorUnsure')}/>}</span>;})}</div>
      {reqFeature&&<div className="am-used"><strong>{t('actorFeature')}</strong>{pill(reqFeature)}</div>}
      <div className="am-actions"><Link className="button primary small" to={`/requirements/${encodeURIComponent(req.id)}`}>{t('actorOpenRequirement')}<ArrowRight size={15}/></Link><Link className="button secondary small" to={`/questions?scope=${encodeURIComponent(req.id)}`}><MessageSquareText size={15}/>{t('actorViewQuestions',{count:questions.get(req.id)||0})}</Link></div>
    </section>}
  </div>;
}
