> Historical rollout record. The email-verification requirement below was superseded by the owner-approved direct Microsoft SSO policy. See DIRECT-MICROSOFT-SSO-2026-09-29.md.

# Microsoft sign-in: email-verification recovery

Project: weride-discovery. Date: 2026-09-29.

## Confirmed code defect
The previous client combined an unexpected sign-in provider, missing/wrong email,
and email_verified != true into one misleading authDenied message and signed out.
It provided no path to verify an otherwise eligible Microsoft user's email.
The actual affected user's Auth record was NOT read: the administrative lookup
was blocked. Do not describe that user's emailVerified value as confirmed.

## Resolution
- Keep the existing Firestore rules and domain/provider/email-verification boundary.
- An unverified Microsoft session at the exact domain stays in a restricted
  verification screen; WorkspaceProvider is never mounted for that state.
- Send a Firebase verification email only after the user's explicit button click.
- Recheck using reload(user) and getIdTokenResult(true), never a local success flag.
- Separate missing-email, domain, provider, stale-session and network errors.
- English, Vietnamese and Swedish UI; resend cooldown; switch-account action.
- No provider secret, access token or real user session is logged or exported.

## Validation
25 unit tests, 17 Firestore emulator tests and 10 browser tests passed.
Four browser cases use synthetic sessions and intercepted endpoints on localhost.
Those tests do NOT establish real mailbox delivery or successful employee SSO.

## Live deployment
Live release checked: expected recovery bundle served, sign-in enabled, no anonymous/preview bypass, Vietnamese preference survives reload, no browser runtime errors, unauthenticated Firestore read returns 403. Real employee email delivery and sign-in still require the user to retry.
