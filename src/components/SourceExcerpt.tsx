import {useSearchParams,Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {BookOpen,LockKeyhole} from 'lucide-react';
import {useWorkspace} from '../lib/store';
import {text} from '../lib/i18n';
export default function SourceExcerpt(){
  const {data}=useWorkspace(),{t,i18n}=useTranslation(),[params,setParams]=useSearchParams();
  const id=params.get('requirement')||'',req=data?.requirements.find(r=>r.id===id);
  return <section id="source-excerpt" className="panel source-excerpt" tabIndex={-1} aria-labelledby="source-excerpt-title">
    <header className="section-heading"><h2 id="source-excerpt-title"><BookOpen size={20}/>{t('uxSourceExcerpt')}</h2><span className="protected-note"><LockKeyhole size={14}/>{t('sourceReadOnly')}</span></header>
    <label className="field"><span>{t('requirement')}</span><select aria-label={t('requirement')} value={id} onChange={e=>{const next=new URLSearchParams(params);next.set('requirement',e.target.value);setParams(next,{replace:true});}}><option value="">{t('requirement')}</option>{data?.requirements.map(r=><option value={r.id} key={r.id}>{r.id} · {text(r.title,i18n.language)}</option>)}</select></label>
    {req?<><p className="source-reference">{data?.project.reference} · {req.sourceSection} · {t('printedPage',{page:req.sourcePage})}</p><h3 lang="en">{req.id} · {req.title.en}</h3><blockquote lang="en">{req.description.en}</blockquote><p className="small-note">{t('uxSourceExcerptNote',{printed:req.sourcePage,viewer:req.sourcePage+1})}</p><Link className="button secondary small" to={`/requirements/${req.id}`}>{t('qaFullDetail')}</Link></>:id?<p role="status">{t('notFound')}</p>:null}
  </section>;
}
