import { UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '../lib/store';
import { useAuth } from '../lib/auth';
import { questionAuthor } from '../lib/questions';
import { formatDate } from '../lib/i18n';
import type { Entry } from '../lib/types';
import { Badge } from './ui';
export function QuestionAuthor({entry}:{entry:Entry}) {
  const {data}=useWorkspace(),{member}=useAuth(),{t,i18n}=useTranslation();
  const recorded=questionAuthor(entry,data?.members),seed=entry.origin==='proposal'&&!data?.members?.some(p=>p.uid===entry.createdBy);
  const name=seed?t('qaSeedAuthor'):recorded||t('qaUnknownAuthor');
  return <div className="question-author"><span className="question-avatar" aria-hidden="true"><UserRound size={15}/></span><div><span className="question-author-name"><span>{t('qaAskedBy')}: </span><strong>{name}</strong>{entry.createdBy===member?.uid&&<Badge>{t('qaYou')}</Badge>}</span>{entry.createdAt&&<time dateTime={entry.createdAt}>{formatDate(entry.createdAt,i18n.language,true)}</time>}{seed&&<small>{t('qaSeedNote')}</small>}</div></div>;
}
