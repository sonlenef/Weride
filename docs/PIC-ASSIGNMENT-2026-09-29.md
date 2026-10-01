# Requirement PIC assignment — 29 September 2026

## Delivered behavior
- One PIC per requirement, selected from the internal account directory by Firebase UID.
- Assign, reassign, remove, search by name/email and assign to self from matrix or detail.
- Matrix filters: all, assigned to me, unassigned, or an individual PIC; authenticated CSV includes PIC name/email.
- Assignment responsibility does not change shared-editor permissions or propagate to free-text owners on individual discovery entries.
- Original RFP requirements remain read-only. No demonstration assignment was written to production.
- English, Vietnamese and Swedish interface translations are included.

## Identity directory
`workspaces/weride/members/{uid}` contains only UID, display name, email, provider, active status and timestamps. Existing eligible Firebase Auth accounts are backfilled with `npm run sync:members -- --project weride-discovery --account APPROVED_ACCOUNT`. This reads Auth but never changes Auth users or exports credentials. New eligible users register their own profile when they sign in; rules bind the profile UID and email to the authenticated identity. Other identities and extra privilege fields cannot be created by a client. Disabled entries cannot be reactivated by a client.

Directory deactivation/deletion is not an automatic Firebase Auth trigger on this Spark deployment. Run the same administrative sync after disabling/removing accounts in Auth. Existing assignments retain their UID and become visibly inactive/unavailable rather than being silently erased.

## Persistence and security
`workspaces/weride/assignments/{requirementId}` stores assignee UID, version, last actor/time and activity ID. Each save uses a Firestore transaction, checks the selected active directory record and expected version, and writes an activity snapshot atomically. Security Rules require a fresh matching event with the actual before/after assignment. Stale updates, arbitrary assignees, actor spoofing, baseline writes and physical assignment deletion are rejected. Removal is a new unassigned revision. Direct Microsoft SSO and exact-domain checks are unchanged; no email-verification step was restored.

Employee/PIC identity is excluded from AI Review Pack output, including when the live workspace contains members and assignments. Authenticated internal CSV/JSON exports are different from AI share packs.

## UI repair
Removed the 20px top padding on the Export wrapper. Review/Export now use the same 42px height and shared flex alignment. Fixed table hidden-label positioning so the matrix scrolls within its container instead of widening the document. Verified both before and after lazy-loading AI Review Pack styles.

## Verification
- Unit: 48 passing, including PIC eligibility, filters, CSV and AI-pack privacy.
- Firestore rules emulator: 40 passing, including directory, atomic assignment history and version conflicts.
- Playwright: 25 passing, including assign/reassign/remove, persistence, matrix filters, cancel, self-assignment and EN/VI/SV toolbar geometry at 320/390/768/1280/1440px.
- Production smoke test and directory synchronization are recorded separately after deployment. No employee session was impersonated for tests.

## Production verification
Deployment completed to `weride-discovery` Hosting and Firestore rules/indexes. Live HTML and all JS/CSS assets match the tested build. The released Firestore rules match the local source exactly. Anonymous reads of the workspace, private context, share storage, member directory and assignment paths return HTTP 403. The login gate, EN/VI/SV preference and mobile login layout pass live smoke checks.

The directory contains 6 eligible existing Microsoft accounts, including `Son Le`; all 30 source requirements remain present. There were 0 production assignments at verification: no example allocation was made on the user's behalf. The user can select Son Le on FN-BKG-01 after refreshing the site. Authenticated PIC mutations were tested in local browser preview and against Firestore Security Rules on the emulator, not by impersonating an employee on production.

Billing remains disabled; this feature deploy did not create Cloud Functions or activate the previously pending public AI sharing backend. Copy/Markdown review packs continue to operate. UI screenshots are in `test-results/pic-toolbar-fixed-vi.png`, `pic-requirement-vi.png`, and the EN/VI/SV matrix/dialog screenshots.
