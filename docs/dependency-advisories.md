# Dependency advisories: accepted, with reasons

`npm audit` reports the *version* of a package, not whether the vulnerable code
is reachable. That difference matters here, because the only "fix" npm offers
for the finding below is a **downgrade of a build tool** that would put the
mobile CI builds at risk to close a path nothing can walk.

This file records advisories that have been examined and deliberately left
alone, so the next person to see a red `npm audit` can tell "reviewed and
accepted" apart from "nobody has looked".

**Re-check an entry when the parent package publishes a release that bumps the
vulnerable dependency — not on the advisory's schedule, and not with
`--force`.**

---

## `uuid < 11.1.1` via `@capacitor/cli` → `xcode` (moderate, GHSA-w5hq-g745-h8pq)

**Status: accepted. Do not run `npm audit fix --force` for this.**

Reported as:

```
uuid  <11.1.1  — Missing buffer bounds check in v3/v5/v6 when buf is provided
  xcode >=0.9.2
    @capacitor/cli
```

### Why it is not exploitable here

The advisory is specific: `v3`, `v5` and `v6`, **and only when the caller
supplies a `buf` argument**. `xcode` calls exactly one uuid function, with no
buffer:

```js
// node_modules/xcode/lib/pbxProject.js:90
uuid.v4()
```

The vulnerable code path is never entered. `npm audit` cannot see this — it
matches on the installed version, not on which exports are called.

### Where it runs

`@capacitor/cli` is a **devDependency**. It runs during `npx cap sync` on a
developer machine and in the iOS/Android CI jobs, where it rewrites Xcode
`.pbxproj` files. It is not in the Cloudflare Worker, not in the browser
bundle, and not in anything a member downloads. Even if the path were
reachable, the only input to it would be this repository's own project files.

### Why the offered fix is worse than the finding

`npm audit fix --force` installs `@capacitor/cli@8.4.2`. The pinned version is
`^8.5.0`, so that is a **downgrade**, and npm labels it a breaking change.
Every pull request runs iOS and Android debug builds that depend on `cap sync`
working. That trades a working mobile pipeline for no security gain.

### Why not an `overrides` pin either

Forcing `uuid@^11` into the `xcode` subtree looks like the tidy middle path and
is not: it is a v7 → v11 major jump into a CommonJS consumer
(`require('uuid')`), and a break shows up as a failed mobile build rather than
as anything obviously dependency-shaped. Same risk, same absence of benefit.

### When to revisit

When `@capacitor/cli` ships a release whose `xcode` dependency carries
`uuid >= 11.1.1`, take it as a normal upgrade. Until then this is noise, and
the correct action is none.

_Reviewed 2026-08-13 against `@capacitor/cli@8.5.0`, `xcode@3.0.1`,
`uuid@7.0.3`._

---

## `deepmerge-ts < 8.0.0` and `mysql2 < 3.22.0` via `prisma` → `@prisma/config` (high, GHSA-ggr8-5vv4-36mx and GHSA-3f6p-5ww8-9rcr)

**Status: accepted. Do not run `npm audit fix --force` for these.**

Both arrive through the **Prisma CLI** (`prisma@7.10.0`, a devDependency) and
its `@prisma/config` package. Neither is reachable from anything that ships:

- `deepmerge-ts` (stack exhaustion on a deeply nested input) is used by the
  CLI to merge `prisma.config.ts` — a file in this repository, not an input
  anyone else supplies. It runs at `prisma generate` and `prisma migrate
  deploy` time, on a developer machine or a CI runner.
- `mysql2` (authentication downgrade) is a MySQL driver. iHYPE's database is
  PostgreSQL behind Hyperdrive; no code, config or connection string here names
  MySQL, so the driver is never instantiated.

`npm audit --omit=dev` (the check CI runs) reports **0** advisories: nothing in
the Worker or the browser bundle is affected.

### Why the offered fix is worse than the finding

The only fix npm offers is `prisma@6.19.3` — a **downgrade** across a major
version, against 109+ migrations and a `prisma.config.ts` written for Prisma 7.
That trades a working migration pipeline for closing two paths nothing walks.

### When to revisit

When Prisma publishes a 7.x release whose `@prisma/config` carries
`deepmerge-ts >= 8` and `mysql2 >= 3.22`, take it as a normal upgrade.

_Reviewed 2026-09-02 against `prisma@7.10.0`._
