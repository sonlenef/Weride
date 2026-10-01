import { memberLabel } from './assignment';
import type { Entry, Requirement, Review, Localized, Workspace } from './types';
import { text } from './i18n';
export const isMadisonEmail = (email?: string | null) => typeof email === 'string' && /^[^@\s]+@madison\.dev$/i.test(email);
export function entryError(e: Entry): string | null {
  if(!['low','medium','high','critical'].includes(e.priority))return 'invalidPriority';
  if (Object.values(e.title).some(v=>v.length>2000)) return e.kind==='qa'?'uxQuestionRequired':'invalidTitle';
  if (e.kind==='qa'?!e.title[e.originalLocale||'en']?.trim():!e.title.en.trim()) return e.kind==='qa'?'uxQuestionRequired':'invalidTitle';
  if(e.estimateHours!==null && (!Number.isFinite(e.estimateHours)||e.estimateHours<0||e.estimateHours>100000)) return 'invalidNumber';
  if(e.kind==='qa' && e.status!=='open' && !Object.values(e.answer).some(v=>v.trim())) return 'uxAnswerRequired';
  return null;
}
export function reviewError(r: Review): string | null {
  if ([r.cost,r.effortHours].some(v=>v!==null&&(!Number.isFinite(v)||v<0||v>100000000))) return 'invalidNumber';
  if(r.effortHours!==null && r.effortHours>100000) return 'invalidNumber';
  if(r.compliance==='RD'&&!/^\d{4}-\d{2}-\d{2}$/.test(r.releaseDate)) return 'requiredRoadmap';
  if(r.compliance==='CU'&&(r.cost===null||r.effortHours===null)) return 'requiredRoadmap';
  return null;
}
export function orderedTree(entries: Entry[]): Array<{entry:Entry; depth:number}> {
  const ids=new Set(entries.map(e=>e.id)); const visited=new Set<string>(); const result:Array<{entry:Entry;depth:number}>=[];
  const visit=(entry:Entry,depth:number)=>{if(visited.has(entry.id))return;visited.add(entry.id);result.push({entry,depth});entries.filter(e=>e.parentId===entry.id).forEach(child=>visit(child,depth+1));};
  entries.filter(e=>!e.parentId||!ids.has(e.parentId)).forEach(e=>visit(e,0));
  // Defensive recovery for imported/orphaned/cyclic data: never hide an item.
  entries.forEach(e=>visit(e,0)); return result;
}
export function filterRequirements(requirements:Requirement[],entries:Entry[],reviews:Review[],q:string,module:string,tier:string,state:string,compliance:string,language:string) {
  const needle=q.trim().toLocaleLowerCase();
  return requirements.filter(r=>{
    const review=reviews.find(x=>x.id===r.id);
    const content=[r.id,...Object.values(r.title),...Object.values(r.description),...entries.filter(e=>e.requirementId===r.id).flatMap(e=>[...Object.values(e.title),...Object.values(e.body),...Object.values(e.answer),...Object.values(e.acceptance)]),text(r.title,language)].join(' ').toLocaleLowerCase();
    return (!module||r.module===module)&&(!tier||r.tier===tier)&&(!state||(review?.state||'unreviewed')===state)&&(!compliance||(review?.compliance||'unassessed')===compliance)&&(!needle||content.includes(needle));
  });
}
export const csvCell=(v:unknown)=>{let s=String(v??''); if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
export function matrixCsv(rows:Requirement[],data:Workspace,language:string) {
  const lines=[['ID','Module','Tier','Requirement','Source description','RFP printed page','Compliance','Discovery status','Q&A','Breakdown','Assumptions','Vendor comments','Hours','Cost','Currency','Roadmap date','PIC','PIC email']];
  for(const r of rows){const rev=data.reviews.find(x=>x.id===r.id);const es=data.entries.filter(e=>e.requirementId===r.id);lines.push([r.id,r.module,r.tier,text(r.title,language),text(r.description,language),String(r.sourcePage),rev?.compliance||'',rev?.state||'unreviewed',String(es.filter(e=>e.kind==='qa').length),String(es.filter(e=>e.kind==='breakdown').length),String(es.filter(e=>e.kind==='assumption').length),text(rev?.comments,language),String(rev?.effortHours??''),String(rev?.cost??''),rev?.currency||'',rev?.releaseDate||'',memberLabel(data.members?.find(p=>p.uid===data.assignments?.find(a=>a.id===r.id)?.assigneeUid)),data.members?.find(p=>p.uid===data.assignments?.find(a=>a.id===r.id)?.assigneeUid)?.email||'']);}
  return '\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
export function download(name:string,body:string,type:string) { const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
export const hasTranslation=(v:Localized,language:string)=>Boolean(v[language as keyof Localized]?.trim());
