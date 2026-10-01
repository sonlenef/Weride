import type { Activity, Entry, Requirement, TeamMember } from './types';
import { questionAuthor } from './questions';
/** Empty requirementId is a project-wide question, never a synthetic RFP requirement. */
export const isGeneralQuestion = (e:Pick<Entry,'kind'|'requirementId'>):boolean => e.kind === 'qa' && e.requirementId === '';
export const questionPriorities = ['low','medium','high','critical'] as const;
export const priorityWeight:Record<Entry['priority'],number> = {critical:4,high:3,medium:2,low:1};
export function validEntryScope(e:Pick<Entry,'kind'|'requirementId'>, requirements:Requirement[]):boolean {
  return isGeneralQuestion(e) || (typeof e.requirementId === 'string' && requirements.some(r=>r.id === e.requirementId));
}
export interface QuestionFilters { search:string; scope:string; priority:string; status:string; author:string; sort:string; questionId?:string; }
const timestamp=(v?:string)=>v && Number.isFinite(Date.parse(v)) ? Date.parse(v) : 0;
export function selectQuestions(entries:Entry[], people:TeamMember[], uid:string, f:QuestionFilters):Entry[] {
  const needle=f.search.trim().toLocaleLowerCase();
  return entries.filter(e=>e.kind==='qa').filter(e=>
    (!f.questionId||e.id===f.questionId) &&
    (!f.scope||(f.scope==='general'?isGeneralQuestion(e):f.scope==='linked'?Boolean(e.requirementId):e.requirementId===f.scope)) &&
    (!f.priority||(f.priority==='urgent'?['high','critical'].includes(e.priority):e.priority===f.priority)) && (!f.status||e.status===f.status) &&
    (!f.author||(f.author==='mine'?e.createdBy===uid:f.author==='proposal'?e.origin==='proposal':e.createdBy===f.author)) &&
    (!needle||[e.id,e.requirementId,questionAuthor(e,people),...Object.values(e.title),...Object.values(e.body),...Object.values(e.answer)].join(' ').toLocaleLowerCase().includes(needle))
  ).sort((a,b)=>(f.sort==='priority'?(priorityWeight[b.priority]||0)-(priorityWeight[a.priority]||0):0)||
    (f.sort==='oldest'?timestamp(a.createdAt)-timestamp(b.createdAt):timestamp(b.createdAt)-timestamp(a.createdAt))||a.id.localeCompare(b.id));
}
export function activityTarget(e:Pick<Activity,'kind'|'requirementId'|'entryId'>):string {
  return e.kind==='decision'?'/sources#decision-'+encodeURIComponent(e.entryId):e.kind==='reply'?'/questions':e.kind==='resolution'?'/questions?question='+encodeURIComponent(e.entryId):e.kind==='qa' ? `/questions?question=${encodeURIComponent(e.entryId)}` : `/requirements/${encodeURIComponent(e.requirementId)}`;
}
