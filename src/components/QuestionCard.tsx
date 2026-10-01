import {useEffect,useId,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {ArrowUpRight,ChevronDown,LockKeyhole,MessageSquareText,Pencil,Trash2} from 'lucide-react';
import {useWorkspace} from '../lib/store';
import {useAuth} from '../lib/auth';
import {text,formatDate} from '../lib/i18n';
import {canManageEntry} from '../lib/questions';
import {effectiveQuestionStatus} from '../lib/collaboration';
import type {Entry} from '../lib/types';
import {LocalText,StatusBadge} from './ui';
import {QuestionAuthor} from './QuestionAuthor';
import {QuestionPriorityBadge} from './QuestionPriority';
import ReplyThread from './ReplyThread';
interface Props {entry:Entry;showScope?:boolean;compact?:boolean;onEdit:(e:Entry)=>void;onDelete:(e:Entry)=>void;}
export default function QuestionCard({entry:q,showScope=false,compact=false,onEdit,onDelete}:Props){
  const {online,data}=useWorkspace(),{member,preview}=useAuth(),{t,i18n}=useTranslation(),location=useLocation();
  const [expanded,setExpanded]=useState(!compact),id=useId(),writable=(online||preview)&&Boolean(member);
  useEffect(()=>setExpanded(!compact),[compact]);
  const replyCount=data?.replies?.filter(r=>r.questionId===q.id).length||0;
  return <article className={`inline-question ${compact?'question-compact':''}`} data-question-id={q.id}>
    {showScope&&<div className="question-scope-line">{q.requirementId?<Link to={`/requirements/${q.requirementId}?tab=qa`} state={{returnTo:location.pathname+location.search}}><span className="requirement-id">{q.requirementId}</span><ArrowUpRight size={13}/></Link>:<span className="question-general-tag"><MessageSquareText size={13}/>{t('qhGeneral')}</span>}</div>}
    <div className="inline-question-top"><QuestionAuthor entry={q}/><div className="inline-question-badges"><QuestionPriorityBadge priority={q.priority}/><StatusBadge status={effectiveQuestionStatus(q,data||{})}/>{canManageEntry(q,member?.uid)?<><button className="icon-button" type="button" disabled={!writable} aria-label={`${t('edit')} ${q.id}`} title={t('uxMoveScope')} onClick={()=>onEdit(q)}><Pencil size={15}/></button><button className="icon-button delete-button" type="button" disabled={!writable} aria-label={`${t('delete')} ${q.id}`} title={t('delete')} onClick={()=>onDelete(q)}><Trash2 size={15}/></button></>:<span className="qa-readonly" title={t('qaOnlyAuthor')}><LockKeyhole size={13}/></span>}</div></div>
    <LocalText as="h3" value={q.title} showFallback/>
    <button type="button" className="question-toggle" aria-controls={id} aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}><ChevronDown className={expanded?'is-open':''} size={16}/>{t(expanded?'uxHideDiscussion':'uxShowDiscussion')}<span>{replyCount} {t('uxReplies').toLocaleLowerCase()}</span></button>
    {expanded&&<div id={id} className="question-discussion">{text(q.body,i18n.language)&&<LocalText as="p" value={q.body} className="inline-question-body" showFallback/>}
      {text(q.answer,i18n.language)?<div className="answer-block"><strong>{t('answer')}</strong><LocalText as="p" value={q.answer} showFallback/></div>:!replyCount&&<p className="awaiting"><MessageSquareText size={13}/>{t('noAnswer')}</p>}
      <ReplyThread question={q}/><footer className="question-version"><span>{t('version')} {q.version}</span>{q.updatedAt&&q.updatedAt!==q.createdAt&&<span>{formatDate(q.updatedAt,i18n.language,true)}</span>}</footer>
    </div>}
  </article>;
}
