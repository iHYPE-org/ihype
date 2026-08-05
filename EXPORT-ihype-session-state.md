# iHYPE — complete session export

**Generated 2026-08-05. Everything another AI account needs to continue, with no
prior conversation context.**

- Repo: `iHYPE-org/ihype` (ihype.org)
- Working branch: **`claude/design-system-update-ztl119`** (pushed, up to date)
- Base: `main` @ `9957543` (PR #634, already merged and **deployed to production**)
- Unmerged work: 5 commits on the branch above, **CI has not run on them**

Read `HANDOFF-mmm-cutover.md` in the repo root alongside this — it is the working
plan. This file is the wider context that plan assumes.

---

## 1. What iHYPE is, in the terms that constrain the code

A nonprofit live-music platform. Every ticket splits **70% artist / 20% venue /
10% promoter pool / 0% iHYPE**, locked in a founding charter. Constraints that
are not negotiable and appear throughout the codebase:

- **iHYPE's own fee is $0.** Stripe's processing fee (2.9% + $0.30; Amex 3.5% +
  $0.30) is charged by Stripe. Never merge the two into one number, never imply
  iHYPE charges a processing fee.
- **Promoter is not a role.** Any account promotes by sharing a HYPE link and
  earns from the 10% pool. Never add it to a role picker.
- **Audio only.** No video, no live streams.
- **No emoji in the UI.** Unicode glyphs only. Design-system rule.
- **Contact `admin@ihype.org`, domain `ihype.org`.** Nothing else.
- Roles after this work: **Fan · Artist · Venue · Advertiser.** Fan is implicit
  and permanent. DJ is being deleted.

## 2. Infrastructure (already configured — do not reconfigure)

Supabase Postgres behind Cloudflare Hyperdrive; deployed as a Cloudflare Worker
via OpenNext. KV for runtime flags, R2 (`ihype-media`) for media. Admin account
`colinatwood@gmail.com`.

**Every migration in `prisma/migrations/` auto-applies to production on push to
`main`.** There is no manual apply step. A failed migration leaves a
`finished_at IS NULL` row and every later deploy fails with **P3009** — this
happened and production shipped nothing for a day. Recovery is the "Resolve a
failed migration" workflow in the Actions tab. To gate a migration, park it in
`prisma/migrations-pending/`, which Prisma never reads; `npm run guard:migrations`
fails the build if a `@gated` file sits in the live directory.

Do **not** rename `middleware.ts` to `proxy.ts` (Next 16's proxy convention forces
the Node runtime, which OpenNext/Cloudflare rejects). Do **not** apply DDL through
an MCP tool — the Supabase MCP is pinned `read_only=true` for this reason.

## 3. The operator's decisions, 2026-08-05 (verbatim)

> "delete DJ role, it's too complicated. we're going to use radio as a premade
> thing, based on recommendations genres hype and friend suggestion instead.
> should only have lower left logo with MAP MUSIC ME nav, MUSIC with additional 5
> subnav. no header on any page (save screen space). remove cookie consent until
> someone signs up, on their onboarding that's when we should ask about cookies.
> remove previous frontend so there isn't a ghost popping through."

The DJ line is the operator sign-off that `BACKEND_REWRITE.md` §1 and DESIGN_SYNC
row 268(b) were waiting for.

**The one question these instructions do not settle:** removing the header from
logged-out marketing pages (`/`, `/login`, `/register`, `/info`) leaves them with
no navigation but a footer, because MAP/MUSIC/ME are signed-in surfaces. Either
the logo nav needs a logged-out variant or marketing keeps a minimal header.
**Ask before building either.**

## 4. What is already on production (merged, PR #634)

Verified live by HTTP: `/app` 307s to `/app/map`; `/api/map/events` without a
bbox returns 400 `BBOX_REQUIRED`; with a bbox returns 200 `clustered:false`; at
`zoom=2` returns `clustered:true`; `/api/stations` returns all 8 stations.

- Two design bundles vendored: `design/handoff-music-map-me/` (Design System 6)
  and `design/design-system-app-shell/` (the app-shell redesign). **They overlap
  — read `design/design-system-app-shell/HANDOFF_NOTES.md` first**, it has the
  table for which wins on which topic. Short version: the redesign owns the
  chrome (arc nav, 76px solid-accent logo, pill player, MUSIC's tabs, the five
  radio categories, the four roles); DS6 owns the map module and the backend
  migration spec.
- Token layer reconciled. `--role-promoter` was `#ffb84a` — the same amber as
  `--warning` and `--role-advertiser` — and only 8 of its ~28 call sites were
  about promoters. It is now `#ff3e9a` and colours the 10% split slice only; the
  amber sites moved to `--warning`/`--role-advertiser`/`--heat-warm` in the same
  commit, so nothing else changed colour.
- The Music·Map·Me shell at `/app`, with real bbox-bounded map endpoints,
  computed stations, and unit-tested pin de-collision.

## 5. What is on the branch and NOT merged

```
8a208b7 Handoff: add a suggested order, and separate what was verified from what wasn't
29d1cdf Stop new DJ accounts, and write the gated DJ-removal migration
c5643ca Remove the header, the old shells, and the cookie banner from every page
6259a85 Add HANDOFF-mmm-cutover.md
```

Each commit message states what it did and why; `git log main..HEAD` is the
authoritative record. Summary:

- Root layout no longer renders `AdaptiveSiteHeader`, `MobileBottomNav`,
  `AppShell`, `MobileAppShellLoader`, `CookieConsent`. **Unmounted, not hidden** —
  hidden chrome is still focusable and still in the a11y tree.
- `/listen`, `/shows`, `/pages` are redirects into `/app`; `WORKBENCH_PATH` moved
  to `/app/music/discover`. They could not be deleted — the path is baked into
  `?callbackUrl=` in magic-link emails already sent.
- `scripts/guard-claude-design.mjs` rewritten to assert the cutover instead of
  the thing cut over.
- Deleted `e2e/app-shell.spec.ts`, `app-shell-a11y.spec.ts`, `mobile-shell.spec.ts`,
  `module-deck.spec.ts`, `module-deck-responsive.spec.ts` and their allowlist
  entries, the `test:e2e:responsive` script and its CI step.
- `scripts/lighthouse-budget.mjs`: `/shows` dropped, `/listen` → `/app/music/discover`.
- No new DJ accounts possible: `RoleOption` lost `'DJ'`, `/join` lost its tile,
  `POST /api/register` rejects it.
- `prisma/migrations-pending/20260805030000_drop_dj_role/migration.sql` written
  and gated.

## 6. Verified vs not verified

**Verified on the branch:** typecheck, source-policy lint (760 files), 586 unit
tests, `audit:shell --strict`, `guard:design`, `guard:migrations`, production build.

**NOT verified:** nothing on this branch has been opened in a browser since the
header/shell removal. **CI has not run on it.** `e2e/mmm-shell.spec.ts`'s 26 tests
passed two commits earlier, but the layout changed underneath them. The gated
migration has never executed anywhere.

---
## 7. Remaining work, in the order I would do it

1. **Answer the marketing-nav question in §3.** Everything else is mechanical.
2. **Cookie consent at onboarding.** Half done: the banner no longer renders, but
   nothing asks yet. Component is `src/components/CookieConsent.tsx`; storage key
   `ihype_cookie_consent` in `localStorage`; it dispatches
   `ihype:cookie-consent`. **Keep the record and the event** — analytics reads
   them; check with `grep -rn "ihype:cookie-consent\|ihype_cookie_consent" src`.
   Candidate hosts: `/welcome`, `ArtistOnboardingWizard.tsx`, the register flow.
3. **Replace the axe coverage.** `e2e/app-shell-a11y.spec.ts` was deleted with the
   shell it audited and was the only accessibility audit of the signed-in app —
   over *both themes*, which is what originally caught a set of light-theme
   contrast failures. Copy it against `/app/map`, `/app/music/radio`, `/app/me`.
4. **DJ code sweep** — inventory in §9. Largest first. Do NOT start with the
   ad-interjection engine (see the warning there).
5. **The DJ migration** — last. Run the audit in its header, then `git mv` it into
   `prisma/migrations/` in its own commit, together with dropping `DJ` from both
   enums in `prisma/schema.prisma`. Not before: if the schema loses DJ while the
   database still has DJ rows, the client's types stop admitting a value the
   database still returns.

## 8. Traps already paid for — do not rediscover these

1. **A transformed ancestor is the containing block for `position: fixed`.**
   `globals.css` gives `.site-shell > main` `animation: page-enter .4s … both`,
   and `fill-mode: both` holds the transform forever. Any full-screen fixed
   surface inside it collapses to that wrapper's height — 0 when its only child
   is the fixed element. `/app` shipped as a 1280×0 box until `mmm.css` added
   `html.mmm-locked .site-shell > main { transform: none }`. **That override is
   load-bearing; if you remove the `.site-shell` wrapper, check it rather than
   deleting it.**
2. **`notFound()` and `redirect()` cannot set a status code on `/app` routes.**
   The layout is async (auth + a DB read) so the response has flushed; Next
   streams the not-found UI with a 200. `/app`'s redirect lives in
   `next.config.mjs`'s `redirects()` for this reason. Anything needing a real
   status must be decided before render.
3. **`scripts/e2e-workerd.mjs` takes an ALLOWLIST of spec files, not a glob.** A
   new spec does not run in CI until its filename is in `DEFAULT_TEST_SHARDS`. A
   spec that never runs protects nothing while looking green.
4. **The auth cookie's name and `secure` flag are coupled.** The runner always
   sets `PLAYWRIGHT_AUTH_COOKIE_SECURE=true`, so the name is `__Secure-`-prefixed
   and that prefix is illegal without `secure: true`. Use `applySessionCookie()`
   from `e2e/fixtures/session.ts`.
5. **Do not measure an animating element.** The nav fan transitions over `.42s`
   with a per-index delay; `toBeVisible()` resolves the moment opacity lifts, so
   `boundingBox()` samples it mid-flight near the logo. Use `expect.poll`.
6. **`npm audit --omit=dev --audit-level=high` gates CI.** A newly published
   advisory in a transitive production dependency fails every PR until the
   `overrides` entry in `package.json` is bumped.
7. **`freeUseEnabled` is not `radio_eligible`.** `BACKEND_REWRITE.md` §2 says to
   rename `free_use` → `radio_eligible`, but in this codebase
   `ArtistMediaAsset.freeUseEnabled` defaults to **false** and means "opt into the
   DJ free-use crate" — an opt-IN held by a minority. §2 describes an opt-OUT that
   defaults true. Filtering stations on it would empty every station while looking
   compliant. `src/lib/stations.ts` uses the existing published/released/
   discoverable rule instead and documents this at the top. **If the DJ crate goes
   away, decide deliberately what this column now means.**
8. **`/`'s Lighthouse LCP budget is unreliable.** Budget 5200ms; one run sampled
   8212ms then 5367ms — a 2845ms spread against a 167ms breach. If it fails, read
   the `lighthouse-budget-report` artifact before concluding flake *or* regression.
   Do not widen the budget to go green without the operator.
9. **`src/app/shell-surfaces.css` must NOT be deleted.** It aliases 607 class
   names onto nine design-system primitives for the 63 pages that used to live
   inside `AppShell`. Those pages still exist as standalone routes; the file is
   scoped under `.shell-content` and is what stops them unstyling.

## 9. Inventories

### The Music·Map·Me shell (all new, all on production)
  src/app/app/layout.tsx
  src/app/app/map/page.tsx
  src/app/app/me/[panel]/page.tsx
  src/app/app/me/page.tsx
  src/app/app/music/[tab]/page.tsx
  src/components/mmm/MmmMap.tsx
  src/components/mmm/MmmMe.tsx
  src/components/mmm/MmmMusic.tsx
  src/components/mmm/MmmNav.tsx
  src/components/mmm/MmmPlayer.tsx
  src/components/mmm/MmmSheet.tsx
  src/components/mmm/MmmShell.tsx
  src/app/mmm.css
  src/lib/mmm-nav.ts
  src/lib/mmm-me.ts
  src/lib/map-bbox.ts
  src/lib/map-query.ts
  src/lib/stations.ts
  src/app/api/map/artists/route.ts
  src/app/api/map/events/route.ts
  src/app/api/map/venues/route.ts
  src/app/api/stations/[slug]/tracks/route.ts
  src/app/api/stations/route.ts

Plus `e2e/mmm-shell.spec.ts` (26 tests), `src/lib/__tests__/map-bbox.test.ts` (42),
`mmm-nav.test.ts` (27), `mmm-me.test.ts` (6).

### DJ surface still to remove

**Warning before you start:** `src/lib/show-composer.ts`
(`buildResolvedSequence()`) and `src/lib/ad-clip-selection.ts` are the
ad-interjection engine. Together with `ShowSequencePlayer` and
`POST /api/ads/impression` they are what actually spends an advertiser's budget —
the only place self-serve ad campaigns are ever served. Deleting them with DJ
shows silently turns off a revenue path. Decide where audio ads play first.


  prisma/launch-seed.ts
  prisma/migrations-pending/20260805030000_drop_dj_role/migration.sql
  prisma/migrations/0001_init/migration.sql
  prisma/schema.prisma
  prisma/seed.ts
  src/app/admin/page.tsx
  src/app/admin/review/page.tsx
  src/app/admin/verifications/AdminVerificationQueue.tsx
  src/app/api/admin/broadcast/route.ts
  src/app/api/analytics/signup-funnel/route.ts
  src/app/api/artist-media/route.ts
  src/app/api/booking-requests/route.ts
  src/app/api/collab-board/route.ts
  src/app/api/cron/artist-earnings/route.ts
  src/app/api/cron/route.ts
  src/app/api/discover/route.ts
  src/app/api/hype/route.ts
  src/app/api/me/dashboard/route.ts
  src/app/api/me/route.ts
  src/app/api/pages/home/route.ts
  src/app/api/profiles/route.ts
  src/app/api/radio/ad-plan/route.ts
  src/app/api/radio/route.ts
  src/app/api/referral/route.ts
  src/app/api/register/route.ts
  src/app/api/search/route.ts
  src/app/api/shows/[showId]/lineup/route.ts
  src/app/api/shows/route.ts
  src/app/api/stripe/connect/onboard/route.ts
  src/app/api/tour/suggestions/route.ts
  src/app/api/venue-requests/route.ts
  src/app/artists/[slug]/epk/page.tsx
  src/app/artists/verified.rss/route.ts
  src/app/collab-board/page.tsx
  src/app/discover/page.tsx
  src/app/events/new/page.tsx
  src/app/for-djs/page.tsx
  src/app/for-fans/page.tsx
  src/app/globals.css
  src/app/launch/page.tsx
  src/app/payouts/page.tsx
  src/app/promoters/[slug]/analytics/page.tsx
  src/app/promoters/[slug]/dashboard/page.tsx
  src/app/promoters/[slug]/onboarding/page.tsx
  src/app/promoters/[slug]/page.tsx
  src/app/radio/studio/page.tsx
  src/app/register/page.tsx
  src/app/search/page.tsx
  src/app/settings/page.tsx
  src/app/shell-surfaces.css
  src/app/shows/[slug]/cancel/page.tsx
  src/app/sitemap.ts
  src/app/tracks/[hexId]/page.tsx
  src/app/verify/page.tsx
  src/app/welcome/page.tsx
  src/components/AdminBroadcastForm.tsx
  src/components/ListenHome.tsx
  src/components/NavDrawer.tsx
  src/components/PageEditor.tsx
  src/components/PageRoleModules.tsx
  src/components/PagesHome.tsx
  src/components/RecruitingKitPage.tsx
  src/components/SimilarArtistsRow.tsx
  src/components/TrackUploadPanel.tsx
  src/components/VenueBookingInboxTabs.tsx
  src/components/VenueLineupComposer.tsx
  src/components/VerifyForm.tsx
  src/components/payouts/PayoutSettingsPanel.tsx
  src/lib/__tests__/mmm-me.test.ts
  src/lib/__tests__/page-refine.test.ts
  src/lib/__tests__/profile-stats-catalog.test.ts
  src/lib/__tests__/public-location.test.ts
  src/lib/__tests__/role-capabilities.test.ts
  src/lib/app-nav.ts
  src/lib/artist-onboarding.ts
  src/lib/earlyBelievers.ts
  src/lib/i18n/dictionaries/de.json
  src/lib/i18n/dictionaries/en.json
  src/lib/i18n/dictionaries/es.json
  src/lib/i18n/dictionaries/fr.json
  src/lib/i18n/dictionaries/hi.json
  src/lib/i18n/dictionaries/it.json
  src/lib/i18n/dictionaries/ja.json
  src/lib/i18n/dictionaries/ko.json
  src/lib/i18n/dictionaries/pt.json
  src/lib/i18n/dictionaries/zh.json
  src/lib/new-to-scene.ts
  src/lib/page-refine.ts
  src/lib/profile-creation.ts
  src/lib/profile-insights.ts
  src/lib/profile-paths.ts
  src/lib/profile-stats-catalog.ts
  src/lib/public-location.ts
  src/lib/radioStation.ts
  src/lib/recommendations.ts
  src/lib/role-capabilities.ts
  src/lib/shell-account.ts
  src/lib/sounds-like.ts
  src/lib/transparency.ts
  src/lib/venueBooking.ts
  src/lib/weekly-picks.ts

count: 101

## 10. Verification commands

```bash
npm ci
npm run typecheck && npm run lint && npm test
npm run audit:shell -- --strict     # class + colour + undefined-token audit
npm run guard:design                # asserts the cutover, not the old deck
npm run guard:migrations            # fails if a @gated migration is live
npm run build
```

CI additionally runs `node scripts/e2e-workerd.mjs` (authenticated, against a real
workerd instance) and a Lighthouse budget. Neither runs without
`E2E_WORKERD_DATABASE_URL`. The authenticated suite **cannot** pass under
`npm run dev` — `src/lib/db.ts` imports the wasm/workerd Prisma engine on purpose,
so `auth()` throws there and every request 401s.

## 11. Git

```bash
git clone <repo> && cd ihype
git checkout claude/design-system-update-ztl119
git log --oneline main..HEAD          # the 5 unmerged commits
cat HANDOFF-mmm-cutover.md            # the working plan
```

Push with `git push -u origin claude/design-system-update-ztl119`. Do not push to
`main` directly — pushing to `main` deploys to production immediately.
