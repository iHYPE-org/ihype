repo: iHYPE-org/ihype
branch: main
path: (whole repo; design sources at design/design-system-app-shell/ and design/handoff-music-map-me/)

## Last sync
date: 2026-08-12T01:06:28Z
tree: 986458737528

### Updated in this project
- Read `src/components/mmm/MmmMusic.tsx`, `src/app/mobile-fit.css` and the `.mmm-tab` block of `src/app/mmm.css` on `main`. **The repo's music subnav is already a link bar semantically** — `<nav className="mmm-tabs">` of `<Link className="mmm-tab">`, tabs as routes not state — so this session's pills→link-bar change is CSS-only.
- Wrote `PORT_TO_APP.md`: an executable change list for landing this session's design changes into the app, keyed to real files. Flags that `.mmm-tab` sits in `mobile-fit.css`'s `min-height:44px` group, where an inline `<a>` silently defeats the floor.
- Added `reference/` — static, runtime-free HTML (app shell, show detail) because `.dc.html` templates and `_ds_bundle.js` cannot render outside the authoring environment. Rewrote `SKILL.md` to lead with what does and does not travel.
- Mobile pass: `manifest.webmanifest`, `MOBILE.md`, four Mobile specimen cards, permission-primer template, app-store review view. Four rigid `1fr <fixed>px` grids made collapsible.


## Screen map
| Design-system artifact | Repo source |
|---|---|
| `tokens/*.css` | `src/app/globals.css` (authoritative for names; values now lead it — see the audit) |
| `components/shell/*` | `src/components/mmm/*`, `src/lib/mmm-nav.ts`, `src/app/mmm.css` |
| `templates/simplified-app/` | `design/design-system-app-shell/templates/simple-app/SimpleApp.dc.html`, `src/app/app/layout.tsx` |
| `templates/auth/` | `design/handoff-music-map-me/Auth.dc.html`, `globals.css` `.authcard-*` |
| `templates/role-settings/` | `design/handoff-music-map-me/RoleSettings.dc.html` |
| `templates/legal/` | `design/handoff-music-map-me/Legal.dc.html` |
| `templates/advertise/`, `templates/advertiser-signup/` | `src/lib/station-breaks.ts`, `/api/ads/impression` |
| `templates/payouts/` | `/me/payout-settings`, `/me/payouts`, `src/lib/show-payouts.ts` |
| `guidelines/*.card.html` | `design/design-system-app-shell/guidelines/` |
| `engineering/`, `openapi.yaml`, `schema.sql` | `design/handoff-music-map-me/BACKEND_REWRITE.md` (authoritative), `current-backend/` |
| full route table | `ROUTE_TEMPLATE_MAP.md` |

## Sync history
- 2026-08-07 (later) — v8 "Bulletin" re-anchor audit; shell drift table in `SYNC_AUDIT_2026-08-07-overhaul.md`.
- 2026-08-07 (earlier) — token layer reconciled against `src/app/globals.css`; AA fix on `--ink-3`; `--role-advertiser` added; motion conflict removed; DJ-role deletion audited.
- 2026-07-23 — v7 template gap-fill and backend-doc sync (payouts "live", not gated).
- 2026-07-20 — 501(c)(3) confirmed, paid ticketing live, `/studio` and `/home` retired.
