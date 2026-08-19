# Console — direction, 2026-08-19

A hi-fi console: walnut, brass, grille cloth, and a cream slide-rule dial
with black engraved lettering. `Console.dc.html` in this directory is the
working source — open it in a browser, it is interactive.

## Read this first

CLAUDE.md says the only design source is `design/design-system-8/`, and that
Claude Code must never invent UI. **This direction did not come from Claude
Design.** It was designed in a mockup during the 2026-08-19 session at the
owner's direction and vendored here afterwards, so that there IS a source to
translate from and the next session does not "correct" the product back to
DS8 navy on the reasonable grounds that nothing authorised the change.

Until this direction is reconciled with DS8, both are live and they disagree.
Treat this file as the source **for surfaces explicitly listed as converted
below**, and DS8 for everything else. Do not convert a surface because it
looks inconsistent; convert it because it is on the list.

## What the direction is

| | |
|---|---|
| Cabinet | walnut, grain from three stripe periods over a warm base |
| Face | grille cloth, two crossed periods — one direction is pinstripe |
| Dial | cream glass in a brass bezel, lamp behind, black engraving |
| Controls | bakelite knobs with brass collars, fluted rims, brass index |
| Pointer | `--accent` `#ff5029`, which is what a tuning pointer was |
| Display type | Instrument Serif — the dial and titles |
| Metadata | JetBrains Mono, tracked |

## Why the ground inverted, and why that is the point

The dark-glass draft measured 4.6:1 for its readout. Cream with black
engraving measures **13.8:1**. Real dials were cream with black lettering
because that is what stays readable under a lamp at arm's length; leaning
into the period made the accessibility case stronger, not weaker. The
readability work in PR #727 (12.5px floor, AA text colours) is upstream of
this and is unaffected either way.

Measured on the proposed token set, worst case across all four grounds:

| | worst ratio |
|---|---|
| `--ink` | 10.72 |
| `--ink-2` | 7.50 |
| `--ink-3` | 5.00 |
| `--ink-4` | 2.65 — **hairlines only, never text** |

## The trap this direction carries

**`--accent` cannot be copy on cream.** `#ff5029` on `#f0dfb8` is **2.48:1**.
On the navy ground it was 5.73:1, so every existing use of the accent as text
— eyebrows, links, active tabs — inverts from passing to failing the moment
the theme is applied. This is the same class of mistake as the `#5a5048` grey
that the DS8 repaint left behind, and it will be invisible in review.

Two tokens, and they are not interchangeable:

- `--accent` — the **fill**. Pointer, pilot lamp, HYPE button. Its label must
  be `--ink-on-accent`, which in this theme is the dark ink `#1c1408`
  (5.58:1). Cream on the accent fill is 2.48:1 and fails.
- `--accent-text` `#923319` — the accent **as copy**. 5.89:1 on cream,
  4.56:1 on the deepest board. Use this anywhere the accent is a word.

## Converted surfaces

Nothing yet. This entry exists so the list has somewhere to live; add a row
when a surface is converted, and do not convert one that is not listed.

| Surface | Converted | Notes |
|---|---|---|
| — | — | — |
