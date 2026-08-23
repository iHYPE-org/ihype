# V10 — Simplification pass ("Hardware ornate, paper plain")

Applied to the handoff 2026-08-23. Five rules, each closing a place the v9
system fought itself. Nothing new is invented — every rule deletes.

## Rule 1 — Two materials and a lamp
Keep: walnut chassis, cream faceplate, brass hardware, one orange pilot lamp.
- Parchment is MAP-only. No other surface uses it.
- Backgrounds collapse to TWO tiers: `--bg-base` (the board) and
  `--bg-surface` (a panel on it). `--bg-raised` and `--bg-overlay` become
  aliases of `--bg-surface`; stop reaching for them in new work.
- Role hues are never fills. A role is an engraved label: mono-caps,
  `var(--role-*-text)` ink, no tinted background, no tinted border.

## Rule 2 — Decoration budget: the dock spends it all
Knurling, grain, backlight, specular live on the dock and the full player
ONLY. Content panes above the dock are print: 1px `var(--line)` rules, 3px
radii, no shadows, no gradients, no texture. If a content pane needs emphasis,
it gets type size or a rule — never material.

## Rule 3 — One display voice per screen
- One display moment per screen: Bricolage Grotesque OR Instrument Serif,
  never both on the same surface. (Serif belongs to the console chrome —
  dial stations, h2 on hardware; Bricolage to paper headlines.)
- Work Sans for everything readable. Mono for eyebrows and figures only.

## Rule 4 — Navy vocabulary deleted
- Readme Borders/Hover prose updated to the cream-era tokens (PR_DS_GAPS.md).
- `engineering/openapi.yaml` and `engineering/schema.sql` deprecated
  (BACKEND_RECONCILED.md).

## Rule 5 — One canonical control each
RotaryNav, TunerDial, JoystickTransport exist once, in
`design_handoff_console_production/components/`. Screens compose plain panels
around them; no per-screen re-tuned variants.

## Test
Squint at any screen: you should see one ornate strip of hardware and quiet
paper above it. If two areas compete for the eye, one of them is breaking
Rule 2.
