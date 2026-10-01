import {describe,it,expect,vi,afterEach} from 'vitest';
import {newEntry,blankText,emptyReview} from '../src/lib/types';
import type {Entry,Reply,Workspace,Decision,Activity} from '../src/lib/types';
import {entryError} from '../src/lib/helpers';
import {resolvedLocale,text} from '../src/lib/i18n';
import {effectiveQuestionStatus,canEditReply,decisionError,scopedCount} from '../src/lib/collaboration';
import {fieldChanges,canRestorePrevious} from '../src/lib/history';
import {safeReturnTo} from '../src/lib/preferences';
import {syncState} from '../src/lib/sync-state';
import {writeDraft,readDraft,clearUserDrafts,removeDraft} from '../src/lib/draft-storage';
const q:Entry={...newEntry('FN-BKG-01','qa'),id:'question',title:{en:'Original',vi:'',sv:''},version:1,createdBy:'alice'};
const reply:Reply={id:'reply',questionId:q.id,body:{en:'Answer',vi:'',sv:''},originalLocale:'en',version:1,createdBy:'bob',createdByName:'Bob',updatedBy:'bob',updatedByName:'Bob'};
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('Native language and workflow',()=>{
  for(const lang of ['en','vi','sv'] as const)it(`requires text only in the chosen ${lang} source language`,()=>{const item={...q,originalLocale:lang,title:{...blankText(),[lang]:'Native text'}};expect(entryError(item)).toBeNull();expect(text(item.title,'en')).toBe('Native text');expect(resolvedLocale(item.title,'en')).toBe(lang);});
  it('does not invent English for untranslated Vietnamese',()=>expect(text({en:'',vi:'Câu hỏi',sv:''},'sv')).toBe('Câu hỏi'));
  it('keeps English mandatory for non-Q&A work packages',()=>expect(entryError({...q,kind:'breakdown',status:'todo',title:{en:'',vi:'Gói việc',sv:''}})).toBe('invalidTitle'));
  it('derives answered and resolved without changing source question content',()=>{expect(effectiveQuestionStatus(q,{replies:[reply]})).toBe('answered');expect(effectiveQuestionStatus(q,{replies:[reply],resolutions:[{id:q.id,replyId:reply.id,replyVersion:1,version:1,updatedBy:'alice',updatedByName:'Alice'}]})).toBe('resolved');expect(q.status).toBe('open');});
  it('does not accept stale or missing replies',()=>expect(effectiveQuestionStatus(q,{replies:[reply],resolutions:[{id:q.id,replyId:reply.id,replyVersion:2,version:1,updatedBy:'alice',updatedByName:'Alice'}]})).toBe('answered'));
  it('limits reply editing to its author before acceptance',()=>{expect(canEditReply(reply,'alice')).toBe(false);expect(canEditReply(reply,'bob')).toBe(true);expect(canEditReply(reply,'bob',[{id:q.id,replyId:reply.id,replyVersion:1,version:1,updatedBy:'alice',updatedByName:'Alice'}])).toBe(false);});
  it('a started review does not count as completed scope',()=>{const requirements=[{id:'A'},{id:'B'}] as Workspace['requirements'];expect(scopedCount({requirements,reviews:[{...emptyReview('A'),state:'reviewing'},{...emptyReview('B'),state:'clarified'}]})).toBe(0);expect(scopedCount({requirements,reviews:[{...emptyReview('A'),state:'scoped'}]})).toBe(1);});
  it('confirmation needs explicit evidence',()=>{const d={originalLocale:'en',title:q.title,body:blankText(),state:'confirmed',source:''} as Decision;expect(decisionError(d)).toBe('uxDecisionEvidence');expect(decisionError({...d,source:'Meeting minute reference'})).toBeNull();});
});
describe('History and navigation boundaries',()=>{
  it('readable diffs omit mechanical version metadata',()=>expect(fieldChanges({title:{en:'Old'},version:1},{title:{en:'New'},version:2})).toEqual([{field:'title.en',before:'Old',after:'New'}]));
  it('restoration never overwrites a newer entry',()=>{const event={action:'update',kind:'qa',entryId:q.id,before:q,after:{...q,version:2}} as Activity;const data={entries:[{...q,version:3}],reviews:[]} as Workspace;expect(canRestorePrevious(event,data,'alice')).toBe(false);expect(canRestorePrevious(event,{...data,entries:[{...q,version:2}]},'bob')).toBe(false);expect(canRestorePrevious(event,{...data,entries:[{...q,version:2}]},'alice')).toBe(true);});
  it('return destinations remain within known workspace routes',()=>{expect(safeReturnTo('/requirements?module=B')).toBe('/requirements?module=B');expect(safeReturnTo('//outside.example')).toBe('/requirements');expect(safeReturnTo('https://outside.example')).toBe('/requirements');});
});
describe('Private draft recovery',()=>{
  function browser(fail=false){const values=new Map<string,string>();vi.stubGlobal('window',new EventTarget());vi.stubGlobal('sessionStorage',{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>{if(fail)throw Error('Storage blocked');values.set(key,value);},removeItem:(key:string)=>values.delete(key)});}
  it('preserves drafts across component navigation without submitting them',()=>{browser();expect(writeDraft('draft-owner-a','entry:new','entry',{title:'Unsent'},'Question')).toBe(true);expect(readDraft('draft-owner-a','entry:new')?.value).toEqual({title:'Unsent'});});
  it('isolates drafts by authenticated UID',()=>{browser();writeDraft('draft-owner-b','entry:new','entry',{title:'Private'},'Question');expect(readDraft('another-user','entry:new')).toBeUndefined();});
  it('manual sign-out clears only that account drafts',()=>{browser();writeDraft('draft-owner-c','one','entry',{title:'One'},'One');writeDraft('draft-owner-d','two','entry',{title:'Two'},'Two');clearUserDrafts('draft-owner-c');expect(readDraft('draft-owner-c','one')).toBeUndefined();expect(readDraft('draft-owner-d','two')).toBeDefined();});
  it('successful save clears the matching draft',()=>{browser();writeDraft('draft-owner-e','one','entry',{title:'One'},'One');removeDraft('draft-owner-e','one');expect(readDraft('draft-owner-e','one')).toBeUndefined();});
  it('expires drafts after 24 hours without extending them by reading',()=>{browser();vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-29T10:00:00Z'));writeDraft('draft-owner-f','one','entry',{title:'Temporary'},'One');vi.setSystemTime(new Date('2026-09-30T09:59:59Z'));expect(readDraft('draft-owner-f','one')).toBeDefined();vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));expect(readDraft('draft-owner-f','one')).toBeUndefined();});
  it('reports blocked storage but keeps an in-memory recovery copy',()=>{browser(true);expect(writeDraft('draft-owner-g','one','entry',{title:'Retained'},'One')).toBe(false);expect(readDraft('draft-owner-g','one')?.value).toEqual({title:'Retained'});});
});
describe('Truthful synchronization status',()=>{
  const base={preview:false,online:true,error:false,writeFault:false,pending:false,serverReady:false};
  it('a network connection alone never implies server synchronization',()=>expect(syncState(base)).toBe('uxSyncing'));
  it('reports receipt only after all server metadata is current',()=>expect(syncState({...base,serverReady:true})).toBe('uxSynced'));
  it('exposes pending writes and failed saves',()=>{expect(syncState({...base,serverReady:true,pending:true})).toBe('saving');expect(syncState({...base,serverReady:true,writeFault:true})).toBe('uxWriteError');});
  it('distinguishes offline and permission/listener failure',()=>{expect(syncState({...base,online:false})).toBe('offline');expect(syncState({...base,error:true})).toBe('uxSyncError');});
});
