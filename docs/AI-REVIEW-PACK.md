# AI Review Pack

## Using the workspace

Open `/review-packs` after Microsoft sign-in, or select **Review with AI** on a requirement or the matrix.
Choose the complete matrix, one module, or one requirement. Matrix search/filter state never silently narrows a pack.
Select Q&A, breakdowns and assumptions; optionally include vendor responses and recorded estimates.
For one requirement, additional requirements can be selected as related context. This is not a confirmed dependency graph.
Inspect the exact preview before exporting. Use **Copy prompt + context** or **Download Markdown**.
Both work without an AI account, external model call, MCP server or sharing backend.
The agent responds outside this application. There are no automatic edits or suggestion imports in this release.

## Contents and source fidelity

The generator is shared by browser and backend (`functions/src/pack.ts`).
Original English is always included; an existing Vietnamese or Swedish translation is added when selected.
The prompt asks for the chosen response language, coverage, source-linked findings, exact proposed changes and open questions.
Each pack includes scope, source references, item IDs, parent IDs, statuses, versions, creation time, SHA-256 and an END marker.
The original RFP baseline stays separate from working proposals and recorded team statuses.
Private RFP context is stored at `workspaces/weride/context/ai-review`, not inside public JavaScript.
Context covers the source delivery tiers, ecosystem, compliance definitions and vendor response instructions.
Known RFP contradictions are preserved. The illustrative 150-vehicle reference is not treated as the verified real fleet.
Private chat history, unsaved meeting notes, signed approvals and unrecorded dependencies are not inferred.
No model is used to summarize or translate source data before export.
Oversized packs fail explicitly rather than dropping content. Use module/requirement scope when necessary.

## Disclosure controls

Structured account/author/owner fields and activity history are excluded. Vendor comments and estimates are off by default.
Email-like strings are redacted, but this is not a complete confidentiality classifier. Free text may still contain names or secrets.
Reviewers must inspect the preview and follow Madison's policies before sending material to any AI provider.
No source PDF or workspace dataset is published merely by deploying this feature.

## Read-only sharing (requires deployed backend)

The creator explicitly acknowledges disclosure, then chooses 1 hour, 24 hours, 7 days or 30 days.
A server transaction captures source data and checks that the reviewed preview has not become stale.
A 256-bit random bearer URL exposes only that snapshot. Anyone holding the URL can read it until expiry/revocation.
`/s/<token>` serves readable HTML without JavaScript or login. `/s/<token>/context.md` serves the same pack as Markdown.
Accept: text/markdown and Markdown downloads are supported. The management API requires a valid Madison Microsoft session.
Creators can list and revoke only their own links. Administrators can intervene through controlled backend administration.
A 20-new-links-per-user-per-day quota and idempotency keys guard against repeated creation.
The public endpoints validate expiry and revocation on every request, with no-store, no-referrer, noindex and restrictive CSP headers.
Untrusted HTML, Markdown links and images are not executed or loaded. No external analytics or scripts are included.
Revoking a link deletes its stored snapshot and owner token, while retaining administrative metadata.
Expiry stops access but does NOT automatically delete stored data; a retention cleanup policy is not provisioned in v1.
Revocation cannot erase copies already saved by a recipient or AI provider.
Bearer URLs can appear in browser history, chat history and infrastructure request logs. Treat them as confidential.

## Security and operations

Microsoft sign-in and the exact `@madison.dev` domain remain mandatory for workspace and management access.
A separate Firebase verification email is NOT required. No account verification flags are changed administratively.
Client Firestore access to share storage is completely denied; the backend validates identity, scope and payload independently.
Runtime IAM is limited to Firestore data access and Firebase Auth read access in this project, but still bypasses client rules.
Runtime: Node 22, europe-west1, 0 minimum / 2 maximum instances. The database remains in Stockholm.
These limits are not a hard monetary cap; review budgets, request logs, abuse controls and retention before wider rollout.
The deployment script never attaches a billing account. It only enables sharing rewrites after a successful function deployment.
