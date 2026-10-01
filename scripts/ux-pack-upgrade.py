from pathlib import Path
p=Path('functions/src/pack.ts');s=p.read_text()
s=s.replace('Review, Localized }','Review, Localized, Reply, Decision, QuestionResolution }')
s=s.replace('excludedEntryIds: string[]; note: string;','excludedEntryIds: string[]; note: string; includeGeneralQa:boolean; includeDecisions:boolean; excludedDecisionIds:string[];')
s=s.replace('reviewContext?: ReviewContext | null;','reviewContext?: ReviewContext | null; replies?:Reply[]; decisions?:Decision[]; resolutions?:QuestionResolution[];')
s=s.replace("excludedEntryIds: [], note: ''", "excludedEntryIds: [], note: '', includeGeneralQa:false, includeDecisions:false, excludedDecisionIds:[]")
s=s.replace("const v = raw as Record<string, unknown>;", "const supplied=raw as Record<string,unknown>;\n  const v:Record<string,unknown>={includeGeneralQa:false,includeDecisions:false,excludedDecisionIds:[],...supplied};")
s=s.replace("'includeVendor','includeEstimates']", "'includeVendor','includeEstimates','includeGeneralQa','includeDecisions']")
s=s.replace('excludedEntryIds: ids(v.excludedEntryIds, 1000),', 'excludedEntryIds: ids(v.excludedEntryIds, 1000), excludedDecisionIds:ids(v.excludedDecisionIds,1000),')
s=s.replace('function localized(v: Localized | undefined, language: Language): Partial<Localized> {','function localized(v: Localized | undefined, language: Language, original:Language=\'en\'): Partial<Localized> {')
s=s.replace("return { en: redact(v?.en),", "return { en: redact(v?.en), ...(original!=='en'&&v?.[original]?.trim()?{[original]:redact(v[original])}:{}),")
s=s.replace('  const allEntries = data.entries.filter(e => ids.has(e.requirementId));', "  const candidateEntries=data.entries.filter(e=>ids.has(e.requirementId)||(e.kind==='qa'&&e.requirementId===''));\n  const allEntries=candidateEntries.filter(e=>ids.has(e.requirementId)||(options.includeGeneralQa&&e.kind==='qa'));" )
s=s.replace('new Set(allEntries.map(e => e.id))','new Set(candidateEntries.map(e => e.id))')
s=s.replace("  const project = data.project;", """  const questionIds=new Set(included.filter(e=>e.kind==='qa').map(e=>e.id));
  const eligibleDecisions=(data.decisions||[]).filter(d=>!d.requirementIds.length||d.requirementIds.some(id=>ids.has(id)));
  if(options.excludedDecisionIds.some(id=>!eligibleDecisions.some(d=>d.id===id)))throw new PackError('CONTEXT_CHANGED',409);
  const decisions=options.includeDecisions?eligibleDecisions.filter(d=>!options.excludedDecisionIds.includes(d.id)):[];
  const project = data.project;""")
s=s.replace('parentIncluded:!e.parentId',"originalLocale:e.originalLocale||'en',parentIncluded:!e.parentId")
for field in ['title','body','answer','acceptance']:
 s=s.replace(f'localized(e.{field},options.language)',f"localized(e.{field},options.language,e.originalLocale||'en')")
marker='    reviews: options.includeVendor ?'
extra="""    replies:(data.replies||[]).filter(r=>questionIds.has(r.questionId)).sort((a,b)=>a.id.localeCompare(b.id)).map(r=>({id:r.id,questionId:r.questionId,version:r.version,originalLocale:r.originalLocale,body:localized(r.body,options.language,r.originalLocale),updatedAt:date(r.updatedAt),acceptedByAsker:Boolean(data.resolutions?.some(x=>x.id===r.questionId&&x.replyId===r.id&&x.replyVersion===r.version))})),
    decisions:decisions.sort((a,b)=>a.id.localeCompare(b.id)).map(d=>({id:d.id,title:localized(d.title,options.language,d.originalLocale),body:localized(d.body,options.language,d.originalLocale),originalLocale:d.originalLocale,state:d.state,source:redact(d.source),requirementIds:d.requirementIds,version:d.version,updatedAt:date(d.updatedAt),confirmationRecorded:d.state==='confirmed',confirmedAt:date(d.confirmedAt)})),
"""
s=s.replace(marker,extra+marker)
s=s.replace('vendorResponsesIncluded:options.includeVendor,',"generalQuestionsIncluded:included.filter(e=>e.requirementId==='').length,generalQuestionsExcluded:data.entries.filter(e=>e.kind==='qa'&&e.requirementId==='').length-included.filter(e=>e.requirementId==='').length,decisionsIncluded:decisions.length,decisionsExcluded:eligibleDecisions.length-decisions.length,\n      vendorResponsesIncluded:options.includeVendor,")
s=s.replace('origin:e.origin,status:e.status,priority:e.priority,', "origin:e.origin,status:e.status,discussionStatus:e.kind!=='qa'?e.status:(data.resolutions?.some(x=>x.id===e.id&&x.replyId&&(data.replies||[]).some(r=>r.id===x.replyId&&r.version===x.replyVersion))?'resolved':e.status!=='open'?e.status:(data.replies||[]).some(r=>r.questionId===e.id)?'answered':'open'),priority:e.priority,")
a=s.index('function locLines(');b=s.index('export function packMarkdown(',a)
s=s[:a]+'''function locLines(value:Partial<Localized>,label:string,language:Language,original:Language='en'):string {
  const names={en:'English',vi:'Vietnamese',sv:'Swedish'};
  const actual=(value[original]?.trim()?original:languages.find(l=>value[l as Language]?.trim())||original) as Language;
  let result=`**${label} · ${names[actual]} / stored source**\\n\\n${block(value[actual])}`;
  if(language!==actual)result+=`\\n**${label} · ${names[language]} / stored translation**\\n\\n${block(value[language]||'[No stored translation. Read the source above; do not invent a translation.]')}`;
  return result;
}
function appendReplies(out:string[],c:PackContent,questionId:string,language:Language):void {
  const replies=(c.replies||[]).filter(r=>r.questionId===questionId);
  if(!replies.length)return;
  out.push(`##### Replies to ${questionId} (${replies.length})`);
  for(const r of replies)out.push(`Reply ID: ${r.id}. Version: ${r.version}. Accepted by asker: ${r.acceptedByAsker?'yes (internal record, not proof of client approval)':'no'}. Updated: ${r.updatedAt||'not recorded'}.`,locLines(r.body,'Reply',language,r.originalLocale||'en'));
}
''' +s[b:]
s=s.replace("'Excluded: general project questions that have no requirement (available in the Questions & answers hub), member names/IDs from structured metadata, owners, account emails, activity history, authentication data and the full source PDF.", "'Excluded: member names/IDs from structured metadata, owners, account emails, activity history, authentication data and the full source PDF.")
s=s.replace("    'Not supplied: private chat history", "    `General project questions: ${c.options.includeGeneralQa?'explicitly selected':'excluded (not opted in)'}. Included: ${c.coverage.generalQuestionsIncluded||0}; excluded: ${c.coverage.generalQuestionsExcluded||0}. Recorded decisions: ${c.options.includeDecisions?'explicitly selected':'excluded (not opted in)'}; included: ${c.coverage.decisionsIncluded||0}. Replies accompany included Q&A only.`,\n    'Not supplied: private chat history")
for field,label in [('title','Title'),('body','Details'),('answer','Recorded answer (blank means unanswered)')]:
 s=s.replace(f"locLines(e.{field},'{label}',l)",f"locLines(e.{field},'{label}',l,e.originalLocale||'en')")
s=s.replace("        if(e.kind==='qa')out.push(locLines(e.answer,'Recorded answer (blank means unanswered)',l,e.originalLocale||'en'));", "        if(e.kind==='qa'){out.push(`Discussion state derived from recorded replies: ${e.discussionStatus||e.status}.`,locLines(e.answer,'Recorded answer (blank means unanswered)',l,e.originalLocale||'en'));appendReplies(out,c,e.id,l);}")
insert='''  if(c.options.includeGeneralQa){
    const questions=c.entries.filter(e=>e.kind==='qa'&&e.requirementId==='');out.push(`## General project questions (${questions.length} included)`);
    for(const e of questions){out.push(`### General question ${e.id}`,`Version: ${e.version}. Priority: ${e.priority}. Recorded status: ${e.status}. Discussion state: ${e.discussionStatus||e.status}. This is a team discussion, not an RFP requirement.`,locLines(e.title,'Question',l,e.originalLocale||'en'),locLines(e.body,'Details',l,e.originalLocale||'en'),locLines(e.answer,'Recorded answer',l,e.originalLocale||'en'));appendReplies(out,c,e.id,l);}
  }
  if(c.options.includeDecisions){out.push(`## Recorded decisions (${(c.decisions||[]).length} included)`);for(const d of c.decisions||[])out.push(`### Decision ${d.id}`,`Version: ${d.version}. State: ${d.state}. Related requirements: ${d.requirementIds.join(', ')||'project-wide'}. Confirmation recorded: ${d.confirmationRecorded?'yes':'no'}. Confirmation timestamp: ${d.confirmedAt||'not recorded'}. An internal confirmation does not independently prove client approval.`,locLines(d.title,'Decision',l,d.originalLocale),locLines(d.body,'Details',l,d.originalLocale),'Evidence / source reference:',block(d.source));}
'''
s=s.replace('  out.push(`## End of snapshot`',insert+'  out.push(`## End of snapshot`')
p.write_text(s)
print('Review packs: explicit general Q&A/decisions, versioned replies and honest native-language source labels. Existing links stay frozen.')
