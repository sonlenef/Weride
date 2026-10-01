export type Locale = 'en' | 'vi' | 'sv';
export type Localized = Record<Locale, string>;
export type Kind = 'qa' | 'breakdown' | 'assumption';
export type Module = 'A' | 'B' | 'C';
export type Compliance = '' | 'FC' | 'PC' | 'RD' | 'CU' | 'NC';
export type ReviewState = 'unreviewed' | 'reviewing' | 'clarified' | 'scoped';
export interface Requirement { id: string; module: Module; tier: 'L1' | 'L2'; title: Localized; description: Localized; sourcePage: number; sourceSection: string; order: number; }
export interface Entry {
  originalLocale?: Locale; restoredFrom?: string;
  id: string; requirementId: string; kind: Kind; parentId: string;
  title: Localized; body: Localized; answer: Localized; acceptance: Localized;
  status: string; priority: 'low' | 'medium' | 'high' | 'critical'; owner: string; estimateHours: number | null;
  version: number; origin: 'proposal' | 'team'; createdBy: string; updatedBy: string;
  createdByName: string; updatedByName: string; createdAt?: string; updatedAt?: string;
}
export interface Review { id: string; compliance: Compliance; state: ReviewState; comments: Localized; effortHours: number | null; cost: number | null; currency: 'EUR' | 'SEK'; releaseDate: string; version: number; updatedBy?: string; updatedByName?: string; updatedAt?: string; }
export interface Activity { id: string; action: 'create' | 'update' | 'delete' | 'review'; requirementId: string; entryId: string; kind: string; title: Localized; actor: string; actorName: string; at: string; before?: unknown; after?: unknown; }
export interface Project {
  id: string; name: string; client: string; reference: string; sourceFile: string; summary: Localized; fleetReference: number; fleetReferencePage: number;
  milestones: Array<{key: string; date: string; time?: string; page: number}>;
  clarifications: Array<{id: string; title: Localized; body: Localized; pages: string}>;
}
export interface Reply { external?: {publicationId:string;submissionId:string;questionVersion:number;respondentName:string;respondentEmail:string;identityVerified:false;answerKind:string;submittedAt:string;importedBy:string}; id:string; questionId:string; body:Localized; originalLocale:Locale; version:number; createdBy:string; createdByName:string; updatedBy:string; updatedByName:string; createdAt?:string; updatedAt?:string; }
export interface QuestionResolution { id:string; replyId:string; replyVersion:number; version:number; updatedBy:string; updatedByName:string; updatedAt?:string; }
export interface Decision { id:string; title:Localized; body:Localized; originalLocale:Locale; state:'proposed'|'confirmed'|'superseded'; source:string; ownerUid:string; requirementIds:string[]; version:number; createdBy:string; createdByName:string; updatedBy:string; updatedByName:string; createdAt?:string; updatedAt?:string; confirmedBy:string; confirmedAt?:string|null; }
export interface TrashItem { id:string; entryId:string; snapshot:Entry; deletedBy:string; deletedByName:string; deletedAt:string; restoredBy:string; restoredAt:string|null; version:number; }

export interface Workspace { schemaVersion: number; project: Project; requirements: Requirement[]; entries: Entry[]; reviews: Review[]; activities: Activity[]; }
export const locales: Locale[] = ['en', 'vi', 'sv'];
export const blankText = (): Localized => ({en: '', vi: '', sv: ''});
export const states: Record<Kind, string[]> = { qa: ['open', 'answered', 'resolved'], breakdown: ['todo', 'progress', 'done'], assumption: ['unvalidated', 'confirmed', 'rejected'] };
export const emptyReview = (id: string): Review => ({id, compliance: '', state: 'unreviewed', comments: blankText(), effortHours: null, cost: null, currency: 'EUR', releaseDate: '', version: 0});
export const newEntry = (requirementId: string, kind: Kind, parentId = ''): Entry => ({id: crypto.randomUUID(),requirementId,kind,parentId,title:blankText(),body:blankText(),answer:blankText(),acceptance:blankText(),status:states[kind][0],priority:'medium',owner:'',estimateHours:null,version:0,origin:'team',createdBy:'',updatedBy:'',createdByName:'',updatedByName:''});
