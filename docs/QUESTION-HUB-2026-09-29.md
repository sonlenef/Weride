# Central questions, general project Q&A and priority

## Implemented
- New authenticated `/questions` route and Questions & answers navigation, translated EN/VI/SV.
- Lists the same Q&A records used by the matrix, landscape and requirement detail; no duplicate copies.
- New questions may select General project question or an existing requirement.
- `entries.requirementId === ''` means project-wide Q&A only. No artificial requirement is created.
- The requirement association stays immutable after creation, like existing entry provenance.
- Priority: low / medium / high / critical. Existing values retained; new entries default to medium.
- Priority controls in inline composers and the question editor; shared badges on all Q&A surfaces.
- Search by question, answer, asker or requirement ID; filter scope, status, priority and asker.
- My questions, General questions and Open questions shortcuts; newest/oldest/priority sorting.
- Pagination at 20 questions; CSV exports every matching question, not just the visible page.
- General-question activity links return to the question hub rather than a missing requirement page.

## Boundaries
- Existing signed Microsoft exact-domain and absolute 24-hour access rules remain unchanged.
- Only the original asker can edit/delete Q&A, including priority. PIC does not grant ownership.
- General scope is rejected for breakdowns, assumptions, reviews and assignments.
- Unknown non-empty requirement IDs, invalid priority and changed immutable fields are rejected.
- Existing version checks and transaction-based activity writes are retained.
- Requirement-based AI packs explicitly exclude general project Q&A. CSV in the hub includes it.
- No data migration, production sample questions, account change or billing change is required.

## Automated validation
- 77 unit tests, 64 Firestore emulator rules tests and 46 browser tests passed.
- 18 sharing API tests and 5 repository integration tests passed.
- Total: 210 tests; source fixture and immutable RFP remain unchanged.
- Browser checks cover create/edit/answer/delete, priority sync, author restrictions, scope and mobile EN/VI/SV.
- Real employee-authenticated production CRUD is not simulated by the anonymous Hosting smoke test.

## Deployment verified
- Firebase Hosting, Firestore rules/indexes and the existing review-sharing function deployed successfully.
- Live Hosting assets match the final tested build; /questions and filtered/deep links return the protected app shell.
- Live rules exactly match source: SHA256 6127b241aa204640686847c99515062737b10aca66051660160299fa7db7b347.
- Sharing health endpoint remains available; no production question, assignment or source record was changed by tests.
- Detailed smoke output: docs/QUESTION-HUB-LIVE-SMOKE.txt.
