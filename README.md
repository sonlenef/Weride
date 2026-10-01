# WeRide · Discovery Workspace

An internal Madison workspace for the WeRide RFP. React + TypeScript + Vite, Firebase Authentication (Microsoft), Cloud Firestore and Firebase Hosting.

## Run locally

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/?preview=1** to review the complete application locally. This development-only mode stores changes in this browser's localStorage. It is **not** shared Firestore data and is absent from the production build. Reset local test changes in the browser console with `localStorage.removeItem('weride.local-preview.v1')` and reload. The source PDF remains untouched in the project root.

The loopback development server privately serves `private/seed.json` at `/__dev/seed`. Never expose this development server to a network or a tunnel. Do not copy `private/` into `public/` or `dist/`.

## Delivered features

- Project overview, RFP timeline, source clarification flags and clickable logical system landscape.
- 30 immutable RFP requirements: 13 Module A, 11 Module B and 6 Module C; 24 L1 and 6 L2.
- Detail routes, next/previous navigation, search across all languages and discovery notes, module/tier/compliance/status filters.
- Create, edit and delete Q&A, functional work packages, nested tasks, assumptions and nested assumptions. Parent deletion preserves descendants. Confirmation is required before deletion.
- Editable vendor response with original FC / PC / RD / CU / NC codes, comments, hours, cost in EUR/SEK and roadmap date. A code is not pre-selected; CU requires hours and cost, RD requires a date.
- English by default, Vietnamese and Swedish UI and content. The editor stores all three variants independently. Missing translations visibly fall back to English; no external translation API receives your content.
- Shared Firestore listeners, versioned transactions to reject stale edits, attribution and append-only activity history with before/after snapshots. Network failure retains the unsaved editor draft. Production edits pause when offline.
- Microsoft session authentication, exact verified `@madison.dev` provider/domain checks on client and Firestore rules, deny-by-default rules, immutable source data, no unauthenticated baseline access.
- Filtered CSV with formula-injection protection and JSON workspace export. Exports are confidential local downloads.

## Source and editorial boundaries

The baseline is **WERIDE-RFP-2026-Version 3**, supplied as `WeRide Discovery & Vendor RFP Package 2026 1.pdf`. English requirements are transcribed from §3, printed pages 6–11. Vietnamese and Swedish are working translations, not an authoritative replacement for the English source or a legal opinion.

The 150 initial collaboration items are **Madison working proposals**: one unanswered Q&A, three functional breakdown nodes and one unvalidated assumption per requirement. They are not additional source requirements, confirmed answers, effort commitments or contractual interpretations. No compliance code, effort or price is pre-approved.

Two unresolved source discrepancies are displayed rather than silently corrected: the cover submission date differs from §5.0, and §5.4 contains EXP-TAX-01 while §3 contains EXP-DRV-01. The 150-vehicle fleet is an illustrative reference case, not a confirmed operating fleet.

## Cloud setup and deployment

Read **docs/DEPLOYMENT.md**. Production requires an explicitly approved Firebase project/account and a Madison single-tenant Entra application. No unrelated existing Firebase project is selected automatically. No Microsoft client secret belongs in this repository or in a `VITE_*` variable.

```sh
npm run configure -- --project APPROVED_PROJECT_ID --account APPROVED_GOOGLE_ACCOUNT --tenant ENTRA_TENANT_GUID --create-app
npm run seed -- --project APPROVED_PROJECT_ID --account APPROVED_GOOGLE_ACCOUNT
npm test
npm run test:rules
npm run build
npm run test:e2e
npm run deploy -- --account APPROVED_GOOGLE_ACCOUNT --confirm-microsoft
```

The provider, database and single-tenant app must be configured before the above production steps. The deployment script refuses missing/mismatched configuration. It deploys only Firestore rules/indexes and Hosting, not Functions, billing or unrelated services.

## Structure

| Path | Responsibility |
|---|---|
| `src/pages/` | Overview, matrix, requirement detail, system landscape, source notes, activity |
| `src/lib/auth.tsx` | Microsoft authentication and fail-closed membership gate |
| `src/lib/store.tsx` | Firestore subscriptions, transactions, conflicts and local development adapter |
| `src/lib/i18n.ts` | Shared English/Vietnamese/Swedish UI dictionary |
| `private/seed.json` | Private baseline and explicitly labelled proposed work items |
| `scripts/build-fixtures.py` | Reproducible baseline and editorial fixture generation |
| `scripts/seed.mjs` | Administrative, non-destructive create-only Firestore seeding |
| `firestore.rules` | Domain/provider checks and document/schema authorization |
| `tests/` | Unit, Firestore emulator and browser tests |
| `docs/SECURITY.md` | Security model, limits and acceptance checklist |

Use `npm ci` after the lockfile is present. `.npmrc` places npm's cache inside this project because this machine's home `.npm` path is not a directory. It does not modify the machine's global npm configuration.
