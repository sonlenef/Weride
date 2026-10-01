# AI Review Pack delivery — 29 September 2026

## Deployed

Project: weride-discovery. Hosting: https://weride-discovery.web.app/review-packs
Deployed from /Users/sonle/Desktop/weride using explicit Firebase CLI account sonledn98@gmail.com.
Hosting, Firestore rules and indexes deployed successfully on 29 September 2026.
Requirement and matrix entry points, the AI Review Packs page, preview, copy and Markdown download are live.
English/Vietnamese/Swedish interface; English source is preserved in every pack.
Added one protected source-referenced document: workspaces/weride/context/ai-review.
Existing original requirements, team entries, vendor responses and activities were not modified by the upgrade.
Existing Microsoft-only, exact-domain authentication remains unchanged, with no verification-email step.

## Billing blocker — public sharing not yet live

The verified project state is billingEnabled=false. No billing account has been attached by this work.
The Cloud Functions sharing backend is implemented and tested, but not deployed.
The live UI checks service availability and explains the blocker instead of issuing a nonfunctional link.
No public share snapshot has been created or private RFP file published by this rollout.

## Completed test runs

- 42 unit tests: existing access/forms/source fixtures plus pack generation, redaction, scope and provenance.
- 27 Firestore rules tests: existing access/CRUD protections plus private context/share storage restrictions.
- 16 HTTP backend tests: authentication, preview conflicts, SSR/Markdown, expiry, revocation, ownership and input safety.
- 5 repository integration tests against the Firestore emulator: transactions, idempotency, owner isolation and quota.
- 20 browser tests: existing login/CRUD/languages plus scope selection, preview, copying, downloads and mobile review UI.
Total: 110 tests passed across these runs. Synthetic/emulator results are not real Microsoft-account acceptance tests.
Build: TypeScript and Vite succeeded; production assets passed the private-source exclusion check.

## Live verification

`node scripts/smoke-review-hosting.mjs` passed: live build hashes, deep-link login gate,
EN/VI/SV preferences, mobile layout, and anonymous 403 responses for private source/share paths.
See `docs/AI-REVIEW-LIVE-SMOKE.txt` for the exact scope and limitations.
The sharing deployment command was attempted and stopped at its BLAZE_REQUIRED preflight, without provisioning resources.

## Complete public sharing after owner enables Blaze

```sh
cd /Users/sonle/Desktop/weride
npm run deploy:review-sharing -- --account sonledn98@gmail.com
node scripts/smoke-review-hosting.mjs
```

The script creates a dedicated runtime identity, deploys only the review-sharing codebase,
and only then installs `/s/**` and `/api/review-packs/**` Hosting rewrites.
Complete an actual employee acceptance run: preview a permitted scope, create a link,
open HTML and Markdown while signed out, confirm source equality, revoke it, and verify both URLs stop serving content.
Also test short expiry, a stale preview and owner isolation. Do not public-share private source merely for testing.
The maximum-instance setting and creation quota are not a guarantee of zero charges.

## Recovery

Source backups are in `.backups/ai-review-pack-20260929-150312`.
Do not run the one-time installer again over edited code. Restore selected files only after reviewing changes.
The original source PDF remains on disk and is excluded from public Hosting output.
