repo: iHYPE-org/ihype
branch: main
path: (whole repo; design sources at design/design-system-8/ and design/console-2026-08/)

## Last sync
date: 2026-08-21T20:28:00Z

### Updated in this project
- Audited the subpage surfaces and built four retro console templates from the real sources rather than from memory: `templates/console-settings/`, `templates/console-info/`, `templates/console-ticket/`, `templates/console-profile/`.
- Section, row and tab sets lifted verbatim where they are specified upstream: `MmmSettings.tsx` (payout/payment, profile, 7 notification prefs + push, passkeys, privacy, invite, danger zone), `mmm-me-panels.ts` (the six Info rows, Support first), `profile-tabs.ts` (fixed Artist/Venue tab sets with empty states, not hidden tabs), and the ticket page's stat set.
- Confirmed upstream already replaced profile tab strips with `TunerDial` (`ProfileTabs.tsx`) — the console direction and the shipped app agree on that control, so both new tabbed templates mount it instead of a strip.
- Ticket money is shown as face value, Stripe processing, and total as three separate figures; no member-facing refund path exists on any of these screens.
- Confirmed our console (walnut/brass/cream) direction matches upstream's `design/console-2026-08/HANDOFF.md` and `DIRECTION.md` verbatim — same token values, same `.walnut-panel`/`.tuner-dial`/`.mmm-console` CSS, same accent-as-copy trap fix. No changes needed on that front.
- Vendored the 2026-08-11 mobile pass, missed until now: `MOBILE.md`, 4 `guidelines/mobile-*.card.html` cards, and `--pane-pad`/`--chrome-l`/`--chrome-r`/`--player-l` tokens — re-pointed to this project's console palette (cream/walnut/brass) instead of upstream's navy.
- Noted but not acted on: upstream restructured `design/design-system-app-shell/` → `design/design-system-8/` (renames only) and added `design/DRIFT_AUDIT_2026-08-10.md`, which documents the *shipped app* diverging from the design system (ArcNav two-level nav, missing PlayerPill props, map controls) — those are implementation gaps in `src/`, not design-system changes; nothing here needs fixing for them.

## Screen map
| Design-system artifact | Repo source |
|---|---|
| `tokens/*.css`, `tokens/console.css` | `design/console-2026-08/HANDOFF.md`, `DIRECTION.md` |
| `components/shell/*` | `design/design-system-8/components/shell/*` |
| `MOBILE.md`, `guidelines/mobile-*.card.html` | `design/design-system-8/MOBILE.md`, `design/design-system-8/guidelines/mobile-*.card.html` |
| `templates/simplified-app/` | `design/design-system-8/templates/simplified-app/`, `src/app/app/layout.tsx` |
| `templates/auth/` | `design/design-system-8/templates/auth/Auth.dc.html` |
| `templates/role-settings/` | `design/design-system-8/templates/role-settings/RoleSettings.dc.html` |
| `templates/legal/` | `design/design-system-8/templates/legal/Legal.dc.html` |
| `templates/advertise/`, `templates/advertiser-signup/` | `src/lib/station-breaks.ts`, `/api/ads/impression` |
| `templates/payouts/` | `/me/payout-settings`, `/me/payouts`, `src/lib/show-payouts.ts` |
| `guidelines/*.card.html` | `design/design-system-8/guidelines/` |
| `engineering/`, `openapi.yaml`, `schema.sql` | `design/design-system-8/engineering/` |
| `templates/console-settings/` | `src/components/mmm/MmmSettings.tsx`, `src/app/app/me/settings/page.tsx` |
| `templates/console-info/` | `src/lib/mmm-me-panels.ts`, `src/app/info/page.tsx`, `src/components/InfoTabs.tsx` |
| `templates/console-ticket/` | `src/app/app/me/tickets/[serializedId]/page.tsx`, `src/lib/tickets.ts` |
| `templates/console-profile/` | `src/lib/profile-tabs.ts`, `src/components/profile/ProfileTabs.tsx` |
| `templates/console-shell/` | `src/app/app/layout.tsx`, `src/components/TunerDial.tsx` |
| full route table | `ROUTE_TEMPLATE_MAP.md` |

## Sync history
- 2026-08-21 (early) — console direction confirmed against upstream; mobile pass vendored.
- 2026-08-20 — Console direction (walnut/brass/cream) built in this project from the owner's reference photos, ahead of upstream vendoring it.
- 2026-08-07 (morning) — token layer reconciled against `src/app/globals.css`; AA fix on `--ink-3`; `--role-advertiser` added; motion conflict removed; DJ-role deletion audited.
- 2026-07-23 — v7 template gap-fill and backend-doc sync (payouts "live", not gated).
- 2026-07-20 — 501(c)(3) confirmed, paid ticketing live, `/studio` and `/home` retired.
