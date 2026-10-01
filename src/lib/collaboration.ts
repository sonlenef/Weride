import type {Entry,Reply,QuestionResolution,Workspace,Decision} from './types';
export function effectiveQuestionStatus(q:Entry,data:Pick<Workspace,'replies'|'resolutions'>):string {
  const resolution=data.resolutions?.find(r=>r.id===q.id);
  const replies=data.replies?.filter(r=>r.questionId===q.id)||[];
  if(resolution?.replyId&&replies.some(r=>r.id===resolution.replyId&&r.version===resolution.replyVersion))return 'resolved';
  if(q.status!=='open')return q.status;
  return replies.some(r=>!r.external||['answer','not_applicable'].includes(r.external.answerKind))?'answered':'open';
}
export function canEditReply(reply:Reply,uid:string|undefined,resolutions:QuestionResolution[]=[]):boolean {
  return Boolean(uid)&&reply.createdBy===uid&&!resolutions.some(r=>r.replyId===reply.id);
}
export function replyError(reply:Reply):string|null {
  if(!['en','vi','sv'].includes(reply.originalLocale)||!reply.body[reply.originalLocale]?.trim())return 'uxReplyRequired';
  if(Object.values(reply.body).some(v=>v.length>12000))return 'uxReplyRequired';
  return null;
}
export function decisionError(d:Decision):string|null {
  if(!['en','vi','sv'].includes(d.originalLocale)||!d.title[d.originalLocale]?.trim()||Object.values(d.title).some(s=>s.length>2000))return 'uxQuestionRequired';
  if(d.source.length>4000||Object.values(d.body).some(s=>s.length>12000))return 'writeError';
  if(d.state==='confirmed'&&!d.source.trim())return 'uxDecisionEvidence';
  return null;
}
export function scopedCount(data:Pick<Workspace,'reviews'|'requirements'>):number {
  return data.requirements.filter(r=>data.reviews.some(v=>v.id===r.id&&v.state==='scoped')).length;
}
export const localeNames={en:'English',vi:'Tiếng Việt',sv:'Svenska'};
