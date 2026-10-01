from pathlib import Path
p=Path('functions/src/repository.ts')
s=p.read_text().replace('Entry, Review }','Entry, Review, Reply, Decision, QuestionResolution }')
s=s.replace('[project,context,requirements,entries,reviews]=','[project,context,requirements,entries,reviews,replies,decisions,resolutions]=')
s=s.replace("tx.get(base.collection('requirements')),tx.get(base.collection('entries')),tx.get(base.collection('reviews')),", "tx.get(base.collection('requirements')),tx.get(base.collection('entries')),tx.get(base.collection('reviews')),tx.get(base.collection('replies')),tx.get(base.collection('decisions')),tx.get(base.collection('resolutions')),")
s=s.replace('entries.size>5000||requirements.size>1000','entries.size>5000||requirements.size>1000||replies.size>10000||decisions.size>1000')
s=s.replace('return {project:project.data()', 'return {replies:replies.docs.map(d=>d.data() as Reply),decisions:decisions.docs.map(d=>d.data() as Decision),resolutions:resolutions.docs.map(d=>d.data() as QuestionResolution),project:project.data()')
p.write_text(s)
print('Reply/decision data is captured with the existing read-only source transaction; sharing authorization unchanged.')
