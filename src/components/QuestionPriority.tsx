import { useId } from 'react';
import { Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Entry } from '../lib/types';
import { questionPriorities } from '../lib/question-hub';
export function QuestionPriorityBadge({priority}:{priority:Entry['priority']}) {
  const {t}=useTranslation();
  return <span className={`question-priority priority-${priority}`} aria-label={`${t('priority')}: ${t(priority)}`}><Flag size={12} aria-hidden="true"/>{t(priority)}</span>;
}
export function QuestionPriorityField({value,onChange,disabled=false}:{value:Entry['priority'];onChange:(v:Entry['priority'])=>void;disabled?:boolean}) {
  const {t}=useTranslation(),id=useId();
  return <label className="qa-field qa-priority-field"><span>{t('priority')}</span><select aria-describedby={id} aria-label={t('priority')} disabled={disabled} value={value} onChange={e=>onChange(e.target.value as Entry['priority'])}>{questionPriorities.map(p=><option key={p} value={p}>{t(p)}</option>)}</select><small className="priority-help" id={id}>{t('ux'+value[0].toUpperCase()+value.slice(1)+'Help')}</small></label>;
}
