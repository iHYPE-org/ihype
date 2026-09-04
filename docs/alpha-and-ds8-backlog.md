# Alpha prep and the DS8 remodel — the standing backlog

Written 2026-08-14. A session list does not survive a cold start; this does.
Every item here was found by measuring something, and each says what it costs.

## Blocked on the operator (minutes, not hours)

1. **Flip `invite_only_signup` on.** Production accepts anyone who types
   `/register` while the landing page promises request-only access — Sentry
   `JAVASCRIPT-NEXTJS-8`, 583 events from one visitor, and an alpha blocker in
   `buildAlphaBlockers`. It cannot be done from `/admin` right now, because the
   admin allowlist has already clamped the Gmail account to FAN. So:
   `wrangler kv key put --namespace-id b6330641874a4420b240d3a82760a9aa "flags:invite_only_signup" true`
   — or delete the key, since the code default is already `true`.
2. **Claim `admin@ihype.org`.** Confirmed as the only admin address, and
   already the allowlist default, so there is no code change. `ALLOW_ADMIN_SETUP=true`
   + `ADMIN_SETUP_SECRET`, `POST /api/admin/setup`, claim the one-time passkey,
   then set `ALLOW_ADMIN_SETUP=false`. Only decide what to do with the Gmail
   `User` row AFTER that sign-in works — it carries profiles, tickets and hype
   history that do not follow the address.
3. **An external uptime monitor on `/api/health`, and `HEARTBEAT_URL` set.**
   Both have always existed and nothing has ever called either. They are the
   only alarms outside iHYPE — the class that would have caught the P3009
   migration failure that stopped production shipping for a day while three PRs
   merged green. `docs/monitoring.md`.
4. **An `sk_test_` Stripe key.** Unblocks the rehearsal below.
5. **Re-run `npm run seed:preview` against production.** ✅ **Run once, on
   2026-08-16** — and it needs running again, for two reasons found by measuring
   production on 2026-09-04. **(a)** Every seeded show was ticketed with a null
   `ticketingOpensAt`, which means permanently NOT on sale, so all eight
   rendered "Tickets soon" and the purchase route would have answered 409 — the
   whole ticket path unbuyable on the only platform anyone can look at. **(b)**
   The seeder's shows used `update: {}`, so the seed AGED OUT: three weeks on,
   six of the eight had ENDED and the map was down to two pins. Both are fixed
   (DESIGN_SYNC row 344) and a re-run now restores **6 upcoming, 6 on sale** —
   but only a re-run does, because the fix is in the writer and the rows on
   production are already written.
   The original finding, kept because it is what this item is for: measured
   2026-08-16, production held **1 user, 2 profiles, 0 shows, 0 tracks** — so
   `/app/music/discover` said "No seeds waiting", the map had no pins and the
   charts were blank, and all three were *correct*. No page change fixes it;
   there is nothing to render.
   `scripts/seed-preview-content.mjs` was written for exactly this and had
   **never been run** — it was not in `package.json`, which is most of why.
   It now is (`seed:preview`, `seed:preview:remove`). Needs a `DATABASE_URL`
   pointing at production, which no sandbox session has. Everything it writes
   lives under the reserved `preview-` / `@preview.ihype.org` namespace, so
   `npm run seed:preview:remove` takes it all back out again — verified against
   a real Postgres to leave **zero** residue. **Re-run it monthly, or whenever
   the charts look empty:** `/api/charts` only counts hypes from the last seven
   days, and re-running re-dates them.

## The DS8 remodel, in the order that costs least

**1. Stop the legacy shell contradicting DS8** — half a day, chrome only, ~80%
of the visible improvement. Leaving `/app` drops `html.mmm-locked`, and four
things DS8 deleted come back at once: `.site-background` colour orbs,
`.ihype-mobile-nav`, `.site-dock`, and the legacy header with the pre-DS8
raster logo instead of the wordmark. ~50 routes plus `/admin`. Touches no page
content or wiring.

**2. `/info` to the Bulletin layout** — ✅ **done 2026-08-14, DESIGN_SYNC row
285.** Reading measure (99 characters per line → 79), a heading that names the
document rather than the hub (a printed policy named itself nowhere), the
translation notice `templates/legal/` specifies and nothing rendered, and a
real tablist. Two things it turned up for whoever picks up the next item:
**`a7aa5d5`'s 640px measures at 89 characters, not the ~72 that commit
estimated** — /community-rules, /ticket-policy and /copyright want the same
narrowing this got; and **Trust & Safety and Transparency were left alone on
purpose** — they are stat grids from `templates/transparency/` and
`templates/audit/`, a separate job from the four prose documents.

**2b. The 2026-08-14 re-vendor is fully ported** — ✅ **audited 2026-08-16,
DESIGN_SYNC row 286.** `345569e` re-vendored the design system and ported the
MMM chrome; the same export changed 20 other templates, and nobody had checked
those. They are almost entirely design-source hygiene with no code half
(`--role-dj` → `--role-promoter` in 46 places against **0** uses in `src/`, a
component-namespace rename, dead `fan-app/` links, hex → token *inside the
templates*). **Both of `PORT_TO_APP.md`'s explicitly-unverified items came back
clean**: the DJ role is gone from every role picker, and the rigid
`1fr <fixed>px` hero grids it fixed have no counterpart here — the kit pages and
`/shows/[slug]` already collapse via `minmax(0, 1fr)` plus a media query. One
real defect fell out and is fixed: a bare `1fr` track floors at min-content, so
the venue calendar's `nowrap` show titles blew the seven-column grid out to
558px inside a 361px container. **Do not re-derive this from the templates —
read row 286.** The next DS8 item is 3a below.

**3a. The admin console** — ~18 routes behind `AdminShell`. Its template
(`templates/ops-console/`) is one of the ten with zero adherence findings, so
it can be followed faithfully. Do step 1 first; the console improves before a
page is touched.

**3b. ME's four destinations as MMM panes** — the real end state, multi-session.
Settings and Accessibility are forms, not documents. After 1 and 2 this is
optional rather than urgent.

## Blocks faithful DS8 work, and is not fixable here

**Send the template defects to Claude Design.** `npm run audit:design -- --list`.
31 of 41 templates break rules `ADHERENCE.md` itself publishes: 71 emoji (§29),
a DJ role in 7 including full `isDj` variants (§4, deleted from the product),
promoter-as-a-role in 7 (§3), 44 white-on-accent (§32, 3.27:1, fails AA). Fix
them there and re-vendor — a session told to apply a template faithfully will
re-introduce a deleted role and be right to. **`templates/landing/` pitches an
open "Join beta — free" signup while the product is invite-only: translating it
faithfully would REGRESS the homepage.**

## Alpha readiness, code side

- **The money path has never run.** Live Stripe has zero PaymentIntents, zero
  connected accounts, zero balance. `scripts/stripe-payout-rehearsal.mjs` exists
  for exactly this and has never been run. Biggest single risk in the product.
- **The alpha rehearsal is 8 manual steps and `e2e/` covers none of them.** Five
  need no Stripe key, and every one is an idempotency-or-cap test — the worst
  thing to leave to a human and the most expensive to get wrong.
- **The MMM shell has zero i18n** across all 15 files, against 12 shipped
  locales. Fine for a Portland alpha; not fine for beta. Adding keys is safe —
  the parity test only requires an inline English fallback.

## Reported from a phone, not yet reproduced

- **A large gap between the MUSIC controls and the tab content.** Nothing in
  that DOM is tall and the pane is top-aligned. Needs one observation: is the
  gap scrollable (a tall element) or fixed (the pane being sized wrong)?
- **"Me > Settings > Tickets duplicates My Tickets."** No Tickets entry exists
  in the ME panel route or the legacy settings page; the visible "Ticket drops"
  there is a notification preference. Needs to be pointed at.
- **Placeholder content while surfaces are empty.** Asked for twice. Resolved a
  different way, and the difference matters: rather than fabricating rows in the
  UI, `npm run seed:preview` puts **real** rows in the database under a reserved
  namespace, so every surface exercises its real query and a working screen is
  distinguishable from a broken one. Nothing renders fake data, which keeps the
  "every stat is real or an em dash" rule intact. See operator item 5 — it still
  has to be run. If a surface must show something while genuinely empty, the
  original constraint stands: unmistakably examples (greyed, labelled EXAMPLE,
  non-interactive), never anything that could read as real.
