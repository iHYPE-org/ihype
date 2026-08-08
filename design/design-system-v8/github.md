repo: iHYPE-org/ihype
branch: main
path: (whole repo; design sources at design/design-system-app-shell/ and design/handoff-music-map-me/)

## Last sync
date: 2026-08-07T16:02:00Z
tree: 50ab28ac9801

### Updated in this project
- Audited `main` at tree `50ab28ac9801` — **no new commits** since the morning sync. The drift runs the other way: the shipped app (`src/components/mmm/*`, `src/app/mmm.css`, `src/lib/mmm-nav.ts`, `/app` layout) implements a Music · Map · Me shell this design system never carried. Full table in `SYNC_AUDIT_2026-08-07-overhaul.md`.
- New visual direction ("Bulletin"): ground → ink navy `#0b1220`, ink → cool off-white `#eef1f6`, display Syne → Bricolage Grotesque, body DM Sans → Work Sans. Accent `#ff5029` and the four role hues carried over unchanged. Re-anchored across 86 files.
- Rebuilt `templates/simplified-app/` as the app shell: radial arc nav, no header, no tab bar, map as base layer, MUSIC = Discover · Radio · Charts · Recommended · Playlists, flat ME, persistent universal search on MUSIC.
- Added `components/shell/` — LogoTrigger, ArcNav, PlayerPill, NavHint, MapSheet, ModulePane, Scrim (+ Vignette), each with a `.d.ts` contract.
- Handoff docs for Claude Code: `SYNC_AUDIT_2026-08-07-overhaul.md`, `ADHERENCE.md`, `ROUTE_TEMPLATE_MAP.md`.

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
- 2026-08-07 (earlier) — token layer reconciled against `src/app/globals.css`; AA fix on `--ink-3`; `--role-advertiser` added; motion conflict removed; DJ-role deletion audited.
- 2026-07-23 — v7 template gap-fill and backend-doc sync (payouts "live", not gated).
- 2026-07-20 — 501(c)(3) confirmed, paid ticketing live, `/studio` and `/home` retired.
