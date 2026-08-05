# Handoff — Music/Map/Me cutover, DJ removal, chrome removal

**Written 2026-08-05. Branch: `claude/design-system-update-ztl119`. Base: `main` @ `9957543`.**

This file exists so the work can be finished by someone (or something) else with no
prior context. It records the operator's decisions, what is already done, what is
left, and the traps found the hard way. Delete it once the work lands.

---

## The operator's decisions (2026-08-05)

Quoted, because several reverse things the codebase currently documents as open:

1. **"delete DJ role, it's too complicated."** This is the operator sign-off that
   `BACKEND_REWRITE.md` §1 and DESIGN_SYNC row 268 (b) were waiting for.
2. **"we're going to use radio as a premade thing, based on recommendations
   genres hype and friend suggestion instead."** Already built — `/api/stations`
   computes exactly these five kinds. DJ-hosted radio goes away.
3. **"should only have lower left logo with MAP MUSIC ME nav, MUSIC with
   additional 5 subnav."** Already built at `/app`. This makes it the *only* nav.
4. **"no header on any page (save screen space)."**
5. **"remove cookie consent until someone signs up, on their onboarding that's
   when we should ask about cookies."**
6. **"remove previous frontend so there isn't a ghost popping through."**

### One thing to raise before finishing #4

Removing the header from **marketing/logged-out** pages (`/`, `/login`,
`/register`, `/info`) leaves those pages with no navigation but the footer. The
MAP/MUSIC/ME logo nav is a signed-in surface — MAP and MUSIC require auth. Either
the logo nav needs a logged-out variant (e.g. MAP → `/discover`, MUSIC →
`/login`, ME → `/login`), or marketing keeps a minimal header. **Confirm with the
operator.** Current state of this branch: see "Status" below.

---

## Status

| # | Task | State |
|---|---|---|
| 1 | Remove global header | see git log |
| 2 | Cookie consent → onboarding only | see git log |
| 3 | Remove old frontend chrome (ghost) | see git log |
| 4 | Route the signed-in app at `/app` only | see git log |
| 5 | DJ role removal — code | see git log |
| 6 | DJ role removal — schema migration | **gated, see below** |

`git log --oneline main..HEAD` is the authoritative record. Each commit message
states what it did and why.

---

## Task 1 — no header anywhere

`src/app/layout.tsx` renders, unconditionally, outside `AppShell`:

- `AdaptiveSiteHeader` — the marketing/site header
- `MobileBottomNav` (`.ihype-mobile-nav`)
- `SitePlayerDock` (`.site-dock`)
- `SiteFooter` (passed into `AppShell` as its `footer` prop)
- `CookieConsent`

`src/app/mmm.css` already stands all of these down on `/app/*` via
`html.mmm-locked … { display: none !important }`. **That is a patch, not the
fix the operator asked for.** The fix is to stop rendering them.

---

## Task 2 — cookie consent moves to onboarding

- Component: `src/components/CookieConsent.tsx`, storage key
  `ihype_cookie_consent` in `localStorage`, dispatches
  `window.dispatchEvent(new CustomEvent('ihype:cookie-consent', …))`.
- **Why it must move, beyond the operator's ask:** the banner is pinned to the
  bottom of the viewport, which is where the MMM shell puts its logo trigger and
  fan. At phone width it intercepts every pointer event aimed at the nav — a
  first-time visitor cannot open the navigation. Confirmed in CI: Playwright
  burned 55 click retries on "`<div role=dialog class=ihype-cookie-consent>`
  subtree intercepts pointer events".
- Onboarding surfaces that could host the prompt: `/welcome`,
  `src/components/ArtistOnboardingWizard.tsx`, and the register flow.
- **Keep the consent record itself.** Removing the banner must not remove the
  stored preference or the event — analytics reads it. Check consumers with
  `grep -rn "ihype:cookie-consent\|ihype_cookie_consent" src`.
- `e2e/mmm-shell.spec.ts` pre-seeds the key in `signIn()`; once the banner no
  longer renders for signed-out visitors that seeding is harmless but can go.

---

## Task 3/4 — remove the old frontend

Three shells currently exist. All but MMM should go:

| Shell | Where | Notes |
|---|---|---|
| `AppShell` | `src/components/shell/*`, mounted in root layout | 82px header + 52px strip + drawer. **16 e2e tests in `e2e/app-shell.spec.ts` + 14 in `e2e/app-shell-a11y.spec.ts` assert its contract — those specs must be deleted with it, not left failing.** Both are in the runner allowlist (below). |
| `MobileAppShell` | `src/components/MobileAppShellLoader.tsx`, `src/lib/MobileShellContext.tsx` | Swipe carousel at ≤768px on `/listen`, `/shows`, `/pages`. `e2e/mobile-shell.spec.ts`. |
| Module deck | `src/app/ui-preview/ModuleDeckMockup.tsx` (2918 lines), rendered by `/listen` | `e2e/module-deck.spec.ts`, `e2e/module-deck-responsive.spec.ts`. `scripts/guard-claude-design.mjs` **asserts `/listen` is the canonical deck — it will fail the build until updated.** |

Routes that should redirect into `/app`: `/listen` → `/app/music/discover`,
`/shows` → `/app/map`, `/pages` → `/app/me`, `/radio` → `/app/music/radio`.

`src/app/shell-surfaces.css` (607 class names aliased onto nine primitives) and
`npm run audit:shell` exist for the 63 pages *inside* `AppShell`. Those pages
still exist as standalone routes, so **do not delete `shell-surfaces.css`** — it
is scoped under `.shell-content` and is what stops those pages from unstyling.

---

## Task 5/6 — DJ role removal

**91 files** match `'DJ'|"DJ"|role-dj|/djs/|promoters/`. Get the live list with:

```
grep -rln "'DJ'\|\"DJ\"\|ProfileType.DJ\|role-dj\|isDj\|/djs/" src
```

### Schema (Prisma)

`prisma/schema.prisma` has `DJ` in **two enums** (lines ~13 and ~29 — `Role` and
`ProfileType`). Postgres cannot remove an enum value in place.

**Data safety — do this first, it is not optional:**

```sql
SELECT type, count(*) FROM "Profile" GROUP BY type;
SELECT role, count(*) FROM "User" GROUP BY role;
```

`BACKEND_REWRITE.md` §1 says reassign DJs to artist and consider resetting
verification, because a DJ who never uploaded a track should not silently inherit
artist verification standing. **Reassign, never delete** — `Profile` rows cascade
to media, shows, payouts and tickets.

**The migration MUST be parked in `prisma/migrations-pending/`,** not
`prisma/migrations/`. Every migration in `prisma/migrations/` auto-applies on
push to `main` — there is no manual gate. `npm run guard:migrations` fails the
build if a `@gated` migration sits in the live directory. Moving it across is a
deliberate `git mv` in its own commit. See `prisma/migrations-pending/README.md`.

**A failed migration blocks every production deploy** (P3009) — this happened
before and shipped nothing for a day. Recovery is the "Resolve a failed
migration" workflow in the Actions tab.

### Code surfaces

- Routes: `src/app/djs/[slug]` (alias), `src/app/promoters/[slug]` + its
  `dashboard`/`analytics`/`onboarding`, `src/app/for-djs`, `src/app/radio`
  (DJ radio management).
- Components: `RadioShowCreator.tsx`, `ShowSequencePlayer.tsx`, `DJKit`,
  `PageRoleModules.tsx` (DJ branch), `NavDrawer.tsx`, `AdminShell` subnav.
- Lib: `src/lib/show-composer.ts` (`buildResolvedSequence`, the ad-interjection
  engine), `src/lib/ad-clip-selection.ts`, `src/app/api/radio/ad-clips`,
  `src/app/api/shows` (`radioShows` filter), `src/lib/app-nav.ts` (`'DJ'` gate).
- Tokens: `--role-dj` in `globals.css` is already a deprecated alias of
  `--role-promoter`; delete it once its ~7 call sites go.

### The trap in the radio rewrite

`BACKEND_REWRITE.md` §2 says `ALTER TABLE tracks RENAME COLUMN free_use TO
radio_eligible`. **In this codebase that is not a rename.**
`ArtistMediaAsset.freeUseEnabled` defaults to **false** and means "opt into the DJ
free-use crate" — an opt-IN held by a small minority. §2 describes an opt-OUT that
defaults true. Filtering stations on it would empty every station while looking
compliant. `src/lib/stations.ts` therefore uses the existing
published/released/discoverable rule and documents this at the top. If the DJ
crate goes away, decide deliberately what `freeUseEnabled` now means.

---

## Traps already paid for — do not rediscover these

1. **A transformed ancestor is the containing block for `position: fixed`.**
   `globals.css` gives `.site-shell > main` `animation: page-enter .4s … both`,
   and `fill-mode: both` holds the transform forever. Any full-screen fixed
   surface inside `.site-shell > main` collapses to that wrapper's height — which
   is 0 when its only child is the fixed element. `/app` shipped as a 1280×0 box
   until `mmm.css` added `html.mmm-locked .site-shell > main { transform: none }`.
   **If you remove the `.site-shell` wrapper entirely, that override becomes dead
   — check it, don't just delete it.**
2. **`notFound()` and `redirect()` cannot set a status code on `/app` routes.**
   The layout is async (auth + a DB read) so the response has already flushed;
   Next streams the not-found UI with a 200. `/app`'s redirect lives in
   `next.config.mjs`'s `redirects()` for this reason. Anything needing a real
   status must be decided before render.
3. **`scripts/e2e-workerd.mjs` takes an ALLOWLIST of spec files, not a glob.** A
   new spec does not run in CI until its filename is added to
   `DEFAULT_TEST_SHARDS`. A spec that never executes protects nothing while
   looking green.
4. **The auth cookie's name and `secure` flag are coupled.** With
   `PLAYWRIGHT_AUTH_COOKIE_SECURE=true` (which the runner always sets) the name
   is `__Secure-`-prefixed, and that prefix is illegal without `secure: true`.
   Use `applySessionCookie()` from `e2e/fixtures/session.ts`; it pairs them.
5. **Don't measure an animating element.** The fan transitions over `.42s` with a
   per-index delay; `toBeVisible()` resolves the moment opacity lifts. Use
   `expect.poll`.
6. **`npm audit --omit=dev --audit-level=high` gates CI.** A newly published
   advisory in a transitive prod dep fails every PR until the override is bumped.
7. **Do not rename `middleware.ts` to `proxy.ts`** — Next 16's proxy convention
   forces the Node runtime, which OpenNext/Cloudflare rejects.

---

## Verification the work must pass

```
npm run typecheck && npm run lint && npm test
npm run audit:shell -- --strict
npm run guard:migrations
node scripts/guard-claude-design.mjs      # will need updating for the cutover
npm run build
```

CI additionally runs the authenticated Workerd suite
(`node scripts/e2e-workerd.mjs`) and a Lighthouse budget. Neither can run in a
sandbox without `E2E_WORKERD_DATABASE_URL`.

**Known-marginal gate:** `/`'s LCP budget is 5200ms and the two samples in one
recent run were 8212ms and 5367ms — a 2845ms spread against a 167ms breach. If it
fails, read the `lighthouse-budget-report` artifact before assuming either flake
or regression. Do not widen the budget to go green without the operator.

---

## Design source of truth

Both bundles are vendored and they overlap. Read
`design/design-system-app-shell/HANDOFF_NOTES.md` first — it has the table for
which wins on which topic. Short version: `design-system-app-shell/` owns the
chrome (arc nav, 76px solid-accent logo, pill player, MUSIC's tabs, the five radio
categories, the four roles); `handoff-music-map-me/` owns the map module and the
backend migration spec.

Two rules from the redesign the code follows: **no emoji anywhere** (Unicode
glyphs only), and **promoter is not a role** — never put it in a role picker.
