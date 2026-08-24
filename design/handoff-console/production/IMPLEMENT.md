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
THE VISUAL SPEC IS reference/console-dock/ — open "Console Dock.dc.html"
in a browser (self-contained: tokens, textures, runtime included). What
shipped instead was a flat horizontal bar; that is wrong. The real dock:
round MAP/MUSIC/ME knob with knurled skirt + brass cap; a cream VU-style
dial with the current section as the big serif station name, prev/next
sections as small ARCED-IN wing labels, tick band, warm analog backlight,
red needle; a brass Xbox-style thumbstick in a recessed 4-gate well.
ConsoleDock.tsx in this folder is the ROUTER WIRING scaffold only — keep
its router/transport logic, replace its markup/CSS with a faithful
translation of the reference.

FRAME RULE (applies to every step): the app renders as ONE 430px console
column, identical on desktop, mobile, iOS and Android. On viewports wider
than 430px the column centers on the walnut cabinet ground
(tex/walnut-v3.png over the walnut gradient); it never reflows full-bleed.
The first production screenshots stretched the dock across a 1914px window —
that is the failure this rule exists to prevent.

Mount `<ConsoleDock onTransport={playerStore.dispatch} />` in
src/app/app/layout.tsx — the signed-in shell ONLY. /login, /auth/*, /welcome
never render it. Knob cycles /app/{map,music,me}; thumbwheel drags through the
section ring (mirrors src/lib/mmm-nav.ts — if nav.ts changes, change SECTIONS
here in the same PR); joystick: tap toggle, L/R prev/next, up/down
expand/collapse. Keyboard: knob and stick are buttons (Enter/Space native).

## Step 3 — MAP skin
Leaflet keeps its data flow. The COMPLETE reference is in the bundle:
reference/map-treasure.html — a working page (CDN Leaflet + real OSM tiles).
Translate it: the sepia tile filter values, parchment frame, search bar,
X-mark venue pins with nameplate labels, dotted route lines, compass rose +
scale + OSM credit block, and the venue sheet. Do not redesign any of it;
open the file in a browser next to your output and diff by eye.

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
