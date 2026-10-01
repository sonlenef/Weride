from pathlib import Path
p = Path('functions/src/questionnaire-repository.ts')
source = p.read_text()
old = 'const answers=parseAnswers(rawAnswers,p.snapshot);'
new = '''const draftAnswers = parseAnswers(rawAnswers, p.snapshot);
    const answers = submit
      ? Object.fromEntries(Object.entries(draftAnswers).filter(([, answer]) => answer.kind !== 'answer' || answer.text.trim().length > 0))
      : draftAnswers;'''
assert old in source
p.write_text(source.replace(old, new))
print('Blank draft fields retain language preferences; final submissions exclude unanswered fields.')
