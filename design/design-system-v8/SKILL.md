---
name: ihype-design
description: Use this skill to generate well-branded interfaces and assets for iHYPE, the music fan engagement platform. Contains design guidelines, color/type/spacing tokens, fonts, UI kit components, and 48 real-page templates covering marketing, product, and mobile surfaces.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

Key surfaces:
- **templates/** — 41 grounded `.dc.html` pages (simplified-app, landing, charter, legal, auth, discover, show-detail, profile-page, payouts, booking-inbox, role-dashboard, status, support-tickets, track-detail, and more), each grounded in real `src/app/...` routes from the iHYPE codebase per its template description. `templates/simplified-app/` is the current Music · Map · Me app shell — start there for anything in-app.
- **ui_kits/fan-app/** — Fan-facing app prototype (Listen · Events · Pages tabs, closed-beta gate, mock/live API switch via `window.IHYPE_API_BASE`).
- **engineering/** — `BACKEND_SPEC.md`, `openapi.yaml`, `schema.sql`, `seed_data.json` for developer handoff.

**Payments: Stripe only, live in production.** Paid ticketing shipped 2026-07-19 with a real Stripe Connect account and bank verification; Zeffy is fully retired. Card-processing fees (2.9% + $0.30; AMEX 3.5% + $0.30) are charged by Stripe, never by iHYPE — iHYPE's own fee is $0, locked in the charter's 70/20/10 split. Never merge these into one number.

**Promoter is not a role.** Any Fan or DJ can promote by sharing a HYPE Link/referral code; there's no Promoter signup or account type.

**Tickets are nonrefundable** except via organizer-initiated Event Cancellation (full charter refund to all buyers). Never build a buyer-facing "request a refund" flow.

Core tokens to use: `--bg-base` (#0b1220 ink navy; light theme #f4f6fa), `--accent` (#ff5029), role colors Fan `#b983ff` / Artist `var(--accent)` / Venue `#22e5d4` / Advertiser `#ffb84a` — the four account types. There is no DJ role (deleted 2026-08-06) and no Promoter role. `--role-promoter` (#ff3e9a) colours the 10% pool slice only — it is not an account type. Type: Bricolage Grotesque 800 for display (variable, with an optical-size axis — set `font-variation-settings` rather than scaling one instance), Work Sans for body, JetBrains Mono for eyebrows/metadata, Instrument Serif for editorial pull-quotes (Journal, About).

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

