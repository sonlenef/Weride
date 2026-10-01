# Data backup and discovery-question cleanup — 2026-09-29

## Executed change
- The workspace owner requested deletion of all questions displayed as Madison discovery drafts.
- Selection matched the UI: kind=qa, origin=proposal, and creator not in the member directory.
- All 30 matches also had createdBy=seed and known IDs in the original private seed fixture.
- Before deletion: 31 questions. After deletion: 1 member question; 0 discovery-draft questions.
- The delete commit also wrote 30 administrative activity records with original before snapshots.
- Every deletion used the backed-up document updateTime as a precondition.
- All 232 other original workspace documents were re-read and had unchanged updateTime.
- The 30 requirements, 30 assignment records, 90 breakdowns and 30 assumptions were preserved.
- No Auth account, Firebase rule, Hosting deployment or existing public share was changed.

## Backup saved before deletion
Directory: `.backups/data/2026-09-29T13-55-06-327Z-before-draft-qa-removal/`
- `workspace.raw.json`: 262 Firestore documents under workspaces/weride, including descendants.
- Captured at a common readTime; original typed Firestore fields and updateTime are retained.
- `questions-to-remove.raw.json`: the 30 selected documents.
- `manifest.json`: selection, operation ID, counts and SHA-256 integrity check.
- `deletion-receipt.json`, `verification.json`, `final-integrity-check.json`: execution evidence.
- Files are local on the owner's Mac, in a protected directory outside Hosting assets.
- This is a one-off workspace data backup, not an Auth/configuration/share-token backup.
- Integrity was checked; a restore drill was NOT performed. There is no web undo interface.

## Safeguards and remaining gap
The server-only maintenance/retired-discovery-questions record lists retired seed IDs. scripts/seed.mjs now skips those IDs, avoiding accidental recreation by a later seed run. The original fixture is preserved for source history/testing.
Native Firestore backup schedules: none found. Managed backups inventory: empty. PITR: disabled. Database deletion protection: enabled, but does not prevent document deletion. Existing source-code backups and UI activity history are not an automated database backup.
Recommended next step, pending owner approval: daily managed backups retained 30 days, plus PITR up to 7 days. These are billable features; no recurring backup or PITR configuration was enabled by this operation.
Existing AI shared snapshots retain their prior content; create a new share for the cleaned current workspace.
