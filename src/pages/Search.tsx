import {useState,useEffect} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {Search as SearchIcon,ArrowUpRight} from 'lucide-react';
import {useWorkspace} from '../lib/store';
import {text,resolvedLocale} from '../lib/i18n';
import {effectiveQuestionStatus} from '../lib/collaboration';
import type {Localized} from '../lib/types';
interface Result {id:string;kind:string;title:Localized;body:Localized;scope:string;url:string;status?:string;}
export default function SearchPage(){
  const {data}=useWorkspace(),{t,i18n}=useTranslation(),[params,setParams]=useSearchParams();
  const d=data!,q=params.get('q')||'',type=params.get('type')||'',status=params.get('status')||'';
  const needle=q.trim().toLocaleLowerCase();const [visibleCount,setVisibleCount]=useState(100);
  useEffect(()=>setVisibleCount(100),[q,type,status]);
  // All data is provided by the authenticated workspace; search never fetches public copies.
  const results:Result[]=d.requirements.map(r=>({id:r.id,kind:'requirement',title:r.title,body:r.description,scope:`Module ${r.module} · ${r.tier}`,url:`/requirements/${r.id}`}));
  for(const e of d.entries)results.push({id:e.id,kind:e.kind,title:e.title,body:{en:e.body.en+' '+e.answer.en,vi:e.body.vi+' '+e.answer.vi,sv:e.body.sv+' '+e.answer.sv},scope:e.requirementId||t('qhGeneral'),url:e.kind==='qa'?`/questions?question=${e.id}`:`/requirements/${e.requirementId}?tab=${e.kind}`,status:e.kind==='qa'?effectiveQuestionStatus(e,d):e.status});
  for(const r of d.replies||[]){const parent=d.entries.find(e=>e.id===r.questionId);if(parent)results.push({id:r.id,kind:'reply',title:r.body,body:r.body,scope:parent.requirementId||t('qhGeneral'),url:`/questions?question=${r.questionId}`});}
  for(const x of d.decisions||[])results.push({id:x.id,kind:'decision',title:x.title,body:x.body,scope:x.requirementIds.join(', ')||t('qhGeneral'),url:`/sources#decision-${x.id}`,status:x.state});
  const filtered=results.filter(r=>(!type||r.kind===type)&&(!status||r.status===status)&&(!needle||[r.id,r.scope,...Object.values(r.title),...Object.values(r.body)].join(' ').toLocaleLowerCase().includes(needle)));
  const change=(key:string,value:string)=>{const next=new URLSearchParams(window.location.search);value?next.set(key,value):next.delete(key);setParams(next,{replace:true});};
  return <div className="workspace-search page-enter">
    <div className="page-heading"><div><span className="eyebrow">WERIDE / SEARCH</span><h1>{t('uxSearchResults')}</h1><p>{t('uxSearchHint')}</p></div></div>
    <section className="panel">
      <label className="search-field"><SearchIcon size={18}/><input aria-label={t('uxSearchResults')} placeholder={t('uxSearchHint')} value={q} onChange={e=>change('q',e.target.value)}/></label>
      <label className="field search-type"><span>{t('discovery')}</span><select value={type} onChange={e=>change('type',e.target.value)}><option value="">{t('uxAllResults')}</option>{['requirement','qa','reply','breakdown','assumption','decision'].map(k=><option key={k} value={k}>{t(k==='reply'?'uxReplies':k==='decision'?'uxDecisions':k)}</option>)}</select></label>
      {status&&<button className="button secondary small" onClick={()=>change('status','')}>{t(status)} ×</button>}
    </section>
    {!needle&&!type?<p className="empty-state">{t('uxSearchPrompt')}</p>:<>
      <p className="search-result-count" role="status">{t('uxMatches',{count:filtered.length})}</p>
      {['requirement','qa','reply','breakdown','assumption','decision'].map(kind=>{
        const group=filtered.filter(r=>r.kind===kind);
        return group.length?<section className="panel search-result-group" key={kind}>
          <h2>{t(kind==='reply'?'uxReplies':kind==='decision'?'uxDecisions':kind)} · {group.length}</h2>
          {group.slice(0,type?visibleCount:8).map(r=><Link className="search-result" to={r.url} key={r.id} state={{returnTo:'/search?'+params.toString()}}>
            <div><small>{r.scope}</small><strong lang={resolvedLocale(r.title,i18n.language)}>{text(r.title,i18n.language)}</strong><span lang={resolvedLocale(r.body,i18n.language)}>{text(r.body,i18n.language).slice(0,220)}</span></div><ArrowUpRight size={16}/>
          </Link>)}
          {type&&group.length>visibleCount&&<button className="button secondary small" onClick={()=>setVisibleCount(n=>n+100)}>{t('aiLoadMore')}</button>}
          {!type&&group.length>8&&<button className="button secondary small" onClick={()=>change('type',kind)}>{t('uxAllResults')}</button>}
        </section>:null;
      })}
    </>}
  </div>;
}
