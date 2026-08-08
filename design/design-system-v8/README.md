# iHYPE Design System v8 — the only design source

Vendored 2026-08-08 from `iHYPE_Design_System_v8.zip`, signed off by the owner as
the final iteration. **It replaces both previous bundles outright**:
`design/design-system-app-shell/` and `design/handoff-music-map-me/` were deleted
in the same commit, so there is no longer a "which bundle wins on which topic"
table to consult and no second copy of any template to drift from.

Read in this order:

| File | Why |
|---|---|
| `ROUTE_TEMPLATE_MAP.md` | Which template governs which route. Start here when a route changes. Its **Removed** section is the list of surfaces the product no longer has. |
| `SHELL_LOCK_2026-08-08.md` | The `/app/*` chrome, locked. `chromeSize = 88` drives the logo trigger, the player height, the nav hint offset and the dock position — change one number and re-derive the rest. |
| `ADHERENCE.md` | 40 rules a reviewer can check mechanically. Rules 23–25 are the ones that have already cost four rounds of false "fixed" reports. |
| `SYNC_AUDIT_2026-08-07-overhaul.md` | What the "Bulletin" direction changed and why, plus the ordered list of what the code had to change. |
| `CLAUDE.md` | Product facts that are not style choices (Stripe-only, $0 iHYPE fee, promoter is not a role). |

## What was deliberately not vendored

The zip is 17 MB; this directory is ~6 MB. Left out, with reasons:

- `_ds_bundle.js` (1.9 MB) and `_ds_manifest.json` — the compiler's own output,
  regenerated on every design change and read by nothing in this repo.
- `uploads/iHYPE/*.dc.html` (4.9 MB) — the **previous generation** of the design,
  two copies of each file (plain and content-hashed). Superseded by `templates/`.
  Vendoring it would re-create exactly the "hidden iteration" this replacement
  exists to end.
- `backups/` (2.6 MB) — dated snapshots of i18n and legal copy from July.
- `lib/i18n-data/` (1.2 MB) — a second copy of the twelve locale dictionaries.
  The live ones are `src/lib/i18n/dictionaries/`.
- `screenshots/`, `explorations/`, `beta/`, `assets/brand/` — presentation and
  exploration material, not a UI contract.

## The two things this bundle does not restate

`tokens/` is the design's own token file, not the app's. The live tokens are
`src/app/globals.css`, which carries ~40 alias names this bundle never mentions
(`--bg`/`--bg-2`/`--ink`, the `--ink-a*` rungs beyond the ones here, the
`--hair-*` rungs beyond these). Re-anchor **values** here; never delete an alias
there.

`tokens/fonts.css` loads Bricolage Grotesque and Work Sans through the CSS2 API.
The app loads them through `next/font/google` in `src/app/layout.tsx` instead —
same families, self-hosted, no third-party request at runtime. Do not add the
`@import` to the app.
