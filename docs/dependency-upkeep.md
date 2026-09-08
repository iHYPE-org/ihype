# Weekly upkeep: dependencies, connectors, plugins, actions

A Routine runs this every **Monday 15:00 UTC** in a fresh session. This file is
what it reads, and what a human should read before doing any of it by hand.

Its output is a **report**, not a push. An unattended dependency commit is how a
Monday morning starts red, and the judgement calls below are exactly the part a
lockfile bump cannot make.

_Last full pass: 2026-09-06._

---

## 1. npm dependencies

```bash
npm outdated          # what moved
npm audit             # must stay 0 — see docs/dependency-advisories.md
```

**Take**: anything where `Wanted` equals `Latest` (in-range patch and minor),
via `npm update`.

**Two exact pins `npm update` cannot move, and both have a caret-carrying
sibling.** Leaving either behind splits a pair that must agree:

| Exact pin | Caret sibling | Why it matters |
|---|---|---|
| `next` | `@next/bundle-analyzer` | the analyzer wraps the Next config; a version split is a silent mismatch |
| `@sentry/cloudflare` | `@sentry/nextjs` | the Sentry packages share internals across the worker and the app |

Bump those by hand with `--save-exact`. **A caret next to an exact pin of the
same product is a drift generator — check for the sibling before updating
either.**

**Never read npm's `Latest` column as a target without comparing it to what is
installed.** Two entries here have a `Latest` that is a *downgrade*, and taking
it would be the bug:

- `next-auth` — reads `latest 4.24.15`; this product runs `5.0.0-beta.32`.
- `@types/bcryptjs` — reads `latest 2.4.6`; installed is `3.0.0`.

**Majors and pre-releases are their own change, never part of a sweep:**

- `@simplewebauthn/browser` + `/server` 13 → 14 — a major on the **only** way
  into an account. Needs `e2e/passkey.spec.ts` driven, not a lockfile bump.
- `vitest` + `@vitest/coverage-v8` 4 → 5 — a major under 1,179 tests.
- `typescript` 6 → 7.
- `prisma` 8.x — release candidate at the time of writing, and a major against
  127 migrations and a Prisma 7 `prisma.config.ts`.

### The one with teeth: `maplibre-gl`

`scripts/vendor-maplibre-worker.mjs` copies `maplibre-gl-worker.mjs` and
`maplibre-gl-shared.mjs` out of the package's `dist/` into
`public/vendor/maplibre-gl/`. **A renamed file there is the map going blank for
every member, and nothing in CI can see it** (DESIGN_SYNC row 350: it was blank
for two days while every dependency answered 200). After any maplibre bump:

```bash
rm -rf public/vendor/maplibre-gl && node scripts/vendor-maplibre-worker.mjs
head -c 120 public/vendor/maplibre-gl/maplibre-gl-worker.mjs   # JavaScript, not HTML
npx vitest run src/lib/__tests__/maplibre-worker.test.ts
npm run cf:build && find .open-next -path '*vendor/maplibre-gl*' -name '*.mjs'
```

### Verification before any dependency change is pushed

```bash
npx tsc --noEmit
npx vitest run
npm run lint && npm run guard:design && npm run guard:migrations && npm run guard:ds
npm run audit:css && npm run audit:retro && npm run audit:mounts && npm run audit:routes
npm run cf:build
npm audit
npx cap sync ios && npx cap sync android     # only if anything @capacitor/* moved
```

**Then revert what the tooling regenerates**, or the diff carries noise that
reads as an unrelated change: `cap sync` rewrites three native project files
(`android/app/capacitor.build.gradle`, `android/capacitor.settings.gradle`,
`ios/App/CapApp-SPM/Package.swift`) and `cf:build` restamps `public/sw.js` with
the current commit SHA. CI regenerates all four itself, so the committed copies
being behind is harmless.

---

## 2. claude.ai connectors

Six are installed. Check each is still authorised — a connector that has
silently dropped its auth is a capability this session will discover it lacks
at the worst moment.

| Connector | What it is used for here |
|---|---|
| Stripe | the money path; **live mode only**, so test-mode work runs from the operator's machine |
| Sentry | the only place `log.error` output is read |
| Supabase | production database reads; pinned `read_only=true` |
| Cloudflare Developer Platform | Worker, KV, R2, WAF and Access |
| Resend | outbound email (dead 35 days once without anyone noticing) |
| Anthropic Economic Index | not used by this product |

**Reconnecting is the user's to do, in claude.ai → Settings → Connectors.** A
session cannot run the OAuth flow. Report which need it and stop there.

**A connector reporting `connected` at org level can still be unusable in a
given session** — the session's own token is separate. Report both states rather
than collapsing them.

## 3. Plugins and skills

`ListPlugins` — none installed as of the last pass, so anything appearing is
worth a sentence. `ListSkills` for enabled skills.

## 4. GitHub Actions

All are SHA-pinned, which is the right posture and is why they do not
auto-update. Two actions currently carry **two different SHAs across the
workflows** — `actions/checkout` and `actions/setup-node`. Converging them is a
decision about which release to stand on, not a bump; report the drift, and
resolve a new pin only against a named release tag.

## 5. Backup cadence

`npm run check:backup-cadence` measures the delivered gaps between database
dumps against the documented RPO. The nightly runs it, so the weekly sweep only
needs to read the number — but read it, because it is the one figure here
protecting the only copy of the database outside the live cluster, and it was
wrong by 48% of gaps for at least six days before anything measured it.

**If you edit the backup workflow at all, dispatch it once by hand** (`slot:
manual`, which writes its own key). It is cheap insurance, not a fix for a
known cause — and the reasoning behind it was corrected on 2026-09-08.

**Do not judge a slot missing before about 6 hours.** On 09-07 the 18:37 slot
was written up as a second case of "an edit dropped the tick". It fired, at
**21:44:44 — 3.12 h late**, inside this schedule's own measured band. It had
been called missing at 105 minutes past, while `check:backup-cadence` on the
same screen reported a median delay of 3.47 h and a max of 4.86 h. The data
needed to avoid that mistake was already on the screen.

What is still true: the 09-07 00:xx and 06:xx dumps never ran at all, a
measured **16.70 h gap**. But the 06:xx slot was ~4.7 h after the merge with no
pending tick to drop, so the edit theory does not explain that one either. The
likeliest cause is GitHub skipping runs under load, which its docs allow for.
The :37 move itself does look to have worked (the 12:37 dump landed 21 min
after its slot against a 4.08 h median).

Note also that `check:backup-cadence` **reports** manual dumps but never lets
them clear a verdict. That is deliberate: gaps, delays and the stalled check
ask whether the automation is alive, and a dead schedule propped up by
hand-dispatches must not read healthy.

## 6. Dependabot

Read the alerts. Cross-check `docs/dependency-advisories.md` first: it records
what was examined and what the three standing `overrides` are for, including
which parent release would let each pin be **removed** rather than bumped.
