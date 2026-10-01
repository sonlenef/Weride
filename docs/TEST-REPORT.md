# Local acceptance report — 2026-09-29

Project: `/Users/sonle/Desktop/weride` on Sons-MacBook-Pro.local.
Runtime: Node 25.9.0, npm 11.12.0, Java 24, Chromium via Playwright.

## Executed checks
- `npm test`: **10 / 10 passed** (matrix provenance, 30 requirements, 150 proposed items, translations, validation, filtering, hierarchy and CSV escaping).
- `npm run test:rules`: **17 / 17 passed** against the local Firestore emulator (`demo-weride`). Covers authenticated domain/provider/verified-email restrictions, baseline immutability, schema validation, version checks, CRUD, parent boundaries and append-only activity records.
- `npm run test:e2e`: **6 / 6 passed**, final run 7.2 seconds. Covers matrix filtering/export, Q&A CRUD and EN/VI/SV content, nested work-package and assumption CRUD, reload persistence, vendor-response validation, mobile layout and the anonymous production login gate.
- `npm run build`: **passed** (TypeScript + Vite).
- Public-asset inspection: **passed**. No source PDF, private seed fixture, source maps, development seed endpoint or local-preview persistence key in the production bundle.
- `npm audit --omit=dev`: **0 reported vulnerabilities** at the time of this check; this is not a security guarantee or penetration test.
- Desktop and mobile screenshots reviewed; secondary text contrast improved. Screenshots and browser report are in `test-results/` and `playwright-report/`.

## Boundaries and remaining work
- Browser CRUD tests used the explicitly labelled loopback development preview. Preview changes persist in that browser, not in Firebase.
- Firebase Rules tests used synthetic identities in the emulator. They do not prove real Microsoft tenant authentication or production synchronization.
- No approved Firebase project ID or Madison Entra App Registration was provided. Cloud database provisioning, production seeding, Microsoft provider configuration and Hosting deployment have **not** been performed.
- The original RFP PDF remains unchanged. Its source requirements are read-only in the application; seeded collaboration items are working proposals.
- A production build currently reports a non-failing large-JavaScript-chunk warning (approximately 297 KB gzip). Consider code splitting during further performance tuning.
- See `docs/DEPLOYMENT.md` for project selection, single-tenant Microsoft setup, seeding, deployment and mandatory live acceptance tests. Never put the Microsoft client secret in a VITE environment variable.
- See `docs/SECURITY.md` for limitations, including the fact that client-generated activity history is not an independently trustworthy compliance audit trail.

Local development URL: `http://127.0.0.1:5173/?preview=1`.
Production deployment status: **pending configuration; no Hosting URL has been issued**.
