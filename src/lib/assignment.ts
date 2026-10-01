import type { Assignment, Requirement, TeamMember } from './types';
export const eligiblePic = (person: TeamMember | undefined): person is TeamMember => Boolean(person && person.active && person.provider === 'microsoft.com' && /^[a-z0-9._%+-]+@madison[.]dev$/i.test(person.email));
export const memberLabel = (person: TeamMember | undefined): string => person?.displayName?.trim() || person?.email || '';
export function filterByPic(rows: Requirement[], assignments: Assignment[], filter: string, currentUid: string): Requirement[] {
  if (!filter) return rows;
  return rows.filter(row => {
    const uid = assignments.find(item => item.id === row.id)?.assigneeUid || '';
    return filter === 'mine' ? uid === currentUid : filter === 'unassigned' ? !uid : uid === filter.replace(/^uid:/, '');
  });
}
export function assignmentTitle(name: string) {
  return name ? {en:`PIC assigned to ${name}`,vi:`Phân công PIC cho ${name}`,sv:`PIC tilldelad till ${name}`} : {en:'PIC assignment removed',vi:'Đã gỡ phân công PIC',sv:'PIC-tilldelning borttagen'};
}
