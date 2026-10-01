# UI/UX remediation — WeRide Discovery Workspace

Scope: implementation changes for UX-01 through UX-36 in the 2026-09-29 audit. This is a technical delivery report, not a WCAG certification or an employee usability-study result.

## Data safety
- Source rollback copy: `.backups/uiux-fixes-20260929T144419Z`.
- Pre-change read-only workspace backup: `.backups/data/2026-09-29T14-44-58-273Z-before-uiux-upgrade`.
- 262 workspace documents; SHA-256: `28ea9e6696467ba3a926b85b49a6352679a3bc0d79bce50503ad7a0b3edfa83e`.
- Backup excludes Firebase Authentication and external share snapshots. No managed backup/PITR policy was changed.
- No production business records were created, edited or deleted during implementation/testing. Retired seed questions remain retired.

## Delivered behavior
- UX-01–09: shared readable tokens, density, hit areas, inert mobile drawer, focus management, route headings/skip link, low-height sidebar and responsive detail/export controls.
- UX-10–13: URL/scroll return context, per-UID sessionStorage drafts with 24-hour lifetime, expiry warning and field-specific validation.
- UX-14–19: independent replies, asker-only acceptance/reopen, author-owned question scope changes, native-language quick create, priority explanations and compact/limited question previews.
- UX-20–26: Scoped-only progress, actionable My work, URL-based System selection, explicit results jump, unified search and real content-language attributes.
- UX-27–29: protected original source excerpts with printed/viewer page distinction; proposed/confirmed/superseded decision records; field diff, older activity and controlled restoration.
- UX-30–36: dismissible Export, metadata-based sync feedback, effective pack selection counts, explicit general-Q&A/decision opt-in, retryable sharing health, public TOC and deferred authenticated bundle/routes.

## Workflow and privacy policy
- Replies do not permit editing another member's original question. Only the asker accepts/reopens; accepted reply content is locked until reopened.
- Decisions are proposed by default. Confirmation requires evidence and records the current author; it is not independent evidence of client sign-off.
- Drafts remain private to the account in the current browser tab. They survive route changes, reload and authentication expiry. Closing the tab loses them; explicit logout clears them. No automatic publication.
- New UI deletions create an exact transactional trash snapshot. Restore preserves provenance, adds a version and refuses overwrites. Older retired seed questions are not backfilled into Trash.
- General questions and recorded decisions enter a share only through explicit opt-in. Structured personal identifiers are excluded; free text still requires disclosure review.
- Source excerpts are authenticated; the complete source PDF is not published.

## Verification
The acceptance evidence is stored under `.backups/uiux-remediation-20260929/`: 68 axe/DOM states in EN/VI/SV, zero detected violations in the selected rules, zero measured overflow and zero runner/runtime errors. Narrow 320px checks were also run. Automated results do not substitute for manual screen-reader or physical-device testing.
Local functional smoke covered create/reply/accept/reopen/move/delete/restore, context-preserving navigation, persistent drafts and evidence-required decisions. A disposable preview profile was used; external HTTPS requests were blocked.

## Final automated run
- 100 unit tests passed.
- 83 Firestore emulator security-rule tests passed.
- 18 sharing API tests passed.
- 5 repository integration tests passed.
- 46 Playwright regression tests passed.
- Total: 252 tests passed. The 10-step local collaboration smoke also passed.
- Read-only interaction checks: 22 Tab moves stayed in the open drawer; Escape restored the menu trigger; Sign out remained visible at 700px height; Export dismissed on Escape/outside click; modal focus returned to its opener.

## Deployment verified
- Cloud Function `reviewSharing` updated successfully, ACTIVE, Node.js 22, maxInstances=2; updateTime 2026-09-29T15:57:15.124306114Z.
- Firebase Hosting, Firestore rules and indexes deployed successfully to `weride-discovery`.
- Live HTML and all 24 published build files match the tested build.
- Cloud rule verification at 2026-09-29T16:02:22.187Z: SHA-256 `0e2b3ba21a1f55cd3ab8c9baec0e93e06a837d7412e3caeedb422b36483c9351` matches source.
- All 30 RFP requirements are unchanged from the pre-change backup; retired seed question count remains zero.
- Anonymous new collaboration collection reads return 403; anonymous share management returns 401. Public sharing health is available.

## Performance evidence
Production login shell, three fresh browser profiles, 390x844 viewport, cache disabled, CPU throttle x4, 150ms latency, 1.6Mbps down / 0.75Mbps up. LCP samples: 2048ms, 1524ms, 1512ms; CLS=0 in all three. Only the 514,934-byte decoded main JS loaded before login (129,068 transfer bytes per sample). This is lab evidence, not field p75/INP or an authenticated data-ready measurement.

## Handover limits
No manual NVDA/VoiceOver certification, physical Safari/iOS/Android acceptance, real two-employee Microsoft-session CRUD, or field performance study is claimed. Database backup/PITR scheduling and external analytics remain unchanged. Test snapshots were local/synthetic; no real project source was published for verification.
