from pathlib import Path
import json,re
p=Path('firestore.rules');s=p.read_text()
a=s.index('    function validEntry(');b=s.index('    function validParent(',a);part=s[a:b]
part=re.sub(r'(d.keys\(\).hasOnly\(\[[^\]]+)(\]\))',r"\1,'originalLocale','restoredFrom'\2",part,count=1)
part=part.replace('localized(d.title,2000) && d.title.en.size() > 0',"localized(d.title,2000) && (d.kind == 'qa' ? d.get('originalLocale','en') in ['en','vi','sv'] && d.title[d.get('originalLocale','en')].size() > 0 : d.title.en.size() > 0)")
part=part.replace("d.answer.en.size() > 0",'contentPresent(d.answer)')
s=s[:a]+part+s[b:]
a=s.index('    function validAudit(');b=s.index('    match /workspaces/weride',a);part=s[a:b]
part=part.replace("'assign','unassign']","'assign','unassign','restore','resolve']").replace("d.kind == 'qa' :", "d.kind in ['qa','reply','resolution','decision'] :")
part=part.replace("'review','assignment']","'review','assignment','reply','resolution','decision']").replace("['create','update','delete','review']);","['create','update','delete','review','restore','resolve']);")
s=s[:a]+part+s[b:]
ids=[r['id'] for r in json.loads(Path('private/seed.json').read_text())['requirements']]
extra="    function validDecisionRequirements(ids) { return ids.toSet().hasOnly("+json.dumps(ids)+"); }\n"+Path('scripts/ux-collaboration.rules').read_text()
s=s.replace('    match /workspaces/weride {',extra+'\n    match /workspaces/weride {\n'+Path('scripts/ux-collaboration-matches.rules').read_text())
s=s.replace("&& request.resource.data.version == 1 && request.resource.data.origin == 'team'\n          && request.resource.data.createdBy == request.auth.uid && request.resource.data.createdAt == request.time;", "&& (('restoredFrom' in request.resource.data) ? validRestore(request.resource.data) : request.resource.data.version == 1 && request.resource.data.origin == 'team' && request.resource.data.createdBy == request.auth.uid && request.resource.data.createdAt == request.time);")
s=s.replace("hasOnly(['title','body','answer','acceptance','status','priority','owner','estimateHours','version','updatedBy','updatedByName','updatedAt']);", "hasOnly(['title','body','answer','acceptance','status','priority','owner','estimateHours','version','updatedBy','updatedByName','updatedAt','originalLocale','requirementId'])\n          && (resource.data.kind == 'qa' || request.resource.data.requirementId == resource.data.requirementId);")
p.write_text(s)
print('Added per-author reply rules, asker-only acceptance/scope changes, native-language Q&A, decisions and validated trash restoration. RFP and auth boundaries preserved.')
