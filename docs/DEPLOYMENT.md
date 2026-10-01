# Firebase and Microsoft deployment runbook

> Current deployment: see `docs/CLOUD-DEPLOYMENT-2026-09-29.md`. Hosting/Firestore are live in `weride-discovery`; Microsoft setup is pending. Set `VITE_MICROSOFT_AUTH_READY=true` only after configuring the provider. Use `--locked` for a safe setup-pending deployment.

## 1. Approve the destination

Choose the Firebase project ID and the Google account authorized to administer it. The machine's current Firebase accounts have unrelated projects; do not reuse them by accident. Creating a project or changing its billing is an administrator decision. This repository does not create a new Google Cloud project, enable billing or modify a global CLI account selection.

Record the project owner, support contact, retention requirements and approved Firestore region before provisioning the database. For Swedish client material, ask the owner to approve an appropriate European location; location and data-processing obligations are not inferred from the RFP. Database location is a consequential infrastructure choice.

In Firebase Console, enable Cloud Firestore in production mode (initially deny all) and create a Web App. Ensure Firebase Authentication is initialized. Do not enable anonymous, password or additional identity providers for this internal workspace.

## 2. Register a single-tenant Microsoft Entra application

A Madison Entra administrator must:

1. Register an application named `WeRide Discovery Workspace` with **Accounts in this organizational directory only** (single tenant), in the Madison tenant that owns the verified `madison.dev` domain.
2. Record the Directory (tenant) ID and Application (client) ID. Add a **Web** redirect URI:
   `https://APPROVED_PROJECT_ID.firebaseapp.com/__/auth/handler`
   Use the actual Firebase `authDomain` if it differs.
3. Create a client secret and place its value directly in **Firebase Authentication → Sign-in method → Microsoft** with the application client ID. Enable Microsoft there. Do not send the secret in chat, put it in Git, put it in `.env.local`, or create a `VITE_MICROSOFT_CLIENT_SECRET` variable. Rotate according to the tenant's policy and record expiry privately.
4. Assign approved Madison users/groups in the Entra Enterprise Application and require assignment if organizational policy calls for it. MFA and Conditional Access should remain enforced by the tenant.
5. Review Firebase authorized domains. Include the actual Hosting domains (`PROJECT_ID.web.app` and `PROJECT_ID.firebaseapp.com`) and localhost only where local sign-in testing is approved. Avoid unused domains.

The frontend `tenant` parameter controls the Microsoft sign-in destination. It is **not the authorization boundary**. Single-tenant app registration and server-side Firestore rules are both necessary. Firestore additionally requires an exact-domain email in the signed Firebase token and `firebase.sign_in_provider == 'microsoft.com'`.

No Graph Calendar/Teams/Power BI scopes are requested. The M365 integrations in the RFP are baseline content to discuss, not functions implemented by this discovery workspace.

Official Microsoft/Firebase integration reference:
https://firebase.google.com/docs/auth/web/microsoft-oauth

## 3. Configure the web application

```sh
cd /Users/sonle/Desktop/weride
firebase login:list
npm run configure -- --project APPROVED_PROJECT_ID --account APPROVED_GOOGLE_ACCOUNT --tenant ENTRA_TENANT_GUID --create-app
```

The configure script reads the public Web App configuration from the specified project and writes `.env.local` and `.firebaserc`. `--create-app` only creates a named Firebase Web App within an existing, explicitly chosen project if none exists. If multiple unrelated Web Apps exist, the script refuses ambiguous selection.

The following values are public web identifiers, not Microsoft credentials:

```dotenv
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=APPROVED_PROJECT_ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=APPROVED_PROJECT_ID
VITE_FIREBASE_APP_ID=...
VITE_MICROSOFT_TENANT_ID=MADISON_ENTRA_TENANT_GUID
```

Firebase API keys identify the project; authorization is enforced by Auth and Firestore rules. Never substitute a service-account private key or a Microsoft client secret for these values. Environment changes require rebuilding the frontend.

## 4. Seed private data using an administrator

The administrative Google Cloud Firestore client bypasses Firestore client rules. Use an approved administrator account, not the workspace user's browser. The script uses application default credentials or a short-lived token from the explicit gcloud account; it never prints a token or writes one to source.

```sh
npm run seed -- --project APPROVED_PROJECT_ID --account APPROVED_GOOGLE_ACCOUNT --dry-run
npm run seed -- --project APPROVED_PROJECT_ID --account APPROVED_GOOGLE_ACCOUNT
```

The initial seed creates 181 documents: one project, 30 requirements and 150 proposed work items. It creates only documents that do not already exist, and does not reset reviews or team edits. Partial failure can be safely retried. Do not remove existing records to force a reseed.

The English source and translations live in restricted Firestore, not in Firebase Hosting assets. The source PDF stays on the computer and is not uploaded by these scripts.

## 5. Validate and deploy

```sh
npm test
npm run test:rules
npm run build
npm run test:e2e
npm run deploy -- --account APPROVED_GOOGLE_ACCOUNT --confirm-microsoft
```

`--confirm-microsoft` is an explicit administrator acknowledgment that the single-tenant provider and redirect/authorized domains were configured. It is not an automated validation of Entra configuration. The script builds and deploys Hosting and Firestore rules/indexes in the approved project only. It prints the actual Hosting URL only after Firebase CLI succeeds.

The production asset check fails if source PDF, private seed content, a development seed endpoint or the local preview store leaks into `dist/`. Vite's development-only preview route is removed from the production bundle. Setting `?preview=1` on Hosting must never bypass login.

## 6. Mandatory live acceptance

Emulator and local browser tests cannot prove a real Microsoft tenant or cloud configuration. Before handing out a live link, verify:

- A valid assigned `@madison.dev` employee can sign in; an unassigned or external identity is blocked as configured, and direct Firestore requests from unauthorized tokens are denied.
- The signed Firebase token has the expected exact-domain email and Microsoft provider. `email_verified` can be false or absent: direct Microsoft SSO was explicitly approved by the workspace owner. Never change stored emailVerified flags to simulate verification.
- Two approved users see each other's writes; a stale editor gets a conflict and does not overwrite newer content.
- After sign-out or permission removal, private content is inaccessible. Reauthentication, MFA, provider-secret expiry, popup-blocked redirect fallback and browsers used by the team are tested.
- CRUD for all three entry types survives reload. A parent deletion preserves children. Failed saves retain the draft.
- English is the first-use default; VI/SV labels and edited translations persist. Source English remains accessible and is distinguishable from working translations.
- Hosting deep links work, production has no anonymous preview, and `/private/seed.json` or PDF filenames return no private content.
- The owner has approved the cost controls, retention policy, access list, backup strategy and account/project ownership.

## Troubleshooting

`auth/operation-not-allowed`: enable Microsoft in the correct Firebase project.
`auth/unauthorized-domain`: review Firebase authorized domains.
Redirect mismatch: the Entra Web redirect URI must exactly match the actual Firebase Auth callback, not `/` or the application route.
Permission denied: verify identity claims, exact email domain, deployed rules and document paths. Never switch Firestore to public rules.
Empty workspace: run the administrative seed and verify the selected project ID; no client bootstrap can overwrite the source.
Browser reports configuration missing: fill public environment values and rebuild.
Conflicting edit: close the stale editor after copying needed changes, reload the latest entry and reconcile.

## Direct Microsoft SSO (current policy)
The owner requested removing the separate Firebase email-verification step on 2026-09-29. Deploy BOTH `firestore:rules` and `hosting`; a frontend-only change would still fail cloud reads. The Entra app remains single tenant, the frontend keeps the approved Madison tenant GUID, and Firestore still requires the exact @madison.dev domain and the Microsoft sign-in provider.

Do not send verification emails or modify Auth users' emailVerified field. Existing Microsoft sessions, including those previously stuck at the verification screen, are re-evaluated when the new page loads. Firebase Authentication may retain emailVerified=false; this is expected.

Run `npm test`, `npm run test:rules`, `npm run build`, `npm run test:e2e`, then deploy with the explicit project/account. See `docs/DIRECT-MICROSOFT-SSO-2026-09-29.md` for evidence and test limitations.


## Session lifetime (2026-09-29)
The web application remembers a Microsoft login for up to 24 hours from the signed
Firebase auth_time, on the same browser/origin. Existing SESSION logins are migrated
to LOCAL persistence without restarting the 24-hour clock. Existing sessions older
than 24 hours require Microsoft sign-in again. Mailbox verification is not reintroduced.
Firestore member() checks the same absolute deadline using server time. The sharing
API source enforces it for authenticated management operations as well; public shared
snapshot expiry remains independent. Public sharing is still not deployed on Spark.
On browser restart, clearing site storage, manual sign-out, sleep/resume and multiple
open tabs, run the session regression tests before changing persistence again.
Do not extend sessions by rewriting auth_time or a client-controlled timestamp.
References: https://firebase.google.com/docs/auth/web/auth-state-persistence
and https://firebase.google.com/docs/reference/js/auth.idtokenresult.
