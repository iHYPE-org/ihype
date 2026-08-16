# design-sync: deliberately NOT run against this repo

Decided 2026-08-16, after `/design-sync` was invoked here. Written down because
the skill is worth hours when it applies, and the check that says it does not
apply takes two minutes — but only if you know to make it.

## The direction is inverted

`design-sync` uploads a component-library repo **to** claude.ai/design, so the
design agent builds with the customer's real components.

iHYPE runs the other way. Claude Design is already the source of truth — see
the top of `CLAUDE.md`: `design/design-system-8/` is a **vendored export** that
this repo consumes, and the sync workflow (`DESIGN_SYNC.md`) is about porting
those exports INTO `src/`. There is nothing here that Claude Design does not
already have a better version of.

## This repo is not a design system anyway

Measured, not assumed:

| precondition | result |
|---|---|
| prior sync state (`.design-sync/config.json`) | none |
| Storybook config / `*.stories.*` | none |
| `dist/` (library build) | none |
| package | `private: true`, no `main` / `module` / `exports` |

It is a Next.js application. The converter would fall through to
`shape = 'package'` and try to bundle `src/components/`, where the majority of
components import `@/lib/db`, `next/headers` or `auth()` — server-side code
that cannot render in the design agent's browser runtime.

## The real reason not to, even if it built

A synced project would be a SECOND design system, made of app components,
standing beside DS8. That is the exact failure `CLAUDE.md` is organised
around: two sources of truth drift, and a later session told to follow the
wrong one "will re-introduce a deleted role and be right to". The 2026-08-11
deletion of `design/design-system-app-shell/` and `design/handoff-music-map-me/`
was the same lesson — history on disk gets read.

## If it is ever revisited

The only version that makes sense is a deliberate, scoped one: extract the
presentational MMM chrome that has no DB or auth imports (the logo trigger,
the player bar, the map chips, the arc nav), give it a real component build,
and sync THAT — so the design agent composes with iHYPE's own parts instead of
generic ones. That is a project, not a command: it needs a build target that
does not exist today, and it needs an answer to how it stays in step with DS8
rather than competing with it.

A first-time sync always creates a NEW project, so running it could not have
damaged the DS8 project. That was checked, and is not the reason it was
skipped.
