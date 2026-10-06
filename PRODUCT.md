# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Madison's internal delivery team (BA, PM, developers, UI/UX) signed in with Microsoft `@madison.dev` accounts. They work through the WeRide RFP discovery together: they review requirements, raise and answer questions, record decisions, and catch up on how the planned WeRide platform is shaped (actors, modules, capabilities).

## Product Purpose

WeRide Discovery Workspace is the shared place where Madison turns the WeRide RFP (WERIDE-RFP-2026-Version 3) and the follow-up handover context into a reviewed, traceable understanding of scope. It succeeds when anyone on the team can find out what is required, what is still assumed, and what still needs clarification, without having to read the source documents end to end.

## Positioning

The workspace keeps the immutable RFP baseline separate from Madison's working proposals and assumptions, and labels which is which. Every collaboration item is attributed and versioned.

## Operating Context

- Source material: the RFP PDF (30 requirements across modules A/B/C, tiers L1/L2) and the WeRide master project context handover (6 actors, 14 high-level modules, all working assumptions).
- Team rituals: requirement review, Q&A threads with PIC assignment, client questionnaires, AI review packs, and decision records.
- The UI is available in English, Vietnamese and Swedish. Vietnamese and Swedish are working translations; the English source stays authoritative.

## Capabilities and Constraints

- React, TypeScript and Vite, with Firebase Auth (Microsoft, single tenant), Firestore and Hosting.
- Source data is private and must never ship in public bundles (`scripts/check-bundle.mjs` enforces this).
- There is a loopback-only local preview at `?preview=1`.
- Actor/module content from the handover is a working assumption, not confirmed scope. The UI must not present it as contractual.

## Evidence on Hand

- `WeRide Discovery & Vendor RFP Package 2026 1.pdf` and `private/seed.json` (the baseline and the proposed work items).
- The handover's actor/module mapping lives in `src/lib/product-tree.ts`.
- There are no customer testimonials, metrics or pricing, and none may be invented.

## Product Principles

- Never blur source requirements with assumptions; label the confidence of every item.
- Help the team catch up fast: structure first, detail on demand.
- Lean over complete: no speculative features or over-engineering.
- Every language is a first-class reading experience, not an afterthought.

## Accessibility & Inclusion

Keyboard operability, visible focus, reduced-motion support, and no horizontal scroll at phone width are existing standards in this app.
