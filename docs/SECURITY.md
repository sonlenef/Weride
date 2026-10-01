# Security model and limits

## Boundaries

The application is an internal requirements-discussion tool, not a production taxi platform, compliance engine or legal certification. No actual passenger trips, payments, driver tax IDs or bank details are collected here.

Firebase Hosting serves an authentication shell and application code. The source PDF, source requirement descriptions, RFP contact and the seed payload are not public static assets. Source data is provisioned administratively into `workspaces/weride` and its `requirements` and `entries` subcollections. References/IDs in the logical diagram are not a full embedded copy of the private source.

Authenticated Firestore access requires all of: a valid Firebase token, token email matching the exact `madison.dev` domain and `firebase.sign_in_provider == microsoft.com`. The Microsoft app must be single tenant in the correct Madison directory. The client repeats these checks for UX; the Firestore rules are the data boundary. Domain hints in OAuth alone are not authorization.

On 2026-09-29 the workspace owner explicitly approved direct Microsoft SSO without a separate Firebase email-verification step. Neither UI nor rules requires `email_verified`. This does not mark a mailbox as verified, modify any Auth user record, or bypass Microsoft MFA/consent. The deployment relies on the approved single-tenant Entra application; do not switch it to multitenant or add personal-account access without redesigning authorization. Email/domain allow rules are not a substitute for an immutable membership/role model when expanding access.

All admitted team members can read Q&A and create their own questions. Q&A updates (including answers) and deletion require the immutable createdBy UID to match the authenticated user, both in Firestore rules and every client mutation path. A matching display name, free-text owner, or PIC assignment grants no ownership. Seeded discovery questions remain read-only to ordinary members. Breakdowns, assumptions and vendor responses retain the existing shared-editor behavior. There is no additional administrator override exposed by the UI. Project/source records are client-read-only. No public or anonymous workspace path is allowed. Adding reviewer/admin roles or inviting non-Madison stakeholders requires a separate explicit authorization design.

Cloud data uses the SDK's in-memory cache, not persistent IndexedDB. Microsoft sessions use Firebase local persistence on the same browser/origin, with an absolute 24-hour access limit from the signed Firebase auth_time. Reloads and token refresh do not extend that deadline. The browser checks on restoration, token changes, a timer and page resume; Firestore independently checks auth_time against request.time. Explicit sign-out clears Firebase persisted credentials and signals other same-origin tabs, including tabs migrated from the previous session-only build. Browser privacy restrictions can fall back to tab-only or in-memory persistence with an on-screen notice. This does not revoke all devices or replace Microsoft tenant policies. The development preview alone stores a local copy in localStorage and is only served on loopback. Clear local preview data on shared computers. Never run the development preview behind a public tunnel.

## Writes and auditability

Entry updates are versioned and performed using Firestore transactions; a stale version is rejected. Parent references are immutable after creation, constrained to the same requirement/kind, and cannot form cycles through normal writes. Deletion removes only the selected entry. Descendants remain visible as roots when a parent is removed.

The application writes the activity snapshot in the same transaction as each mutation. Activity records are append-only under client rules and capture actor, timestamp, before and after. However, client rules do **not** require every low-level API write to include an activity or prove every activity corresponds to a mutation. Administrative SDKs also bypass rules. Therefore this is useful team collaboration history, **not an independently trustworthy or compliance-grade audit log**. Stronger audit guarantees would require server-owned mutation endpoints/events and a separately controlled audit sink.

The UI reads the latest 100 activity events. Firestore retains older events unless an administrator applies a separately approved retention policy. Deleting an entry does not erase its old snapshots. GDPR/data-erasure expectations must account for this; no automatic erasure claim is made.

Schema rules reject unknown fields, malformed locale maps, unbounded strings, invalid kind/status combinations, forged actor IDs, negative/excessive estimates, missing CU estimates and missing RD dates. App-rendered text is escaped by React; no user-authored HTML is executed. CSV formula prefixes are escaped. Exports contain sensitive project data and are created only after workspace access.

## Hosting and credentials

The Hosting configuration supplies CSP, frame restrictions, no-referrer, no-sniff and noindex headers. Authentication popups are permitted. Fonts and illustrations are local/system based; no external analytics, translation service or imagery receives source content.

Microsoft client secrets belong only in the Firebase provider configuration. Service account keys are not required for development and are not shipped. Configure/seed scripts accept an explicit account/project, use short-lived administrative credentials and avoid changing global CLI login selection. The generated `.env.local` has file mode 0600 and is ignored by Git, even though it contains public web config only.

Firebase App Check, custom claims/role administration, centralized error monitoring, backups/PITR, retention automation, SSO lifecycle testing, penetration testing and alerting are not automatically provisioned. Evaluate them before expanding access or moving regulated personal data into this workspace. Dependency audit and test output are point-in-time checks, not a security certification.

## Ownership

Keep private fixture/source data in an access-controlled repository. This project does not push a Git repository or upload to a public source host. The deployment account, project owner, region, budget alerts and production support owner must be approved by Madison.

## General project questions and priorities

The /questions hub reads existing Q&A entries, including project-wide questions with an empty requirementId. Only kind=qa may use this scope; all other collaboration types still need a real requirement. Author-only modification, immutable scope/provenance, valid priority enums and version increments remain enforced by Firestore rules. Existing requirement-specific AI review packs do not include general project discussions; the exporter states this exclusion explicitly. Questions CSV is an authenticated user export and includes author display names.
