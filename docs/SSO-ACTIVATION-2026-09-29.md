> Historical rollout record. The email-verification requirement below was superseded by the owner-approved direct Microsoft SSO policy. See DIRECT-MICROSOFT-SSO-2026-09-29.md.

# Microsoft SSO activation — 2026-09-29

Project: `weride-discovery`
Hosting: https://weride-discovery.web.app
Source directory: `/Users/sonle/Desktop/weride`

## Verified configuration
- Firebase Microsoft provider is enabled.
- Client ID matches the supplied App registration: `5cc7c420-2086-4f0f-8032-455ae00a7c33`.
- Madison domain discovery resolves to tenant `fa190090-4fc1-416a-bd41-a480b5dad5b7`.
- Both Firebase Hosting domains are authorized in Firebase Authentication.
- The supplied Entra screenshot shows organization-only account support.
- Provider read used a field mask for name, enabled and clientId; no client secret was requested or logged.
- Updated only the public tenant configuration and `VITE_MICROSOFT_AUTH_READY=true` in local environment settings.

## Deployment and checks
- Firebase CLI deployed Hosting, rules and indexes successfully with the explicit approved project/account.
- Existing Firestore access rules and seeded/team data were not changed.
- Production sign-in button is enabled; the pending-setup notice is removed.
- Clicking sign-in reaches Microsoft with the expected tenant, client ID and Firebase auth callback.
- Preview query cannot bypass authentication; anonymous Firestore reads remain denied.
- Production English/Swedish/Vietnamese UI, locale retention and runtime smoke checks passed.
- 10 unit tests and 6 local browser scenarios passed after configuration activation.
- Detailed smoke results: `docs/SSO-ACTIVATION-SMOKE-TEST.txt`.

## Still requires a real employee login
Consent/MFA, token exchange with the configured secret, verified email claims, and authenticated cloud CRUD are not yet verified. No employee password, MFA approval or OAuth tokens were requested. Do not weaken authorization rules to resolve a login error; inspect the actual error first.
