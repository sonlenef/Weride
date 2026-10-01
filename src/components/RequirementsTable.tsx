import { Fragment, useEffect, useId, useState } from 'react';
import { Link,useLocation,useSearchParams } from 'react-router-dom';
import { rememberScroll } from '../lib/preferences';
import { useTranslation } from 'react-i18next';
import { ArrowDownAZ, ArrowRight, ChevronDown, GitBranch, MessageSquareText, Search, ShieldQuestion } from 'lucide-react';
import { useWorkspace } from '../lib/store';
import { text } from '../lib/i18n';
import { newEntry } from '../lib/types';
import type { Entry, Requirement } from '../lib/types';
import { Badge, StatusBadge } from './ui';
import PicAssignment from './PicAssignment';
import InlineQuestions from './InlineQuestions';
interface Props { rows:Requirement[]; onSort?:()=>void; sorted?:boolean; }
export default function RequirementsTable({rows,onSort,sorted=false}:Props) {
  const {data}=useWorkspace(),{t,i18n}=useTranslation(),instance=useId();
  const location=useLocation(),[params,setParams]=useSearchParams();const expanded=params.get('open');
  const setExpanded=(value:string|null|((old:string|null)=>string|null))=>{const next=typeof value==='function'?value(expanded):value;const query=new URLSearchParams(window.location.search);next?query.set('open',next):query.delete('open');setParams(query,{replace:true,state:location.state});};
  const [drafts,setDrafts]=useState<Record<string,Entry>>({}),[busy,setBusy]=useState(false);
  const visible=rows.map(r=>r.id).join('|');
  useEffect(()=>{if(expanded&&!rows.some(r=>r.id===expanded))setExpanded(null);},[visible,expanded]);
  useEffect(()=>{if(expanded&&!drafts[expanded])setDrafts(old=>({...old,[expanded]:newEntry(expanded,'qa')}));},[expanded]);
  const returnTo=location.pathname+location.search;const remember=()=>rememberScroll(returnTo);
  const toggle=(id:string)=>{
    if(busy)return;
    setDrafts(old=>old[id]?old:{...old,[id]:newEntry(id,'qa')});
    setExpanded(old=>old===id?null:id);
  };
  return <div className="requirement-list"><p className="req-list-hint"><MessageSquareText size={14}/>{t('qaListHint')}</p><div className="table-scroll"><table className="requirements-table interactive-requirements" aria-label={t('matrix')}>
    <thead><tr><th aria-sort={sorted?'ascending':'none'}>{onSort?<button className="sort-button" onClick={onSort}>ID<ArrowDownAZ size={14}/></button>:'ID'}</th><th>{t('requirement')}</th><th>{t('tier')}</th><th>{t('compliance')}</th><th>{t('reviewStatus')}</th><th>{t('picColumn')}</th><th>{t('discovery')}</th><th><span className="sr-only">{t('details')}</span></th></tr></thead>
    <tbody>{rows.map(r=>{
      const rev=data!.reviews.find(v=>v.id===r.id),entries=data!.entries.filter(e=>e.requirementId===r.id),open=expanded===r.id;
      const panelId=`qa-${instance}-${r.id}`,triggerId=`toggle-${instance}-${r.id}`;
      return <Fragment key={r.id}><tr className={`requirement-summary-row ${open?'is-expanded':''}`} data-requirement-id={r.id} onClick={event=>{
        if(!(event.target instanceof Element)||event.target.closest('button,a,input,textarea,select,label,dialog')||window.getSelection()?.toString())return;
        toggle(r.id);
      }}>
        <td className="req-id-cell"><Link className="requirement-id" to={`/requirements/${r.id}`} state={{returnTo}} onClick={remember}>{r.id}</Link><small className="table-module">MODULE {r.module}</small></td>
        <td className="requirement-name"><button type="button" id={triggerId} className="requirement-expand" aria-label={`${t(open?'qaCollapse':'qaExpand')} ${r.id}`} aria-expanded={open} aria-controls={panelId} disabled={busy} onClick={()=>toggle(r.id)}><span>{text(r.title,i18n.language)}</span><ChevronDown size={16} className={open?'is-open':''}/></button><p>{text(r.description,i18n.language)}</p></td>
        <td className="req-tier-cell" data-label={t('tier')}><Badge tone={r.tier==='L1'?'green':'purple'}>{r.tier}</Badge></td>
        <td className="req-compliance-cell" data-label={t('compliance')}>{rev?.compliance?<Badge tone={rev.compliance==='NC'?'red':'blue'}>{rev.compliance}</Badge>:<span className="muted small-text">{t('unassessed')}</span>}</td>
        <td className="req-status-cell" data-label={t('reviewStatus')}><StatusBadge status={rev?.state||'unreviewed'}/></td>
        <td className="pic-cell" data-label={t('picColumn')}><PicAssignment requirementId={r.id} compact/></td>
        <td className="req-discovery-cell" data-label={t('discovery')}><div className="discovery-counts"><button type="button" title={t('qa')} aria-label={`${t('qa')} ${r.id}`} aria-expanded={open} aria-controls={panelId} disabled={busy} onClick={()=>toggle(r.id)}><MessageSquareText size={14}/><span>{entries.filter(e=>e.kind==='qa').length}</span></button>{[{kind:'breakdown',icon:GitBranch},{kind:'assumption',icon:ShieldQuestion}].map(({kind,icon:Icon})=><Link key={kind} title={t(kind)} aria-label={`${t(kind)} ${r.id}`} to={`/requirements/${r.id}?tab=${kind}`} state={{returnTo}} onClick={remember}><Icon size={14}/><span>{entries.filter(e=>e.kind===kind).length}</span></Link>)}</div></td>
        <td className="req-details-cell"><Link className="table-arrow" to={`/requirements/${r.id}`} state={{returnTo}} onClick={remember} aria-label={`${t('details')} ${r.id}`}><ArrowRight size={16}/></Link></td>
      </tr>{open&&drafts[r.id]&&<tr className="requirement-expanded-row"><td colSpan={8}><div id={panelId} role="region" aria-labelledby={triggerId}><InlineQuestions key={r.id} requirementId={r.id} draft={drafts[r.id]} onDraftChange={draft=>setDrafts(old=>({...old,[r.id]:draft}))} onBusy={setBusy}/></div></td></tr>}</Fragment>;
    })}</tbody></table>{!rows.length&&<div className="empty-state"><Search size={28}/><h3>{t('noResults')}</h3></div>}</div></div>;
}
