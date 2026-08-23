# iHYPE design implementation rules

<!--
  Drop this file at the repo root as CLAUDE.md (or AGENTS.md / .cursorrules).
  It is a binding contract for any human or AI making visual changes here.
  Generated from the iHYPE Design System, console direction, 2026-08-22.
-->

## The one rule

**`src/styles/ihype-console.css` is the source of truth for every visual value
in this codebase.** It is generated from the design system. Read from it. Never
edit it. Never work around it.

If you believe a value in it is wrong, say so and stop. Do not fix it locally.

## Hard prohibitions

Violating any of these fails `npm run lint:design`:

- ❌ **No raw hex colours.** `#f0dfb8` → `var(--bg-base)`. If no token matches
  what you want, you want the wrong colour.
- ❌ **No raw px values** in styles. `16px` → `var(--space-4)`. Exceptions:
  1px hairlines, and values inside the generated bundle itself.
- ❌ **No fonts other than** Instrument Serif (display / every `h2` / the dial),
  Work Sans (body, UI), JetBrains Mono (eyebrows, timestamps, tabular figures).
  Bricolage Grotesque is **retired** — the design system's readme still
  mentions it and the readme is wrong; `tokens/typography.css` is right.
- ❌ **No `font-weight` above 400 on display type.** Instrument Serif ships
  400 regular and 400 italic only. `font-weight: 800` synthesises a fake bold.
- ❌ **No media query other than 620px** in console/app code. Not 768, not 900,
  not 1024. The `--bp-*` scale is for the marketing site only.
- ❌ **No new components.** 37 exist with declared prop signatures in
  `.oxlintrc.json`. Compose them. If one genuinely cannot express the design,
  stop and ask — do not fork it.
- ❌ **No undeclared props** on those components. The linter knows every
  signature.
- ❌ **No emoji** anywhere in the UI. Expressiveness comes from typographic
  contrast and colour. Icons are custom inline SVG, stroke 1.4–1.8, round caps.
- ❌ **No restating console material CSS.** Use `.walnut-panel`,
  `.walnut-plate`, `.walnut-frame`, `.walnut-lip-top`, `.tuner-dial`,
  `.tuner-scale`, `.tuner-ticks`, `.tuner-needle`, `.tuner-step`,
  `.mmm-console`, `.map-parchment`, `.brass-hardware`, `.dock-ash-cap`.
  Never hand-roll their gradients.

## Material discipline

Three materials. Ink comes from the material, not from a global scale.

```
board (cream)  --bg-base/-surface/-raised/-overlay  →  --ink-1/-2/-3
walnut         --walnut/-2/-3                       →  --ink-on-walnut/-2/-3
map            --map-void                           →  --map-ink
accent fill    --accent                             →  --ink-on-accent
```

**`--ink-1/2/3` on a walnut surface is a bug**, not a style choice. This is the
most frequent error in this codebase's history.

## Contrast rules that override your instincts

| Do not | Do | Why |
|---|---|---|
| `color: var(--accent)` | `color: var(--accent-text)` | #ff5029 on cream is 2.48:1, fails AA |
| `color: #fff` on accent | `color: var(--ink-on-accent)` | white on accent is 3.27:1, fails |
| `color: var(--ink-4)` | `color: var(--ink-3)` | `--ink-4` is 2.65:1 — hairlines only |
| text below 15px | `var(--text-base)` min | content floor; mono eyebrows exempt at 11px |

`--accent` is a **fill**. `--accent-text` is a **word**. They are never
interchangeable, even where the hex used to match.

## Radii

`--radius-panel` is **3px** and it is correct. Every card, row, stat, section
panel. Do not soften it to 8 or 12 because it looks severe on its own — it is
not severe in context, and softening it is the single change that most reliably
destroys the console read.

`--radius-pill` (9999px) stays for anything that reads as a key.

## Type roles

- `--font-display` / `--font-serif` — Instrument Serif. Every `h2`, the dial's
  station names. Already tight: set `letter-spacing: normal` locally rather
  than reading `--tracking-display` (that token belongs to the retired
  Bricolage and is kept only for old marketing templates).
- `--font-body` — Work Sans, 400/500/600.
- `--font-mono` — JetBrains Mono. All-caps eyebrows, 11px min, tracked
  `--tracking-wider` to `--tracking-widest`.

## Motion

Easing and durations come from tokens only. `--duration-fast` (120ms) for
hovers, `--duration-default` (200ms) for state changes, `--duration-medium`
(320ms) for screen transitions. `--ease-spring` for anything that should feel
mechanical-with-give.

No decorative looping animations. `prefers-reduced-motion` is already handled
in the bundle — do not add your own handling, and do not defeat it.

## Mobile

375px floor. **One breakpoint: 620px.** It is the only breakpoint in a token
and the point where safe-area insets flip. 44px minimum touch target. `dvh` never
`vh`. Safe areas from `--pane-pad` / `--chrome-l` / `--chrome-r` /
`--player-l`, which already contain their `env()` calls — consume, never
re-derive.

## Copy

- Terse. Headlines 3–4 words. Labels and eyebrows ALL CAPS.
- Second person. "Your data · this week", never "User statistics".
- Abbreviated metrics: `9.8k`, `3:38`, `1.5×`.
- Section names are fixed: **Seeds** not Discover, **Govern** not Vote,
  **Shows** not Events.
- Wordmark is **iHYPE**. Not iH·YPE, not IHYPE, not Ihype.
- Contact is **admin@ihype.org**. Never hello@.

**Do not rewrite copy that was given to you.** Format it; leave the words.

## Product facts that constrain the UI

Getting these wrong is worse than a visual bug — they are legal and financial
claims:

- Split is **70/20/10 · 0% iHYPE** — 70 artist, 20 venue, 10 promoter pool.
  Frozen at event publish, settled per event.
- The **only** charge above ticket face value is Stripe's processing fee
  (2.9% + $0.30; AMEX 3.5% + $0.30), passed through at cost. iHYPE takes $0.
- **Four account types: Fan, Artist, Venue, Advertiser.** There is **no
  Promoter account** and **no DJ role**. `--role-promoter` colours the 10%
  payout slice only — never an account type, never a signup, never a nav item.
- **HYPE resets every 24h, per target.** Implemented as a timestamp per target,
  never a boolean, so the remaining wait can be stated ("17h 40m") and the tap
  refused client-side. Coarse to the minute on purpose.
- **Audio only.** iHYPE has never hosted video and never will.
- **One outbound link per profile page**, and only a domain the account owns.
  No streaming, social, or link-in-bio addresses.
- Profile pages come from a **fixed per-type schema**. There is no AI page
  generation — it was retired 2026-08-08.

## Before you open a PR

```bash
npm run lint:design        # warning count must not increase
```

Then check, by eye, in this order — these are the five that fail most often:

1. Is any walnut surface using board ink?
2. Is `--accent` being used as text anywhere?
3. Is any panel radius not 3px?
4. Is any content text below 15px?
5. Did any component gain a prop that isn't in `.oxlintrc.json`?
