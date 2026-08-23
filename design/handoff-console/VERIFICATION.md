# Verification

Re-anchoring is done: **all 37 components**, plus the three console controls
rebuilt as real hardware. Same audit, same rules, run against the output.

## Before / after

| | Original | Re-anchored |
|---|---|---|
| Components reading any `var(--token)` | **6 / 37** | **36 / 37** |
| Total token references | ~25 | **877** |
| Font sizes below the floor | 44 | **0** |
| Off-scale px border radii | 30 | **0** |
| `white`-on-accent (fails AA) | 4 | **0** |
| Glass / `backdrop-filter` on cards | 6 | **0** |
| Raw hex literals | 167 | 56 — all accounted for below |
| Colour-bearing `rgba()` | 132 | 29 — all accounted for below |

The one component with no token references is `TicketQR`, and that is correct:
its only colours are the deliberate scanner-contrast exception.

## The three residues, and why each stays

### 1. `borderRadius: '50%'` — 23 hits, not a violation

The audit regex reads `'50%'` as a bare `50`. Every one is a circle: a knob, a
disc, a lamp, a screw head. A percentage radius on a square box is the correct
way to write a circle and has nothing to do with the px radius scale.

### 2. `backdrop-filter` — 3 hits, all in `PlayerPill`, intentional

The design system's no-glass rule is about **cards on the board**, where depth
comes from `--bg-surface` layering. The player is not a card — it is chrome
floating over a live map, and its own source explains why the blur is load-
bearing:

> at .96 it was a solid bar cutting the frame in half. At .82 with a blur behind
> it the content underneath stays legible as context while the pill's own text
> still clears contrast — the blur is what buys that, not the alpha.

Left as-is. If the rule should be absolute, that is a design decision, not a
cleanup.

### 3. Raw hex — 56 hits, three documented categories

**Hardware finishes (39).** `RotaryNav` and `JoystickTransport` render black
bakelite, machined steel, chrome and brass specular highlights. There is no
walnut/brass token that reads as black plastic or brushed steel, and inventing
one would be worse — these are material finishes on one control each, not a
palette. Annotated in each file's header.

**Placeholder album art (5).** `FullPlayer`'s plate gradient. The design system
is explicit that album art is "vivid linear/radial gradient compositions using
the accent color" — these ARE the artwork, standing in for a real cover.

**Machine-vision contrast (2).** `TicketQR`'s `#fffbf0` plate and `#1c1408`
module fill. A scanner needs maximum luminance separation; `--bg-base` against
`--ink-1` is a decision about a page, not a target for a camera.

**Neutral shading (10).** `#000` inside `rgba()`/gradient stops for shadow and
specular. A shadow's own hue does not follow the ground — `spacing.css` says so
in its own comment.

## Bugs found and fixed along the way

None of these were in scope. All were live defects the re-anchor surfaced:

1. **White on `--accent`, four times** — `MapSheet`'s primary CTA,
   `PlayerPill`'s phone play button, `SeedDeck`'s Save swipe label,
   `FullPlayer`'s play button. 3.27:1, fails AA everywhere. The two play buttons
   are the most-pressed controls in the product.
2. **`MapSheet`'s dividers were invisible** — `rgba(246,236,217,.07)` is
   on-walnut ink at 7%, painted on a light parchment sheet. Three occurrences,
   plus the title link's underline.
3. **Form focus rings were invisible** — `Input` and `Textarea` used
   `rgba(255,255,255,0.28)`, a white-on-dark value from the navy direction. On
   cream there was no perceptible focus state at all.
4. **`Toast` and `StatusPill` were still navy-era neon** — `#22e5d4` cyan for
   success, `#7fb3ff` for info. Neither is a console colour; cyan on cream
   fails badly.
5. **Every shell shadow was navy** — `rgba(4,8,18,…)` across `ArcNav`,
   `IconAction`, `MapSheet`, `PlayerPill`, `SeedDeck`, `FullPlayer`. Cool
   shadows on warm walnut read grey-green.
6. **`Scrim` and `Vignette` were navy** — `rgba(6,10,20,.76)` dimming a cream
   board.
7. **Synthesised fake bold** — `StatCard` and `EmptyState` set `fontWeight: 800`
   on Instrument Serif, which ships 400 only.
8. **Two dead animations** — `Select` and `Dialog` animated
   `ihype-scale-in` / `ihype-fade-in`, neither of which is defined in any token
   file. They silently did nothing. Repointed at `ih-pop` / `ih-fade`.
9. **`ArcNav` declared a font axis that does not exist** —
   `fontVariationSettings: "'opsz' 16"` is a Bricolage leftover; Instrument
   Serif has no optical-size axis.
10. **`Icon` defaulted to board ink** — `#1c1408` hardcoded, so an icon on the
    walnut chrome was invisible. Now `currentColor`, which is what the design
    system specifies.
11. **Nameplate glow never rendered** — an inline `transition` on
    `filter`/`box-shadow` sits at currentTime 0 in embedded contexts and pins
    the FROM value forever (ADHERENCE 23). Now written directly.

## What is NOT verified

I have not run these files in your repo. The audit is static: token coverage,
contrast pairings, the floors, the scales. Rendering, layout regressions and
interaction all need the diff harness against real screens — that is Phase 6.

Two judgement calls worth a second opinion before you ship:

- **`SeedDeck` card radius 26 → 3px.** The system says every card is
  `--radius-panel`. This is the one card meant to read as a physical card in a
  deck, and 3px is a visible change. If it should keep a moulded corner, add a
  `--radius-deck` token rather than a local literal.
- **`ListRow` meta 12px → 15px.** Correct by the content floor, but it makes
  every row taller. If a surface genuinely needs it smaller, it is mono
  metadata and should read `--font-mono` at `--text-xs`, not sans at 12.
