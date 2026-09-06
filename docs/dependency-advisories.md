# Dependency advisories: fixed, and how

`npm audit` reports the *version* of a package, not whether the vulnerable code
is reachable. For a long time that gap was the whole story here: every finding
arrived through a build tool, the only fix npm offered was a **downgrade**, and
the right action was to record the reasoning and do nothing.

That is no longer true. **As of 2026-09-06 `npm audit` reports 0
vulnerabilities**, at every severity, dev set included. All three findings were
closed by pinning the vulnerable transitive dependency *forward* with
`overrides`, not by taking npm's suggested downgrade.

This file now records what was pinned, what was measured to prove each pin is
safe, and when each pin should be removed again.

---

## What is pinned, and why a pin rather than the offered fix

```jsonc
// package.json
"overrides": {
  "deepmerge-ts": "^8.0.2",   // was 7.1.5, pinned exactly by @prisma/config
  "mysql2": "^3.24.3",        // was 3.15.3, pinned exactly by prisma
  "xcode": { "uuid": "^11.1.1" }  // was 7.0.3, via @capacitor/cli
}
```

| Advisory | Severity | Arrived through | npm's "fix" | What was done |
|---|---|---|---|---|
| GHSA-ggr8-5vv4-36mx `deepmerge-ts < 8` | high | `prisma` → `@prisma/config` | `prisma@6.19.3` | pin `deepmerge-ts@^8.0.2` |
| GHSA-3f6p-5ww8-9rcr `mysql2 < 3.22` | high | `prisma` | `prisma@6.19.3` | pin `mysql2@^3.24.3` |
| GHSA-rgwj-5xj2-c3m3 `mysql2 <= 3.23` | moderate | `prisma` | `prisma@6.19.3` | pin `mysql2@^3.24.3` |
| GHSA-w5hq-g745-h8pq `uuid < 11.1.1` | moderate | `@capacitor/cli` → `xcode` | `@capacitor/cli@8.4.3` | pin `uuid@^11.1.1` in the `xcode` subtree |

Every fix npm offered was a **major-version downgrade of a working build tool**
— Prisma 7 back to 6, against 127 migrations and a `prisma.config.ts` written
for 7; Capacitor 8.5 back to 8.4, against the `cap sync` every mobile CI job
depends on. Each would have traded a working pipeline for closing a path
nothing walks. **`npm audit fix --force` is still the wrong command here.**

Both parents pin their vulnerable dependency to an *exact* version
(`@prisma/config` → `deepmerge-ts@7.1.5`, `prisma` → `mysql2@3.15.3`), so there
is no version of the parent inside its own major line that resolves these. An
override was the only forward-moving option.

---

## Why the earlier reasoning said not to do this, and why it was wrong

Previous revisions of this file argued against exactly these pins. On `uuid`:

> Forcing `uuid@^11` into the `xcode` subtree looks like the tidy middle path
> and is not: it is a v7 → v11 major jump into a CommonJS consumer
> (`require('uuid')`), and a break shows up as a failed mobile build rather
> than as anything obviously dependency-shaped.

The risk was real and the conclusion was still wrong, because **it was a
prediction where a measurement was available**. uuid 11 ships a CJS entry
(`./dist/cjs/index.js`) and still exports `v4`; `xcode` calls `uuid.v4()` and
nothing else. Running it settles in seconds what reasoning about module formats
could only guess at. The same applies to `deepmerge-ts`: v8 kept both the
`deepmerge` export and the dual cjs/mjs shape v7 had.

The general lesson is the one this repository keeps relearning: a dependency
pin's safety is a question you can *drive*, and driving it beats arguing about
it. What follows is what was actually driven.

---

## What was measured before each pin was accepted

Run against `prisma@7.10.0`, `@capacitor/cli@8.5.0`, `xcode@3.0.1`, Node 24.

**`uuid@11.1.1` under `xcode`** — the consumer the old note was afraid of:

- `require('uuid').v4` is a function and returns a v4 string.
- `xcode.project(...).parseSync()` against the repository's **real**
  `ios/App/App.xcodeproj/project.pbxproj`, then `generateUuid()`, returns a
  valid 24-character uppercase-hex pbxproj identifier — the exact call at
  `node_modules/xcode/lib/pbxProject.js:90`.
- `npx cap sync ios` and `npx cap sync android` both complete, finding all
  three Capacitor plugins and rewriting the native projects. This is the
  command every mobile CI job runs.

**`deepmerge-ts@8.0.2` under `@prisma/config`** — the CLI reads
`prisma.config.ts` through it, so every Prisma command is the test:

- `npx prisma validate` loads the config and reports the schema valid.
- `npx prisma generate` produces the client (it also runs as `postinstall`, so
  it passed before anything else was checked).
- `npx prisma migrate deploy` applied **all** migrations to a scratch
  PostgreSQL 17 database from empty. This is the command in
  `deploy-production.yml`, and the one whose failure leaves a `finished_at IS
  NULL` row and blocks every later deploy with P3009 — so it was run for real
  rather than reasoned about.

**`mysql2@3.24.3` under `prisma`** — a patch-line move inside 3.x, and the
driver is never instantiated: the datasource is `provider = "postgresql"`. The
Prisma commands above all pass with it installed.

**The whole tree** — `npm audit` reports 0 vulnerabilities; `npm audit
--omit=dev` reports 0; typecheck, 1,179 unit tests, and all eight fast gates
(`lint`, `guard:design`, `guard:migrations`, `guard:ds`, `audit:css`,
`audit:retro`, `audit:mounts`, `audit:routes`) pass; `npm run cf:build`
produces a Worker.

---

## Two things worth not re-deriving

**`prisma` is a devDependency, and `npm ls --omit=dev` shows it anyway.**
`@prisma/client` (a production dependency) declares `prisma` as a *peer*
dependency, and `npm ls` prints satisfied peers in the tree. So a
`--omit=dev` listing appears to put the Prisma CLI — and `mysql2` under it — in
the production graph, and it is not there: `npm audit --omit=dev` has read 0
throughout. Do not "correct" the devDependency line in this file from that
listing; check `package.json` and `@prisma/client`'s `peerDependencies` first.

**The mysql2 driver does not ship, and grepping the build says otherwise.**
`grep -r mysql2 .open-next/` returns ~26 hits, none of them the driver: they
are `@sentry/instrumentation-mysql2` and a `@effect/sql-mysql2` entry in a
package name list. `.open-next/worker.js` contains **0**, and the driver's own
protocol strings (`mysql_clear_password`, `mysql_native_password`,
`caching_sha2_password`) are absent from the build entirely. Measure the
driver, not its name.

---

## When to remove these pins

An `overrides` entry is a standing liability: it holds a transitive dependency
at a version its parent never tested against, and it keeps doing so silently
after the reason has gone away.

Remove each pin — do not just bump it — when the parent ships the fix itself:

- `deepmerge-ts` and `mysql2`: when a Prisma **7.x** release carries
  `@prisma/config` with `deepmerge-ts >= 8` and `mysql2 > 3.23.0`. (Prisma 8 is
  in release candidate at the time of writing; the 8.x upgrade is its own piece
  of work and not a way to close these.)
- `uuid`: when `@capacitor/cli` ships a release whose `xcode` dependency
  carries `uuid >= 11.1.1`.

Check with `npm ls deepmerge-ts mysql2 uuid --all` after dropping the entry: if
the resolved versions are still at or above the fixed ones without the
override, the pin is dead weight and should go.

---

## Why CI still audits production dependencies only

`ci.yml` and `nightly.yml` run `npm audit --omit=dev --audit-level=high`, and
that stays as it is even though the full audit is currently clean. A gate over
the dev set would go red the next time a build tool picks up an advisory whose
only fix is a downgrade — which is the situation this file existed to document
for the previous four months — and a check that cannot be cleared by anyone
working in this repository is a wall in front of the instruments, not a gate.
The full `npm audit` being 0 is a fact to keep true by maintenance, not by
CI enforcement.

_Fixed and verified 2026-09-06 against `prisma@7.10.0`, `@prisma/config@7.10.0`,
`@capacitor/cli@8.5.0`, `xcode@3.0.1`, Node 24._
