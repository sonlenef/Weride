export type {Locale,Localized} from './workspace-types.js';
import type {Entry, Localized, Locale, Project, Requirement} from './workspace-types.js';
export type AnswerKind = 'answer' | 'clarify' | 'not_applicable' | 'later';
export interface ClientAnswer {kind:AnswerKind; text:string; language:Locale;}
export interface PublishOptions {
  title:string; introduction:string; language:Locale; questionIds:string[];
  includeDetails:boolean; includeBaseline:boolean; ttlDays:number; dueDate:string;
}
export interface PublishedQuestion {
  id:string; requirementId:string; version:number; originalLocale:Locale;
  title:Localized; details:Localized; priority:Entry['priority'];
  baseline:null|{title:Localized; description:Localized; sourcePage:number; sourceSection:string;};
}
export interface QuestionnaireSnapshot {
  schema:'weride.client-questionnaire.v1'; title:string; introduction:string; language:Locale;
  projectName:string; client:string; sourceReference:string; questions:PublishedQuestion[];
}
export interface Publication {
  id:string; snapshot:QuestionnaireSnapshot; sourceHash:string; createdAt:string;
  expiresAt:string; dueDate:string; state:'published'|'closed'|'revoked'; version:number;
  protected:boolean; sessionCount:number; submissionCount:number; url?:string;
}
export interface RespondentSession {
  id:string; name:string; email:string; language:Locale; answers:Record<string,ClientAnswer>;
  revision:number; state:'draft'|'submitted'; savedAt:string; submittedAt:string|null;
}
export interface Submission extends RespondentSession {
  imported:Record<string,{replyId:string; importedAt:string; importedBy:string}>;
}
export class QuestionnaireError extends Error {
  constructor(public code:string,public status=400){super(code);this.name='QuestionnaireError';}
}
export const localeValues:Locale[]=['en','vi','sv'];
export const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
export const safeId=/^[A-Za-z0-9_-]{1,128}$/;
export const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function object(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new QuestionnaireError('VALIDATION');
  return value as Record<string,unknown>;
}
export function bounded(value:unknown,max:number,required=true):string{
  if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new QuestionnaireError('VALIDATION');
  return value.trim();
}
export function parsePublish(raw:unknown):PublishOptions{
  const v=object(raw),keys=['title','introduction','language','questionIds','includeDetails','includeBaseline','ttlDays','dueDate'];
  if(Object.keys(v).some(k=>!keys.includes(k))||keys.some(k=>!(k in v)))throw new QuestionnaireError('VALIDATION');
  if(!localeValues.includes(v.language as Locale)||typeof v.includeDetails!=='boolean'||typeof v.includeBaseline!=='boolean'||![7,14,30].includes(Number(v.ttlDays))||typeof v.ttlDays!=='number')throw new QuestionnaireError('VALIDATION');
  if(!Array.isArray(v.questionIds)||!v.questionIds.length||v.questionIds.length>60||new Set(v.questionIds).size!==v.questionIds.length||v.questionIds.some(id=>typeof id!=='string'||!safeId.test(id)))throw new QuestionnaireError('SELECTION');
  if(v.questionIds.some(id=>['__proto__','prototype','constructor'].includes(String(id))))throw new QuestionnaireError('SELECTION');
  const dueDate=bounded(v.dueDate,10,false);
  if(dueDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||(!Number.isFinite(Date.parse(dueDate+'T12:00:00Z'))||new Date(dueDate+'T12:00:00Z').toISOString().slice(0,10)!==dueDate)))throw new QuestionnaireError('VALIDATION');
  return {title:bounded(v.title,160),introduction:bounded(v.introduction,4000,false),language:v.language as Locale,questionIds:[...v.questionIds] as string[],includeDetails:v.includeDetails,includeBaseline:v.includeBaseline,ttlDays:v.ttlDays,dueDate};
}
const loc=(value:Localized):Localized=>({en:value.en||'',vi:value.vi||'',sv:value.sv||''});
export function makeSnapshot(data:{project:Project;entries:Entry[];requirements:Requirement[]},options:PublishOptions):QuestionnaireSnapshot{
  const questions=options.questionIds.map(id=>{
    const e=data.entries.find(q=>q.id===id&&q.kind==='qa');if(!e)throw new QuestionnaireError('SOURCE_CHANGED',409);
    const r=data.requirements.find(q=>q.id===e.requirementId);
    return {id:e.id,requirementId:e.requirementId,version:e.version,originalLocale:e.originalLocale||'en',title:loc(e.title),details:options.includeDetails?loc(e.body):{en:'',vi:'',sv:''},priority:e.priority,baseline:options.includeBaseline&&r?{title:loc(r.title),description:loc(r.description),sourcePage:r.sourcePage,sourceSection:r.sourceSection}:null};
  });
  return {schema:'weride.client-questionnaire.v1',title:options.title,introduction:options.introduction,language:options.language,projectName:data.project.name,client:data.project.client,sourceReference:data.project.reference,questions};
}
export function parseAnswers(raw:unknown,snapshot:QuestionnaireSnapshot):Record<string,ClientAnswer>{
  const values=object(raw),ids=new Set(snapshot.questions.map(q=>q.id));
  if(Object.keys(values).length>60)throw new QuestionnaireError('VALIDATION');
  const answers:Record<string,ClientAnswer>=Object.create(null);
  for(const [id,value] of Object.entries(values)){
    if(!ids.has(id))throw new QuestionnaireError('QUESTION_SCOPE');
    const v=object(value);
    if(Object.keys(v).some(k=>!['kind','text','language'].includes(k))||!['answer','clarify','not_applicable','later'].includes(String(v.kind))||!localeValues.includes(v.language as Locale))throw new QuestionnaireError('VALIDATION');
    answers[id]={kind:v.kind as AnswerKind,text:bounded(v.text,6000,false),language:v.language as Locale};
  }
  if(new TextEncoder().encode(JSON.stringify(answers)).byteLength>450000)throw new QuestionnaireError('TOO_LARGE',413);
  return answers;
}
export function answerComplete(a:ClientAnswer|undefined):boolean{return Boolean(a&&(a.kind==='later'||a.text.trim()));}
export function parseIdentity(raw:unknown):{name:string;email:string;language:Locale}{
  const v=object(raw),name=bounded(v.name,120),email=bounded(v.email,254).toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||!localeValues.includes(v.language as Locale))throw new QuestionnaireError('IDENTITY');
  return {name,email,language:v.language as Locale};
}
export function answerCounts(answers:Record<string,ClientAnswer>){
  const values=Object.values(answers).filter(answerComplete);
  return {completed:values.length,answered:values.filter(a=>a.kind==='answer'||a.kind==='not_applicable').length,followUp:values.filter(a=>a.kind==='clarify'||a.kind==='later').length};
}
export function safeLocalized(value:Localized,language:Locale):{text:string;language:Locale}{
  const actual=localeValues.find(l=>l===language&&value[l]?.trim())||localeValues.find(l=>value[l]?.trim())||'en';
  return {text:value[actual]||'',language:actual};
}
