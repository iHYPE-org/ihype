# App shell — locked 2026-08-08

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
