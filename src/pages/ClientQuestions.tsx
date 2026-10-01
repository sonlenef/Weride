import {useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useEffect} from 'react';
import QuestionnaireBuilder from '../components/QuestionnaireBuilder';
import QuestionnaireManager from '../components/QuestionnaireManager';
import './client-questionnaires.css';
export default function ClientQuestions(){
  const {t}=useTranslation(),[params,setParams]=useSearchParams();
  const published=params.get('tab')==='published',ids=(params.get('ids')||'').split(',').filter(Boolean);
  useEffect(()=>{document.title=t('cqMenu')+' · WeRide';},[t]);
  return <div className="page-enter cq-page"><div className="page-heading"><div><span className="eyebrow">DISCOVERY / CLIENT COLLABORATION</span><h1>{t('cqTitle')}</h1><p>{t('cqSubtitle')}</p></div></div>
    <nav className="cq-tabs" aria-label={t('cqMenu')}><button className="button secondary" aria-current={!published?'page':undefined} onClick={()=>setParams({...Object.fromEntries(params),tab:'prepare'})}>{t('cqPrepare')}</button><button className="button secondary" aria-current={published?'page':undefined} onClick={()=>setParams({...Object.fromEntries(params),tab:'published'})}>{t('cqPublished')}</button></nav>
    {published?<QuestionnaireManager/>:<QuestionnaireBuilder initialIds={ids}/>}
  </div>;
}
