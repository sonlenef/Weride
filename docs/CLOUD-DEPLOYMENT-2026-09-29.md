# WeRide cloud deployment — 29 September 2026

Status: **Hosting and Firestore deployed; Microsoft SSO setup pending.**
Live URL: https://weride-discovery.web.app
Firebase project: `weride-discovery` (project number `516352227094`).
Deployment account: `sonledn98@gmail.com`, explicitly selected per CLI invocation; global CLI accounts unchanged.
Source directory: `/Users/sonle/Desktop/weride`.

## Provisioned
- Enabled Firestore, Identity Toolkit, Firebase Rules and Firebase Hosting APIs.
- Created the `WeRide Discovery` Firebase Web App and `.firebaserc` / `.env.local` public web configuration.
- Created Firestore `(default)`, Standard edition, `europe-north2` (Stockholm), deletion protection enabled.
- Imported 181 documents: 1 workspace, 30 source requirements, 150 clearly labelled working proposal entries.
- Verified a second seed dry run would create 0 and preserve all 181 existing documents.
- Deployed Firestore rules/index configuration and 4 static Hosting files through Firebase CLI.
- Billing was disabled when inspected. No billing account was linked; no paid upgrade or Cloud Functions were provisioned.

## Verified
- TypeScript/Vite production build succeeds; private PDF and seed files are absent from public assets.
- 10 unit tests + 17 Firestore emulator rule tests + 6 browser E2E tests pass.
- Live Hosting responds HTTP 200 and serves CSP / frame protection headers.
- English is the first-use default; English, Vietnamese and Swedish UI switches and locale persistence work online.
- Production deep links and `?preview=1` remain behind the login gate; no public development preview.
- Live Firestore rejects anonymous workspace/requirements reads and attempted write with HTTP 403 PERMISSION_DENIED.
- Live desktop/mobile smoke tests report no runtime errors or mobile horizontal overflow.
- Results: `docs/LIVE-SMOKE-TEST.txt`; screenshots: `test-results/live-login-*.png`.

## Remaining: Microsoft single sign-on
Identity Toolkit configuration and provider-list reads returned `404 CONFIGURATION_NOT_FOUND`. Enabling the API does not supply an Entra application or OAuth credentials. Real Microsoft login and authenticated collaborative CRUD have **not** been accepted on the live environment.

The deployed build intentionally uses `VITE_MICROSOFT_AUTH_READY=false`. The sign-in button is disabled and a translated setup-pending message is shown. This is a rollout control, not an authorization boundary; Firestore independently enforces verified exact-domain `@madison.dev` email and Microsoft sign-in provider.

A Madison administrator must complete these steps:
1. Initialize Firebase Authentication with Get started in this project, then configure the Microsoft sign-in provider using an Entra application Client ID and Client Secret. Store the secret only in Firebase provider configuration, not chat, source, or any VITE variable.
2. Use a single-tenant Entra application in Madison's directory with the Web redirect URI `https://weride-discovery.firebaseapp.com/__/auth/handler`. Confirm the Hosting domains are authorized in Firebase and required user/group assignments are correct.
3. Set `VITE_MICROSOFT_AUTH_READY=true` in `.env.local`. The existing tenant hint `madison.dev` is supported; a verified tenant GUID can replace it when supplied.
4. Redeploy using the command below, then complete real-account acceptance described in `docs/DEPLOYMENT.md`. Confirm token claims and authorized multi-user CRUD; do not relax the rules to make a failed login pass.

```sh
cd /Users/sonle/Desktop/weride
npm run deploy -- --account sonledn98@gmail.com --confirm-microsoft
```

To redeploy while Microsoft is still pending, leave `VITE_MICROSOFT_AUTH_READY=false` and use:
```sh
npm run deploy -- --account sonledn98@gmail.com --locked
```

The seed script was corrected to use the Google Cloud Firestore client with an in-memory, short-lived token from the explicitly selected gcloud account. No service-account keys were created or downloaded. Existing content is never overwritten by seeding.

References: https://firebase.google.com/docs/auth/web/microsoft-oauth and https://firebase.google.com/docs/cli

Final Hosting refinement: root and deep-link HTML use `Cache-Control: no-cache`; fingerprinted assets retain immutable caching. Both were verified against the final deployed release.
