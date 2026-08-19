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

Add a row when a surface is converted, and do not convert one that is not
listed.

**The conversion is a TOKEN pass, not a rules pass, and that is the whole
method.** The shared card/row/stat/eyebrow primitives already paint from
`--radius-panel`, `--line` and `--bg-surface`, so retuning those three values
inside `[data-theme="console"]` re-materialises every card in both shells and
on every public page at once. Writing `[data-theme="console"] .some-card`
instead would mean restating class lists this theme does not own, and would be
wrong the moment a page adds a card. If you find yourself adding a
console-scoped RULE, ask which token you are missing first.

| Surface | Converted | Notes |
|---|---|---|
| Every card, row, stat and rule in both shells | 2026-08-19 | Through `--radius-panel: 3px` and brass `--line`/`--line-2`. A console is machined: panels have a cut edge, not a moulded one. `--radius-pill` is deliberately untouched — a button that reads as a key still reads as a key. |
| The site ground (`body`) | 2026-08-19 | The last `body` rule in `globals.css` had hardcoded a retired purple-black gradient, near-white ink and `"Avenir Next"`, and being last it won: every public page painted a ground the token system did not choose, in a font DS8 does not name. `[data-theme="light"] body` existed only to counteract it. Now token-driven. |
| The public header (`.nav`, `.nav-logo`) | 2026-08-19 | Was `rgba(4,6,15,.86)` with a white wordmark in every theme — a dark navy bar across the top of the cream board. Composed from `--bg-base-rgb` now. |
| Artist and venue profiles | 2026-08-19 | The fixed subnavs (`src/lib/profile-tabs.ts`). 44px controls, 15px labels, strip bleeds to the pane edge so the overflowing tabs are visibly clipped rather than silently absent. |
| `/walkthrough` | 2026-08-19 | Stage follows the theme. It also rendered **blank on a phone** and had for some time — two separate faults, both found only by rendering it: `#wt-wrap` collapsed to 0px (the `page-enter` transform containing-block bug, third occurrence — see `globals.css`), and the 1280x720 stage was laid out from the start edge of a narrower grid track, so the whole deck sat off-screen behind `overflow: hidden`. **Known limit: a 1280x720 fixed-aspect deck scaled to 393px is ~5px type.** It renders now, which it did not; it is not legible on a phone, and making it so means reflowing the deck, not scaling it. |

## What the copy tokens are, and why there are five

`--accent-text`, `--warning-text`, `--danger-text`, `--success-text` and the
`--role-*-text` set exist because **a fill token and a copy token are
different tokens even when the hex matches**. Each of these pairs with a
translucent fill of its own hue, so its value is tuned to the ground behind
that fill — and every one of them inverted on the cream board:

| Token | On navy | On cream (before) |
|---|---|---|
| `--accent` as copy | 5.73:1 | **2.48:1** |
| `--success` as copy | 11.79:1 | **1.21:1** |
| `--danger` as copy | 5.73:1 | **2.48:1** |

`--success` carried the signup page's "Free forever. We never sell your data."
line. None of these would look wrong in a diff, and none of them changed —
the ground moved underneath them. `audit:contrast` now measures all of them
against each theme's own `--bg`, and `lint-source.mjs` fails the build on
`color: var(--accent)` in any of the three type syntaxes.

The inverse trap is real too and was live: **white hardcoded on an accent
fill is 3.27:1** and fails AA in *every* theme, including the two the code
was written for. `--ink-on-accent` is the token, and in this theme it
resolves to dark ink — the opposite of what a hardcoded `#fff` assumes, which
is why it could not be found by looking for something that changed. It was
on the primary sign-in button. `lint-source.mjs` guards this too, block-
scoped, because the fill and the label are two declarations in the same rule
and neither is wrong on its own.
