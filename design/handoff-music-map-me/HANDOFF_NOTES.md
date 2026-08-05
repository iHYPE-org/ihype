# Vendoring notes — iHYPE Design System 6 / "Music · Map · Me"

This directory is the **verbatim design handoff** as delivered (2026-08-04), checked
into the repo so a cold session has the design source of truth on disk rather than
having to be re-sent a zip. See `DESIGN_SYNC.md` row 267 for what has and has not
been implemented.

`README.md` is the handoff's own front door. `BACKEND_REWRITE.md` is its authoritative
migration spec. `FRONTEND_GOTCHAS.md` is a list of bugs already found in the prototype
and is worth reading **before** building the shell, not after.

## Read the .dc.html files as references, not as code

The handoff says this itself and it bears repeating: the `.dc.html` files are authored
in a bespoke prototyping runtime (`<sc-if>`, `<sc-for>`, `{{ hole }}`, `renderVals()`).
That runtime must not be reproduced. Read them for layout, exact values, copy and
interaction logic; rebuild in Next.js using this codebase's patterns.

## What was deliberately NOT vendored

- **`lib/i18n-data/*.js` (11 locales, ~1.4 MB) and `lib/i18n.js`.** This repo already
  ships all 12 locales as `src/lib/i18n/dictionaries/*.json`, with a parity test
  (`src/lib/__tests__/i18n-parity.test.ts`), an RTL list and a real provider
  (`src/components/I18nProvider.tsx`). The handoff's own instruction is to *reuse* the
  translation data rather than re-translate, and this codebase already does — carrying
  a second copy in the prototype's format would be 1.4 MB of drift waiting to happen.
  `FRONTEND_GOTCHAS.md` §6 also says the loader's path-sniffing should not survive into
  production, which is the only thing `lib/i18n.js` contains.
- **Nothing else.** Every document, `.dc.html`, token file and the `current-backend/`
  contract snapshot are here unmodified.

## `tokens/` is the design system's copy, not this app's

`tokens/*.css` are reference values. The live token layer is `src/app/globals.css`.
They agree on colour, but three of the scales **cannot** be reconciled by name and the
differences are silent if you assume otherwise:

| Token | This codebase | Handoff | Why they differ |
|---|---|---|---|
| `--radius-lg` | 18px | 10px | 19 live call sites depend on 18px. Use literal px from the handoff's radius table for new Music/Map/Me surfaces. |
| `--ease` | `cubic-bezier(.4,0,.2,1)` | `cubic-bezier(.2,.7,.3,1)` in `spacing.css` | The handoff contradicts *itself* here — `motion.css` has no `--ease`. Live on hundreds of transitions, so it keeps its value; `--ease-default` is the aliased name. |
| `--duration-slow` | 480ms | 480ms (`motion.css`) / 300ms (`spacing.css`) | Same internal contradiction. `motion.css` wins. |

`--space-*` **was** aligned to the handoff's px scale, because nothing referenced any
rung — see the comment on that block in `globals.css`.

`tokens/colors.css` also carries a `[data-theme="light"]` block labelled "Phase 1
pilot" that darkens the brand fills. That has **not** been adopted; the reasoning is in
`globals.css` next to the light-theme block and the open question is in DESIGN_SYNC row
267.
