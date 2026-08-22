# App shell — locked 2026-08-08, amended 2026-08-19, SUPERSEDED 2026-08-22

> ## SUPERSEDED — the geometry below is not what ships
>
> The owner retired the previous chrome outright ("I don't want any previous
> design, retire it and keep the backend wiring and match to new design. Bottom
> hifi nav system is the only thing I want", 2026-08-22). The logo trigger, the
> radial arc, the nav hint, the scrim, the player pill and the phone
> mini-player are all **deleted**, along with the geometry table that placed
> them: `--mmm-chrome-gap`, `--mmm-dial-w`, `--mmm-player-left` and the resting
> `--mmm-bottom` no longer exist.
>
> What ships instead is one walnut bar across the bottom of every screen —
> `RotaryNav` (74px), `TunerDial`, `JoystickTransport` (74px) — from
> `design/handoff-console-2026-08-21/templates/console-shell/`. Its figures live
> in `src/app/mmm.css` (`--mmm-knob` is the origin; `--mmm-chrome-size` is what
> content clears) and are described in `MmmDock.tsx`. DESIGN_SYNC row 289.
>
> **The METHOD in the amendment below is the part that survives, and it is why
> the dock was measured rather than eyeballed:** every figure is load-bearing on
> the others, and the two bugs from adding the tuner to the old chrome were both
> a dependent nobody re-derived. `npm run measure:dock` is that check, now
> repeatable — it drives Chromium against the real stylesheet slices and fails
> on a wrapped bar, mismatched knobs, an overflowing cap, a clipped station name
> or a covered chevron.
>
> Read the rest of this document as history: it describes chrome that no longer
> exists. Do not restore a figure from it.


> ## AMENDMENT — the console direction supersedes the SHAPE, not the METHOD
>
> The owner directed the app to be rebuilt to the hi-fi console prototype
> ("I want the app to look like that mockup"), and the chrome has changed
> accordingly: the trigger and the player now sit on a walnut cabinet, and a
> tuner dial occupies the band between them.
>
> **What that changed:** `--mmm-player-left` gained a term (`--mmm-dial-w`),
> and the cabinet's width is derived from the same set.
>
> **What it did NOT change, and must not:** the rule directly below this box.
> Every figure here is still load-bearing on the others, and the two bugs that
> came out of adding the dial were both a dependent that was not re-derived —
> the pill hung 181px past the cabinet at 1100px, and the dial overlapped the
> mini player at 393px. Neither was visible in the source; both were found by
> measuring rendered boxes.
>
> So: this document is no longer a freeze, and it is still the method. Change a
> figure only by re-deriving everything downstream of it, and measure the
> result at 393px and at a desktop width before believing it.
>
> The rest of the document stands as written and describes the geometry the
> cabinet is built around.

Signed off by the user as final. Treat the numbers below as fixed: they are
load-bearing on each other, and several were arrived at by fixing a specific bug.
Change one and re-derive the rest rather than nudging in isolation.

## One figure drives the chrome

`chromeSize = 88` in `templates/simplified-app/SimplifiedApp.dc.html` sizes the
logo trigger, the player's height, the nav hint's offset and the player's dock
position. The trigger and the player are the same height on the same baseline
(`bottom: 26`), sharing edges rather than being centred against each other —
`box-sizing: border-box` on the pill is what makes the two borders sit on one
line instead of 2px apart.

## PlayerPill

- **One row, not a column of rows.** The artwork is the row's first child, so it
  centres against the pill's whole height; title, meta and the scrub row stack in
  a column beside it. This is why the scrub row aligns with the title *by
  construction* — it previously used a hardcoded `paddingLeft: 58` that only
  happened to line up at one artwork size.
- **Artwork 64px, radius `round(64 × 0.342)`** — the same corner ratio as
  `LogoTrigger`, because the square holds the artist's *logo* and a circle crops a
  mark. 64 in 88 leaves exactly 12px above and below; the pill's padding is
  `0 12px` so the inset matches on every side it touches.
- **The artwork retires the player.** It is the largest target and the only
  control that does not touch playback. The retired disc is the same artwork in
  the same place at 56px, in the same squircle, with progress tracing the rounded
  rectangle (`pathLength: 100`, so it survives a radius change).
- **Volume is a fixed 108px; seek takes the remainder.** Seek is scrubbed,
  volume is set once — but at 64px volume was unaimable.
- **A continuous accent hairline**, not a partial top bar. The bar competed with
  the scrub row for the same job and, positioned against the pill's rectangular
  box, hung ~30px past the 44px-radius capsule at each end.
- **HYPE always reads HYPE.** State is the fill, the border, and the wait label
  *beside* the word — never a rename.

## ArcNav

Marks are drawn BIGGER than their discs (92px over 66px; the pin 100px, having
the least ink of the three) and break the edge on every side. Line art at one
1.55 weight — filled versions became silhouettes at this size. Embossed with two
drop-shadow filters rather than duplicated paths, so a redrawn glyph needs no
second copy.

Two traps, both already sprung:

1. Centring is by a declared **optical anchor**, not a bounding box. Bounding-box
   centring measures the protrusions and pushes the drawing off the opposite way.
2. The mark is **absolutely centred** (`left/top: 50%` + half-size pullback), not
   grid-centred. `place-items: center` on a grid whose item is larger than its
   track resolves to the *start* edge, which sat every mark 10px down and right.

The level-1 coordinate tables are spaced for the mark footprint, not the disc —
centres need roughly 104px between them.

## Rules that outlive the geometry

- **No CSS keyframes or `fill: both` transitions.** The document timeline does
  not advance in every context this runs in, so an unadvanced animation holds its
  from-state forever. Everything is authored at its final value; motion that must
  move is tweened on `requestAnimationFrame` (see `SeedDeck`).
- **`--accent` is a fill; `--accent-text` is copy.** Links use `--accent-text`
  (2.4:1 vs 7.17:1 on light). Never invent a token at the point of use.
- **HYPE resets every 24 hours, per target**, by timestamp — not a boolean, which
  used to clear on every track change and let one member hype an artist once per
  song. Notes: static class fields do not survive the logic transpile, and
  `setState(fn)` is not supported — use the object form.
