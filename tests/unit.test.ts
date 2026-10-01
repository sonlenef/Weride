import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { isMadisonEmail, entryError, reviewError, orderedTree, filterRequirements, csvCell, matrixCsv } from '../src/lib/helpers';
import { text,translations,formatDate } from '../src/lib/i18n';
import { emptyReview,newEntry } from '../src/lib/types';
import type { Workspace } from '../src/lib/types';
const d=JSON.parse(readFileSync(new URL('../private/seed.json',import.meta.url),'utf8')) as Workspace;
d.reviews=[];d.activities=[];
describe('Source fidelity and multilingual fixtures',()=>{
  it('preserves exactly the 30 matrix requirements, 24 L1 and 6 L2',()=>{
    expect(d.requirements).toHaveLength(30);expect(new Set(d.requirements.map(r=>r.id)).size).toBe(30);
    expect(d.requirements.filter(r=>r.tier==='L1')).toHaveLength(24);
    expect(d.requirements.filter(r=>r.module==='A')).toHaveLength(13);
    expect(d.requirements.filter(r=>r.module==='B')).toHaveLength(11);
    expect(d.requirements.filter(r=>r.module==='C')).toHaveLength(6);
    expect(d.requirements.some(r=>r.id==='EXP-DRV-01')).toBe(true);
    expect(d.requirements.some(r=>r.id==='EXP-TAX-01')).toBe(false);
    expect(d.project.clarifications).toHaveLength(2);
    expect(d.project.fleetReference).toBe(150);
  });
  it('keeps source titles and descriptions in three languages with printed-page provenance',()=>{
    for(const r of d.requirements){for(const l of ['en','vi','sv'] as const){expect(r.title[l].trim()).not.toBe('');expect(r.description[l].trim()).not.toBe('');}expect(r.sourcePage).toBeGreaterThanOrEqual(6);expect(r.sourcePage).toBeLessThanOrEqual(11);}
  });
  it('distinguishes 150 working proposals from source and leaves answers, costs and compliance uncommitted',()=>{
    expect(d.entries).toHaveLength(150);
    for(const r of d.requirements){const items=d.entries.filter(e=>e.requirementId===r.id);expect(items.filter(e=>e.kind==='qa')).toHaveLength(1);expect(items.filter(e=>e.kind==='breakdown')).toHaveLength(3);expect(items.filter(e=>e.kind==='assumption')).toHaveLength(1);}
    for(const e of d.entries){expect(e.origin).toBe('proposal');expect(e.estimateHours).toBeNull();expect(e.answer.en).toBe('');for(const l of ['en','vi','sv'] as const)expect(e.title[l].trim()).not.toBe('');if(e.parentId)expect(d.entries.some(p=>p.id===e.parentId&&p.requirementId===e.requirementId&&p.kind===e.kind)).toBe(true);}
    expect(d.reviews).toHaveLength(0);
  });
  it('has identical, populated UI dictionaries and a visible English content fallback',()=>{
    expect(Object.keys(translations.en.translation)).toEqual(Object.keys(translations.vi.translation));
    expect(Object.keys(translations.en.translation)).toEqual(Object.keys(translations.sv.translation));
    for(const l of ['en','vi','sv'])for(const v of Object.values(translations[l].translation))expect(String(v).trim()).not.toBe('');
    expect(text({en:'Original',vi:'',sv:''},'sv')).toBe('Original');expect(formatDate('not-date')).toBe('—');
  });
});
describe('Forms, filtering, safe export and hierarchy',()=>{
  it('accepts only the exact Madison email domain',()=>{for(const v of ['a@madison.dev','FIRST.LAST@MADISON.DEV'])expect(isMadisonEmail(v)).toBe(true);for(const v of ['a@madison.dev.evil.com','a@sub.madison.dev','a@madisonXdev',' @madison.dev','a@@madison.dev',null])expect(isMadisonEmail(v)).toBe(false);});
  it('requires the original-language question and an answer before manual resolution',()=>{const e=newEntry('FN-BKG-01','qa');expect(entryError(e)).toBe('uxQuestionRequired');e.title.en='Question?';expect(entryError(e)).toBeNull();e.status='answered';expect(entryError(e)).toBe('uxAnswerRequired');e.answer.en='Answer';expect(entryError(e)).toBeNull();e.estimateHours=-1;expect(entryError(e)).toBe('invalidNumber');});
  it('requires costs/hours for CU and a release date for RD',()=>{const r=emptyReview('FN-BKG-01');expect(reviewError(r)).toBeNull();r.compliance='CU';expect(reviewError(r)).not.toBeNull();r.cost=0;r.effortHours=0;expect(reviewError(r)).toBeNull();r.compliance='RD';expect(reviewError(r)).not.toBeNull();r.releaseDate='2026-12-15';expect(reviewError(r)).toBeNull();r.cost=NaN;expect(reviewError(r)).toBe('invalidNumber');});
  it('searches across all languages and filters L2 separately',()=>{expect(filterRequirements(d.requirements,d.entries,[],'','C','L2','','','en')).toHaveLength(6);expect(filterRequirements(d.requirements,d.entries,[],'FN-BKG-01','','','','','sv').map(r=>r.id)).toEqual(['FN-BKG-01']);expect(filterRequirements(d.requirements,d.entries,[],'','','','unreviewed','unassessed','en')).toHaveLength(30);});
  it('preserves descendants when a parent is deleted, even in malformed imported cycles',()=>{const a=newEntry('FN-BKG-01','breakdown'),b=newEntry('FN-BKG-01','breakdown',a.id),c=newEntry('FN-BKG-01','breakdown',b.id);expect(orderedTree([a,b,c]).map(x=>x.depth)).toEqual([0,1,2]);expect(orderedTree([b,c]).map(x=>x.depth)).toEqual([0,1]);a.parentId=c.id;expect(orderedTree([a,b,c])).toHaveLength(3);});
  it('escapes CSV formulas, quotes and empty values',()=>{expect(csvCell('=1+2')).toBe('"\'=1+2"');expect(csvCell(' @evil')).toBe('"\' @evil"');expect(csvCell('"text"')).toBe('"""text"""');expect(csvCell(null)).toBe('""');const csv=matrixCsv(d.requirements,d,'en');expect(csv.charCodeAt(0)).toBe(0xfeff);expect(csv).toContain('FN-BKG-01');expect(csv).not.toContain('undefined');});
});
