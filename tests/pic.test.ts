import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {eligiblePic,memberLabel,filterByPic,assignmentTitle} from '../src/lib/assignment';
import {matrixCsv} from '../src/lib/helpers';
import {prepareContent,defaultOptions} from '../functions/src/pack';
import type {Workspace,TeamMember,Assignment} from '../src/lib/types';
const data=JSON.parse(readFileSync('private/seed.json','utf8')) as Workspace;data.reviews=[];data.activities=[];
const member:TeamMember={uid:'teammate',displayName:'Example PIC',email:'teammate@madison.dev',provider:'microsoft.com',active:true};
const assignment:Assignment={id:'FN-BKG-01',assigneeUid:member.uid,version:1,updatedBy:'reviewer',updatedByName:'Reviewer',activityId:'event'};
describe('PIC eligibility and export',()=>{
  it('accepts only active Microsoft accounts on the exact domain',()=>{
    expect(eligiblePic(member)).toBe(true);expect(eligiblePic(undefined)).toBe(false);
    for(const p of [{...member,active:false},{...member,email:'x@madison.dev.evil.com'},{...member,provider:'password'}])expect(eligiblePic(p as TeamMember)).toBe(false);
  });
  it('uses a real display name with an email fallback',()=>{expect(memberLabel(member)).toBe('Example PIC');expect(memberLabel({...member,displayName:''})).toBe(member.email);expect(memberLabel(undefined)).toBe('');});
  it('filters all, assigned-to-me, unassigned and an explicit account',()=>{
    expect(filterByPic(data.requirements,[assignment],'','teammate')).toHaveLength(30);
    expect(filterByPic(data.requirements,[assignment],'mine','teammate').map(r=>r.id)).toEqual(['FN-BKG-01']);
    expect(filterByPic(data.requirements,[assignment],'mine','someone-else')).toHaveLength(0);
    expect(filterByPic(data.requirements,[assignment],'unassigned','teammate')).toHaveLength(29);
    expect(filterByPic(data.requirements,[assignment],'uid:teammate','')).toHaveLength(1);
    expect(filterByPic(data.requirements,[{...assignment,assigneeUid:''}],'unassigned','')).toHaveLength(30);
  });
  it('records assignment and removal titles in all three languages',()=>{for(const l of ['en','vi','sv'] as const){expect(assignmentTitle('Example PIC')[l]).toContain('Example PIC');expect(assignmentTitle('')[l].length).toBeGreaterThan(5);}});
  it('includes PIC in the authenticated matrix CSV',()=>{const csv=matrixCsv(data.requirements,{...data,members:[member],assignments:[assignment]},'en');expect(csv).toContain('"PIC","PIC email"');expect(csv).toContain('Example PIC');expect(csv).toContain(member.email);});
  it('never includes the internal employee directory or PIC identity in AI review packs',()=>{
    const pack=JSON.stringify(prepareContent({...data,members:[member],assignments:[assignment]},defaultOptions()));
    expect(pack).not.toContain(member.email);expect(pack).not.toContain(member.displayName);expect(pack).not.toContain('assigneeUid');expect(pack).not.toContain('members');
  });
});
