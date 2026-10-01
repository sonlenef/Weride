# WeRide client questionnaires — delivery and operation

## Workflow
Staff entry: `/client-questions`, also available from the Q&A hub's **Publish for client** action.
1. Select 1–60 existing questions, including general project questions. Reorder the selected list in preview.
2. Set a client-facing title/introduction, default EN/VI/SV language, requested response date and a 7/14/30-day link lifetime.
3. Review the exact snapshot. Question details are OFF by default; linked RFP excerpts are ON. Internal replies, PIC metadata, estimates, decisions and activity history are not published.
4. Access codes are ON by default and generated randomly. Copy the code before leaving; the server stores a salted scrypt hash, not a recoverable code. Send the code separately from the invitation.
5. Publish explicitly, then copy the link or prepared invitation. No email is sent automatically.
6. Client opens `/respond/<random-token>`, enters the code when enabled, gives a self-reported name/work email and consents to disclosure to Madison.
7. Client answers one question at a time: answer, request clarification, not applicable (with explanation), or confirm later. Partial final submission is supported.
8. Staff reviews received submissions and explicitly imports individual answers into internal Q&A. Source question IDs, scope and versions must still match.

## Drafts and receipts
Drafts auto-save to the server with revision checks. A session-scoped browser copy preserves unsaved local edits and detects concurrent changes.
The private resume link contains a random respondent capability in the URL fragment. It resumes only that respondent's session, including on a separate device. Keep it confidential.
The fragment is removed from browser history after initialization and the capability is sent only in request bodies; the server stores only its hash.
A conflict never silently overwrites another device's edits. Download local answers or explicitly load the latest server draft.
Final submissions are immutable and idempotent. Corrections require a separate submission. A downloadable text receipt/response copy is available.
The owner can see respondent identity/progress for drafts, but draft answer text is not returned to the owner inbox until final submission.

## Review, access and attribution
Only the publishing Madison account manages that publication and its submissions; imported replies are available to the internal workspace team.
Imported replies retain client attribution, submitted time, source question version, publication and receipt IDs. Client identity is explicitly **self-reported, not verified**.
Client replies cannot be edited by ordinary workspace users. Only the original question author can explicitly accept a reply; import does not resolve a question, approve RFP scope or modify the immutable baseline.
Closing stops new sessions and saves/submissions while existing recipients can still read. Reopening is permitted before expiry. Revocation is permanent and blocks normal and resume links.
Anyone holding a valid link and its code (when enabled), or an existing private resume capability, can access the intended disclosure. This is not Microsoft SSO or verified client identity.
Expiry/revocation prevent future server access; they cannot erase copies already downloaded by recipients. Received submissions remain internal records after closure/revocation.

## Implementation and safeguards
Backend is mounted at `/api/client-questionnaires` inside the existing `reviewSharing` function. Public respondent UI does not load Firebase Authentication or require a Madison account.
Collections `clientQuestionnaires`, `clientQuestionnaireTokens`, `clientQuestionnaireOwners`, `clientQuestionnaireLimits`, `clientQuestionnaireRates` are server-only and explicitly denied in Firestore client rules.
Management APIs verify current Microsoft @madison.dev Firebase tokens and the existing absolute 24-hour session policy. Respondent APIs use publication- and session-scoped capabilities.
Strict JSON schemas, same-origin checks, custom write headers, bounded payloads and quotas apply. Limits: 20 publications per owner/day, 50 respondent sessions/publication, 3,000 saves/session, 6,000 characters/answer, 60 questions/publication.
Access-code attempt limits are persisted per publication/network fingerprint/window, with additional per-instance request throttling. These controls are not a penetration-testing certification.
Hosting/API responses use no-store, noindex and no-referrer. No client workspace data is returned by direct Firestore access.
The form does not collect attachments, perform OTP/email verification, send invitations/reminders, or produce a legal electronic signature. It is for discovery clarification only.

## Verification completed before deployment
112 unit tests; 83 Firestore Rules emulator tests; 18 existing sharing API tests; 5 repository integration tests; 46 existing Playwright regression tests; 21 new questionnaire API/integration tests. All passed.
8 client/browser flows and 5 owner/browser flows also passed using synthetic records and a loopback Firestore emulator. No production sign-in was impersonated.
30 new accessibility/layout scans covered EN/VI/SV at 1440px, 390px and 320px plus identity, final review and receipt states. No selected axe violations or document-wide horizontal overflow were detected in these scans.
Real customer-device acceptance, VoiceOver/NVDA and external client identity verification are not claimed.
Test fixtures and browser harnesses live under `functions/tests` and are excluded from function deployment and the production frontend entry graph.

## Re-running tests
- `npm test && npm run build && npm run test:e2e`
- `npm run test:rules && npm run test:review-api && npm run test:review-integration`
- `npm --prefix functions run build`
- `firebase emulators:exec --only firestore --project demo-weride 'node --test --test-concurrency=1 functions/tests/questionnaire.integration.mjs'`
- With the Vite development server on loopback port 5173: `firebase emulators:exec --only firestore --project demo-weride 'node functions/tests/client-browser.mjs && node functions/tests/client-manager-browser.mjs'`
Evidence: `.backups/client-questionnaire-browser/report.json`, `manager-report.json`, `manager-scans.json` and corresponding synthetic screenshots.

## Backup and retention
A 262-document, read-only workspace backup and source rollback copy were taken before this implementation. No production business question, answer, assignment or baseline was changed to test the feature.
Source rollback: `.backups/client-questionnaires-20260929T164203Z`.
Workspace backup: `.backups/data/2026-09-29T16-42-44-202Z-before-uiux-upgrade` (SHA-256 `dd21ccfd40cf18a453cd0be5c2df2b7a78b9f82b5fc346606229d3b0daa28d08`).
Automatic backups/PITR and scheduled deletion were not configured by this release. The existing workspace-only backup script does not include server-only client collections; include those collections in future database backup/export and retention procedures.

## Deployment verified
Firebase Hosting, Firestore Rules/indexes and the existing `reviewSharing` Cloud Function were deployed successfully.
Verification completed at 2026-09-29T17:51:36Z: all deployed assets match the tested build; both new and existing share APIs are available; staff routes remain Microsoft sign-in protected.
Anonymous management access returns 401, direct private Firestore reads return 403, invalid respondent links return no question data, and cross-origin writes are rejected.
All 30 original requirements are unchanged. Retired seed questions remain absent. No production client questionnaire or response was created for testing (publication count: 0 at verification).
Function IAM was inspected: the runtime account has datastore.user and firebaseauth.viewer. No additional IAM grant or Authentication provider was added.
Release evidence: `docs/CLIENT-QUESTIONNAIRES-LIVE-SMOKE.json` and `docs/CLIENT-QUESTIONNAIRES-DATA-VERIFICATION.json`.
