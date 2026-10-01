# Direct Microsoft SSO — 2026-09-29

## Owner-approved change
The owner explicitly requested removing the additional Firebase mailbox verification step.
Microsoft sign-in with a signed Firebase token containing an exact @madison.dev email is now sufficient for workspace access.
The frontend still checks the Microsoft provider, exact email domain and consistency between user email and token email.
Firestore independently requires authentication, exact domain and the Microsoft sign-in provider.
The approved single-tenant Entra app and Madison tenant configuration remain unchanged.
No emailVerified values, Microsoft secrets, billing settings or workspace content were changed.

## Changes
Removed verification recovery state, component, email-send/refresh actions and EN/VI/SV copy.
Removed email_verified as an authorization requirement in Firestore rules, not just in the UI.
Updated current security/deployment guidance and marked historical recovery notes superseded.
Rollback sources are stored under .backups/direct-microsoft-20260929-135426/.

## Evidence
Preflight read confirmed the requested account is active, uses microsoft.com, and has emailVerified=false; no user record was modified.
25 unit tests, 23 Firestore-emulator security tests and 14 Playwright browser tests passed (62 total).
Tests accept false or absent verification claims while rejecting foreign domains, suffix attacks, anonymous access and other providers.
Firebase CLI deployed Hosting and Firestore rules successfully to weride-discovery.
Live rules exactly match the tested source: SHA256 f8b1e142f5e20848c35c170f3e64528b5d0eb570059d0a619c4db2f52c5b57f3.
Live Hosting serves the new bundle; anonymous Firestore access remains HTTP 403.
The real login button routes to the approved Microsoft tenant, client ID and Firebase callback; no employee credentials were submitted.
Fresh-page EN/VI/SV, mobile layout and locale persistence checks passed. A combined smoke test initially timed out waiting for synthetic popup cancellation, so localization was retested on a fresh page.
Authenticated browser tests use local synthetic sessions with intercepted network calls; server CRUD tests use the emulator. Live employee sign-in and CRUD still require the owner to reload and use the workspace.

Production URL: https://weride-discovery.web.app
