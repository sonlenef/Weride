import {describe,it,expect} from 'vitest';
import {makeSnapshot,parsePublish,parseAnswers,parseIdentity,answerComplete,answerCounts,safeLocalized} from '../functions/src/questionnaire-model';
import {buildPack,defaultOptions,packMarkdown} from '../functions/src/pack';
import {newEntry} from '../src/lib/types';
import type {Workspace} from '../src/lib/types';
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync('private/seed.json','utf8')) as Workspace;data.reviews=[];
const q=data.entries.find(e=>e.kind==='qa')!;
const options={title:'Review questions',introduction:'For client review',language:'en' as const,questionIds:[q.id],includeDetails:false,includeBaseline:true,ttlDays:14,dueDate:''};
describe('Client questionnaire model',()=>{
  it('preserves question ID, version and original requirement source',()=>{const s=makeSnapshot(data,options);expect(s.questions[0].id).toBe(q.id);expect(s.questions[0].version).toBe(q.version);expect(s.questions[0].baseline?.description).toEqual(data.requirements.find(r=>r.id===q.requirementId)?.description);});
  it('does not include internal answers, authors, PICs or estimates',()=>{const s=makeSnapshot(data,options);const item=s.questions[0];for(const key of ['answer','acceptance','owner','createdBy','createdByName','estimateHours'])expect(item).not.toHaveProperty(key);expect(item.details).toEqual({en:'',vi:'',sv:''});});
  it('requires an explicit selection of 1 to 60 distinct questions',()=>{for(const questionIds of [[],Array.from({length:61},(_,i)=>'q'+i),[q.id,q.id]])expect(()=>parsePublish({...options,questionIds})).toThrow();});
  it('rejects reserved object keys as question identifiers',()=>{for(const id of ['__proto__','constructor','prototype'])expect(()=>parsePublish({...options,questionIds:[id]})).toThrow();});
  it('keeps general questions separate from synthetic source requirements',()=>{const general={...newEntry('','qa'),title:{en:'General question',vi:'',sv:''}};const s=makeSnapshot({...data,entries:[general]}, {...options,questionIds:[general.id]});expect(s.questions[0].baseline).toBeNull();expect(s.questions[0].requirementId).toBe('');});
  it('accepts only supported lifetimes and calendar dates',()=>{for(const ttlDays of [0,1,100,'14'])expect(()=>parsePublish({...options,ttlDays})).toThrow();for(const dueDate of ['2026-02-30','2026-99-99','tomorrow'])expect(()=>parsePublish({...options,dueDate})).toThrow();});
  it('answers cannot escape the published selection',()=>{const s=makeSnapshot(data,options);expect(()=>parseAnswers({unknown:{kind:'answer',text:'a',language:'en'}},s)).toThrow();});
  it('bounds text and preserves the selected response language',()=>{const s=makeSnapshot(data,options);expect(parseAnswers({[q.id]:{kind:'answer',text:'  Tiếng Việt  ',language:'vi'}},s)[q.id].text).toBe('Tiếng Việt');expect(()=>parseAnswers({[q.id]:{kind:'answer',text:'x'.repeat(6001),language:'en'}},s)).toThrow();});
  it('distinguishes answered, pending and follow-up responses',()=>{expect(answerComplete({kind:'later',text:'',language:'en'})).toBe(true);expect(answerComplete({kind:'clarify',text:'',language:'en'})).toBe(false);expect(answerCounts({a:{kind:'later',text:'',language:'en'},b:{kind:'answer',text:'yes',language:'en'}})).toEqual({completed:2,answered:1,followUp:1});});
  it('validates self-reported identity without asserting verification',()=>{expect(parseIdentity({name:'Client',email:'CLIENT@EXAMPLE.TEST',language:'sv'}).email).toBe('client@example.test');expect(()=>parseIdentity({name:'',email:'bad',language:'en'})).toThrow();});
  it('returns the actual stored language for fallback content',()=>expect(safeLocalized({en:'',vi:'Câu hỏi',sv:''},'en')).toEqual({text:'Câu hỏi',language:'vi'}));
  it('client provenance reaches AI packs without exposing identity metadata',async()=>{
    const reply={id:'r',questionId:q.id,body:{en:'Response',vi:'',sv:''},originalLocale:'en' as const,version:1,createdBy:'client:secret',createdByName:'PRIVATE NAME',updatedBy:'staff',updatedByName:'STAFF',external:{publicationId:'pub',submissionId:'sub',questionVersion:1,respondentName:'PRIVATE NAME',respondentEmail:'private@example.test',identityVerified:false as const,answerKind:'clarify',submittedAt:'2026-09-29T10:00:00Z',importedBy:'STAFF'}};
    const pack=await buildPack({...data,replies:[reply]},defaultOptions({kind:'requirement',id:q.requirementId}));const md=packMarkdown(pack);expect(md).toContain('client questionnaire');expect(md).not.toContain('PRIVATE NAME');expect(md).not.toContain('private@example.test');expect(pack.content.entries.find(e=>e.id===q.id)?.discussionStatus).toBe('open');
  });
});
