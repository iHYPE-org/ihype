# IMPLEMENT.md — direct drop into iHYPE-org/ihype

The console frontend, prepped as production files. Routes, data hooks and API
calls are untouched; markup and CSS are replaced. Order matters — every step
ships green.

## Files in this folder → repo destinations

| File here | Drop at | Step |
|---|---|---|
| production/mmm-console.css | src/app/mmm-console.css | 1 |
| production/ConsoleDock.tsx | src/components/mmm/ConsoleDock.tsx | 2 |
| css/ihype-console.css | (reference: full token bundle if mmm-console.css needs a value) | — |
| components/*.jsx (37) | markup reference per screen — copy JSX structure, keep prod hooks | 5 |

## Step 1 — Tokens (1 file, no behavior change)
Add `import './mmm-console.css'` after `./mmm.css` in src/app/layout.tsx.
mmm.css already reads tokens; this recolors the shell to cream/walnut/brass.
Verify: /app/map renders cream, dock area walnut. Nothing else moves.

## Step 2 — The dock (1 component + 1 layout line)
Mount `<ConsoleDock onTransport={playerStore.dispatch} />` in
src/app/app/layout.tsx — the signed-in shell ONLY. /login, /auth/*, /welcome
never render it. Knob cycles /app/{map,music,me}; thumbwheel drags through the
section ring (mirrors src/lib/mmm-nav.ts — if nav.ts changes, change SECTIONS
here in the same PR); joystick: tap toggle, L/R prev/next, up/down
expand/collapse. Keyboard: knob and stick are buttons (Enter/Space native).

## Step 3 — MAP skin
Leaflet keeps its data flow. Add the sepia tile filter + parchment HUD from
the design (treasure-map.html in the design project is the reference:
tile filter values, compass/scale/OSM-credit block, pin styling).

## Step 4 — Paper pass on MUSIC + ME panes
Per V10_SIMPLIFICATION.md: strip gradients/shadows/tints from pane markup,
1px var(--line) rules, --radius-panel, one display face per screen. Every
fetch/SWR hook stays.

## Step 5 — Screens S4–S9
design/handoff-console/reference/s1–s9 *.html are the per-screen pixel references (self-contained, open in any browser); NAV_MAP.md maps each S# to its route + endpoints. For each page.tsx: keep its data section, replace its
JSX return with the S# structure. HYPE button: 4 states per
BACKEND_RECONCILED.md (spendable / 429 window / 409 insufficient / own).

## Step 6 — Marketing pages
From the design system's templates (landing/, about/, charter/), last.

## Guardrails
- No new colors, radii, fonts, shadows: if a value isn't in mmm-console.css,
  it doesn't ship. Gate: node design/handoff-console/lint/check-adherence.mjs src/ --max=0 (dependency-free; the old oxlint config required eslint-only rules and does not run) plus the repo's own npm run audit:retro --max=0.
- Dock is 93px constant; safe-area pads BENEATH (already in the CSS).
- Pre-auth = dockless (gated by layout placement, not CSS).
- Do not consult engineering/openapi.yaml or engineering/schema.sql — stale;
  src/app/api/ is the API truth.
