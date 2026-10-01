import type { Entry, TeamMember } from './types';
/** Author identity is immutable Firebase UID, not PIC, display name or free-text owner. */
export function canManageEntry(entry: Entry, uid: string | undefined): boolean {
  return Boolean(uid) && (entry.kind !== 'qa' || entry.createdBy === uid);
}
export function questionAuthor(entry: Entry, members: TeamMember[] = []): string {
  const person = members.find(p => p.uid === entry.createdBy);
  return person?.displayName?.trim() || entry.createdByName?.trim() || '';
}
export function orderedQuestions(entries: Entry[], requirementId: string): Entry[] {
  const date = (value?: string) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  return entries.filter(e => e.requirementId === requirementId && e.kind === 'qa').sort((a,b) =>
    Number(b.origin === 'team') - Number(a.origin === 'team') || date(b.createdAt) - date(a.createdAt) || a.id.localeCompare(b.id));
}
export const hasQuestionDraft = (entry: Entry): boolean =>
  [...Object.values(entry.title), ...Object.values(entry.body)].some(v => Boolean(v.trim()));
