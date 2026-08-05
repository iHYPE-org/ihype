# Vendoring notes — iHYPE app-shell redesign / full design system

This directory is the **iHYPE design system bundle** ("app shell redesign",
received 2026-08-05) checked into the repo. It is the second design source
tracked here; the first is `../handoff-music-map-me/` (Design System 6).

## Which source wins

They overlap, and neither is wholly newer. Resolve like this:

| Topic | Authority | Why |
|---|---|---|
| Shell **chrome** — radial arc nav, 76px solid-accent logo, pill player, vignette | **this bundle** (`templates/simple-app/SimpleApp.dc.html`) | It restates all of it, and differently: an arc rather than DS6's vertical pill column, and ME with no fan-out submenu at all. |
| MUSIC tab list | **this bundle** | Search is gone; **Recommended** is new. |
| Radio taxonomy | **this bundle** | Five generated categories — genre, new, local, from others, your history — rather than DS6's eight named stations. They map onto the same five station *kinds*. |
| Roles | **this bundle** | Fan · Artist · Venue · **Advertiser**. No DJ, no Promoter. |
| MAP module — pins, chips, detail sheet, result line, de-collision | **DS6** | This bundle does not restate them. |
| Backend migration spec | **DS6** (`BACKEND_REWRITE.md`) | This bundle's `BACKEND_SPEC.md` is the pre-rewrite contract. |
| `--role-promoter` / `--role-dj` | **DS6** | This bundle's `tokens/colors.css` still carries `--role-dj` and the stale comment "promoters are DJs or Fans". DS6 renamed it and states there is no DJ role; its `FRONTEND_GOTCHAS.md` §7 says outright that the old name is stale wherever it appears. |

Both bundles are internally inconsistent in the same two places, so don't
resolve either from prose alone:

- **Base surfaces.** DS6's README table says base `#0d0b0a` / surface `#16120f`;
  both bundles' `tokens/colors.css` say `#0a0805` / `#100d09`. `globals.css`
  matches the token files, which is the tiebreak used.
- **Light mode.** This bundle's `readme.md` says "Full dark — no light mode",
  while its own `tokens/colors.css` ships a `[data-theme="light"]` block and
  `templates/simple-app` implements a full light theme (`--ih-*`). The repo has a
  shipped, axe-verified light theme; it stays. See DESIGN_SYNC row 268.

## Two rules from this bundle that the code now follows

1. **No emoji, anywhere.** "The UI avoids emoji entirely; expressiveness comes
   from typographic contrast and color." Unicode glyphs (`▶ ❚❚ ♥ ♡ ✕ ◂ ›`) are
   fine; `🔥`/`🎤`/`🏛` are not — DS6 used them and this supersedes it.
2. **Promoter is not a role and has no signup.** Never add it to a role picker.
   Promoter dashboards are views of a fan's built-in activity.

## What was deliberately NOT vendored

- **`uploads/` (46 MB).** Nested duplicates of this same bundle, two and three
  levels deep. Nothing in it is unique.
- **`templates/*/ds-base.js` and `support.js` (3.1 MB).** The prototype runtime
  — `<sc-if>`, `<sc-for>`, `renderVals()`, `dc-import`. The handoff says not to
  reproduce it, so only the `.dc.html` files and their `data.js` are here. That
  is 48 templates in 956 KB rather than 5.2 MB.
- **`lib/i18n-data/` and `lib/i18n.js`.** This repo already ships all 12 locales
  as `src/lib/i18n/dictionaries/*.json` with a parity test, an RTL list and a
  real provider. Same reasoning as the DS6 notes.
- **`beta/`, `screenshots/`, `ui_kits/`.** Marketing and prototype artifacts with
  no production counterpart.

Everything else — `readme.md`, `CLAUDE.md`, `SKILL.md`, `BACKEND_SPEC.md`,
`tokens/`, `guidelines/`, `engineering/`, `components/core/` (the UI-kit
component contracts and their `.prompt.md` briefs), `assets/` — is here
unmodified.

## `tokens/` is reference, not the live token layer

The live tokens are `src/app/globals.css`. `tokens/*.css` here are byte-identical
to DS6's except for the new `breakpoints.css`. The three scales that **cannot**
be reconciled by name — `--radius-lg`, `--ease`, `--duration-slow` — are
documented in `../handoff-music-map-me/HANDOFF_NOTES.md`; that table still
applies.
