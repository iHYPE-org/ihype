# Re-anchoring the component library

## The finding

An audit of all 37 `.jsx` files in `components/core/` and `components/shell/`
(2,884 lines) against the design system's own tokens:

| | Count |
|---|---|
| Raw hex literals | 167 |
| Raw `rgba()` literals | 132 |
| Font sizes below the floor (9, 9.5, 10, 10.5px) | 44 |
| Non-system border radii (10, 12, 14, 16, 18, 21, 22px) | 30 |
| `backdrop-filter` glass effects | 6 |
| Accent used as a text colour — fails AA | 6 |
| **Total** | **385** |

**31 of 37 components read zero `var(--token)` references.** Only six touch
tokens at all, and none of those exclusively.

Worst, and most consequential, are the console chrome components — the ones
that define the product's whole read:

```
FullPlayer   51 violations    PlayerPill   43    SeedDeck   32
MapSheet     15              Toast        14    StatCard   12
```

## Why this is the root cause

The tokens were re-anchored to the console direction on 2026-08-20. **The
components were not.** They are a self-contained snapshot from an earlier
generation, carrying their own private copies of colours that have since
changed.

The operational consequence: **you can edit the token file and nothing
happens.** A design system whose components don't read its tokens is a
palette document, not a system.

And it explains why both handoff attempts failed. Code had two options:

1. **Copy the components** → faithfully reproduce pre-console styling.
2. **Read the tokens and build fresh** → re-derive from scratch, drift.

There was no third path. This is not a model failure and it is not a
discipline failure.

## The substitution rules

Applied per component, in this order. Most are mechanical; the ones needing
judgement are marked.

| Found | Replace with | Judgement? |
|---|---|---|
| `#f0dfb8` `#e6d3a4` `#ddc998` `#d4bd8c` | `--bg-base` `-surface` `-raised` `-overlay` | no |
| `#1c1408` `#4a3a24` `#6b5a3e` `#a3906a` | `--ink-1` `-2` `-3` `-4` | no |
| `rgba(28,20,8,.NN)` | nearest `--ink-aNN` / `--hair-NN` / `--line` | no |
| `#ff5029` as a **fill** | `var(--accent)` | no |
| `#ff5029` as **text** | ink-mixed safe tone (below) | **yes** |
| `borderRadius` on a card/row/stat | `--radius-panel` (3px) | **yes** — is it a panel, a key, or a control? |
| `borderRadius` on a button/input | `--radius-md` (8px) | **yes** |
| `borderRadius: 50 / 999 / 9999` | `--radius-pill` | no |
| `fontSize` < 15 on body text | `--text-base` | no |
| `fontSize` < 11 on mono | `--text-xs` | no |
| `fontWeight` > 400 on display type | `400` | no — the weight doesn't exist |
| `letterSpacing` negative on display | `--tracking-normal` | no — belongs to retired Bricolage |
| `backdropFilter` | delete; use `--bg-surface` | no |
| walnut surface + `--ink-1/2/3` | `--ink-on-walnut(-2/-3)` | **yes** — read the surface |
| hardcoded easing / duration | `--ease` / `--duration-*` | no |

### The accent-as-text fix

Six components colour text with the raw accent. `var(--accent-text)` is the
token answer, but these components accept an `accent` **prop** — used for
role-colour theming — so a fixed token would break Fan violet, Venue teal and
Advertiser amber.

```js
const inkSafe = (accent) => `color-mix(in oklab, ${accent} 62%, var(--ink-1))`;
```

Mixing any hue 62% toward ink lands in the same contrast range
`--accent-text` occupies (#ff5029 → ≈#a83b1c against the token's #923319),
and it works for every role colour rather than just the brand one. One line,
no signature change.

## What is NOT changing

**Prop signatures stay identical.** `_adherence.oxlintrc.json` encodes all 37
signatures, and the linter is the enforcement mechanism — changing a signature
would invalidate it. Re-anchoring is strictly internal: same API, same
behaviour, correct values.

That also means this is droppable into your existing app-router repo without
touching a single call site.

## Exemplars in this folder

Three components, re-anchored, Next.js app-router ready. Read the header
comment in each — it lists exactly what changed and why.

- **`Button.jsx`** — radius, font floor, and the ghost/outline AA failure
- **`Card.jsx`** — the 10px → 3px panel radius, and glass removal
- **`StatCard.jsx`** — every category at once, including the fake 800 weight

Diff each against the original in the design system. If the approach is right,
the remaining 34 follow the table above.

## Effort

2,884 lines across 37 small files. The core set (23 components) is mostly
mechanical. The shell set is where the real work sits — `FullPlayer`,
`PlayerPill` and `SeedDeck` are 126 violations between them and need the
walnut-ink judgement call on nearly every line.

Sequence: core first (unblocks every screen), then `TunerDial` / `RotaryNav` /
`JoystickTransport` (already partly tokenised), then the three big ones.
