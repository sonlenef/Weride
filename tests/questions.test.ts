import {describe,it,expect} from 'vitest';
import {canManageEntry,orderedQuestions,questionAuthor,hasQuestionDraft} from '../src/lib/questions';
import {newEntry} from '../src/lib/types';
import type {TeamMember} from '../src/lib/types';
const own=()=>({...newEntry('FN-BKG-01','qa'),createdBy:'alice',createdByName:'Original asker',updatedByName:'Different editor',version:1});
describe('Q&A identity, ordering and drafts',()=>{
  it('grants mutation only to the immutable asker UID',()=>{const q=own();expect(canManageEntry(q,'alice')).toBe(true);expect(canManageEntry(q,'bob')).toBe(false);expect(canManageEntry(q,undefined)).toBe(false);});
  it('matching display names, owner text or being PIC grant no question ownership',()=>{const q={...own(),owner:'bob',createdByName:'bob'};expect(canManageEntry(q,'bob')).toBe(false);});
  it('keeps team editing for breakdowns and assumptions unchanged',()=>{for(const kind of ['breakdown','assumption'] as const){const item={...own(),kind};expect(canManageEntry(item,'bob')).toBe(true);expect(canManageEntry(item,undefined)).toBe(false);}});
  it('looks up the original asker, not the last editor',()=>{const q=own();const people=[{uid:'alice',displayName:'Current asker name'}] as TeamMember[];expect(questionAuthor(q,people)).toBe('Current asker name');expect(questionAuthor(q,[])).toBe('Original asker');expect(questionAuthor({...q,createdByName:''},[])).toBe('');});
  it('shows new member questions first and keeps ordering stable without timestamps',()=>{const a={...own(),id:'a',createdAt:'2026-09-29T10:00:00Z'},b={...own(),id:'b',createdAt:'2026-09-29T11:00:00Z'},seed={...own(),id:'seed',origin:'proposal' as const,createdAt:'2026-09-30T11:00:00Z'};expect(orderedQuestions([seed,a,b,{...a,id:'other',requirementId:'FN-DIS-01'}],'FN-BKG-01').map(e=>e.id)).toEqual(['b','a','seed']);});
  it('recognizes multilingual drafts without treating empty metadata as changes',()=>{const draft=newEntry('FN-BKG-01','qa');expect(hasQuestionDraft(draft)).toBe(false);draft.title.vi='Câu hỏi?';expect(hasQuestionDraft(draft)).toBe(true);});
});
