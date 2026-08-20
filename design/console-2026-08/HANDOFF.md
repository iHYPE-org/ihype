# iHYPE console / hi-fi — design handoff

**Generated from the live stylesheets by `npm run design:handoff`. Do not edit
by hand — re-run it.** Every hex below was read out of `src/app/globals.css`
and every ratio was computed, not quoted.

This document goes back to Claude Design so templates can be redesigned in the
console scheme. It is the answer to "what does the code actually do".

---

## 1 · There is ONE ground

The light/dark/console themes were collapsed into a single ground on
2026-08-19. There is no theme switcher, no `prefers-color-scheme`, and no
`[data-theme]` block. A template must not offer an appearance choice.

| Role | Token | Value | On ground |
|---|---|---|---|
| Ground | `--bg` | `#f0dfb8` | — |
| Body ink | `--ink` | `#1c1408` | **13.84:1** |

`html.high-contrast` still exists and is **not a theme** — it is an
accessibility mode with its own black ground. Do not design for it; do not
remove it.

---

## 2 · Materials — the part that makes it hi-fi

The console look is not "a warm palette". It is **three materials** used for
three different kinds of object. Getting this wrong is what makes a page look
like a beige website instead of a receiver.

| Material | Token | Value | Used for |
|---|---|---|---|
| Walnut (lightest) | `--walnut` | `#4a2b16` | cabinet face, top of gradient |
| Walnut mid | `--walnut-2` | `#34200f` | full-player ground |
| Walnut dark | `--walnut-3` | `#1a1206` | recessed wells, control glyphs |
| Brass | `--brass` | `#c9a54e` | bezels, transport, step keys |
| Brass deep | `--brass-deep` | `#8a6a2c` | the shadow side of a bezel |
| Lamp | `--lamp` | `#ffb84a` | pilot lamps, lit state, hover |

### Walnut is DARK in every context — it needs its own ink

This is the single most important rule in this document, and it has already
caused one shipped bug (the player dock painted dark ink on a near-black bar
for weeks).

| Token | Value | On `--walnut` |
|---|---|---|
| `--ink-on-walnut` | `#f6ecd9` | **10.87:1** |
| `--ink-on-walnut-2` | `#d8c6a6` | **7.61:1** |
| `--ink-on-walnut-3` | `#bda882` | **5.51:1** — the floor for a WORD |

Ratios are against `--walnut`, the **lightest** stop of the gradient. Copy can
land anywhere on a gradient, so the worst case is the only one worth quoting.

**Never put `--ink`, `--ink-2` or `--ink-3` on a walnut surface.** There is a
lint rule that fails the build on it.

Hairlines and rails on walnut: `--rule-on-walnut` / `--rule-on-walnut-2`.
The page's `--line` / `--hair-*` are dark alphas and vanish into timber.

---

## 3 · The accent is a FILL, never a word

`--accent` is `#ff5029`. On the cream ground it measures
**2.48:1** — it fails AA as copy and fails even the 3:1
large-text bar.

| Job | Token | Value | Measured |
|---|---|---|---|
| The fill | `--accent` | `#ff5029` | — |
| The accent as a WORD | `--accent-text` | `#923319` | 5.89:1 on ground |
| A label ON the fill | `--ink-on-accent` | `#1c1408` | 5.58:1 on accent |

`--ink-on-accent` is **dark ink, not white**. White on this accent is 3.27:1
and fails. This surprises people; it is measured.

The same split exists for `--warning-text`, `--danger-text` and
`--success-text`. A fill token and a copy token are different tokens even when
the hex matches.

---

## 4 · Components, as real CSS

Copy these verbatim. They are what ships.

### The walnut panel and its edges

```css
.walnut-panel {
  background:
    repeating-linear-gradient(88deg,
      rgba(30, 14, 4, .22) 0 1px, transparent 1px 5px,
      rgba(94, 56, 26, .14) 5px 7px, transparent 7px 15px),
    linear-gradient(180deg, var(--walnut) 0%, var(--walnut-2) 34%, var(--walnut-3) 100%);
  color: var(--ink-on-walnut);
}

.walnut-lip-top {
  border-top: 3px solid var(--brass);
  box-shadow: inset 0 4px 0 -1px rgba(255, 214, 160, .18);
}

.walnut-frame {
  border: 2px solid var(--brass-deep);
  box-shadow:
    inset 0 1px 0 rgba(255, 214, 160, .22),
    0 18px 40px -18px rgba(0, 0, 0, .55);
}

.walnut-plate {
  border-radius: 2px;
  overflow: hidden;
  background-color: var(--walnut-3);
  background-size: cover;
  background-position: center;
  box-shadow:
    0 0 0 2px var(--brass-deep),
    0 0 0 5px var(--brass),
    0 0 0 6px #6d5222,
    inset 0 3px 12px rgba(0, 0, 0, .7),
    0 20px 44px -16px rgba(0, 0, 0, .85);
}
```

The **88° grain is not 90°** on purpose: exactly vertical reads as a UI stripe
pattern, a couple of degrees off reads as cut timber.

### The tuner dial — the signature control

It replaces every horizontal tab strip. A strip divides one row by the number
of tabs, so each tab added shrinks every label; the dial spends the same row on
**one** destination at 26px and does not shrink when a section is added.

```css
.tuner-dial {
  position: relative;
  flex: 1;
  min-width: 0;
  border-radius: 3px;
  padding: 5px 12px 6px;
  overflow: hidden;
  cursor: grab;
  /* Both are needed and they do different jobs: touch-action stops the browser
     scrolling the page instead of tuning, user-select stops a native text-drag
     firing pointercancel mid-gesture and killing the drag in one direction. */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  background:
    radial-gradient(150% 200% at 50% 130%, #fff3d4 0%, var(--bg) 42%, #e2cea0 78%, #d4bd8c 100%);
  background-color: #eeddb4;
  box-shadow:
    0 0 0 1px var(--brass-deep),
    0 0 0 3px var(--brass),
    0 0 0 4px #6d5222,
    inset 0 2px 5px rgba(92, 62, 20, .45),
    inset 0 -1px 0 rgba(255, 252, 235, .8);
}

.tuner-station {
  display: none;
  width: 100%;
  border: 0;
  background: none;
  padding: 0;
  font-family: var(--f-s);
  font-size: 1.625rem;
  line-height: 1.12;
  letter-spacing: .005em;
  text-align: center;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: inherit;
}

.tuner-scale {
  position: relative;
  display: block;
  height: 20px;
  margin-top: 2px;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent);
}

.tuner-ticks {
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(90deg, rgba(28,20,8,.85) 0 2px, transparent 2px 46px),
    repeating-linear-gradient(90deg, rgba(28,20,8,.42) 0 1px, transparent 1px 9.2px);
  background-size: auto 15px, auto 8px;
  background-repeat: repeat-x, repeat-x;
  background-position-y: 0, 0;
  will-change: background-position;
}

.tuner-needle {
  position: absolute;
  top: 0; bottom: 0; left: 50%;
  width: 1.5px;
  margin-left: -.75px;
  background: var(--accent);
  z-index: 3;
  box-shadow: 0 0 3px rgba(var(--accent-rgb), .8);
}

.tuner-step {
  flex: 0 0 auto;
  width: 44px;
  min-height: 44px;
  border-radius: 3px;
  border: 1px solid var(--brass-deep);
  background: linear-gradient(180deg, var(--brass) 0%, var(--brass-deep) 100%);
  color: var(--walnut-3);
  font-family: var(--font-display, 'Bricolage Grotesque', sans-serif);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 244, 214, .55);
}
```

**The scale is infinite for free.** Two `repeating-linear-gradient`s whose
`background-position` is driven by the drag — no cloned strip, no seam,
stations wrap in both directions. The 46px major pitch is also the drag
distance per station; the two must move together.

**Semantics:** `role="tablist"` of `role="tab"` buttons with roving tabindex —
**not** `role="slider"`. A slider announces a number where a member needs a
destination name.

### The cabinet (app chrome)

```css
.mmm-console {
  --mmm-console-pad: 7px;
  position: absolute;
  left: calc(var(--mmm-left) - var(--mmm-console-pad));
  bottom: calc(var(--mmm-bottom) - var(--mmm-console-pad));
  height: calc(var(--mmm-chrome-size) + var(--mmm-console-pad) * 2);
  /* Spans the trigger, the gap and the pill — the same three terms
     --mmm-player-left is built from, plus the pill's own max width. */
  /* Spans the trigger, the dial and the pill with their gaps — the same terms
     --mmm-player-left is built from, plus the pill's own max width. Adding the
     dial without adding it here is what left the pill hanging 180px past the
     cabinet's right edge on a 1100px viewport: caught by measuring, not by
     reading. */
  width: min(
    calc(var(--mmm-chrome-size) + var(--mmm-chrome-gap) + var(--mmm-dial-w)
         + var(--mmm-chrome-gap) + 760px + var(--mmm-console-pad) * 2),
    calc(100vw - var(--mmm-left) - var(--mmm-inset) - var(--mmm-safe-right) + var(--mmm-console-pad) * 2)
  );
  z-index: 26;              /* under the trigger (31) and the pill (28) */
  border-radius: 7px;
  pointer-events: none;
  background:
    repeating-linear-gradient(88deg,
      rgba(30, 14, 4, .30) 0 1px, transparent 1px 4px,
      rgba(94, 56, 26, .22) 4px 6px, transparent 6px 13px),
    repeating-linear-gradient(91deg,
      rgba(20, 9, 2, .22) 0 2px, transparent 2px 9px),
    repeating-linear-gradient(89deg,
      rgba(120, 74, 38, .16) 0 1px, transparent 1px 27px),
    linear-gradient(180deg, #6b4426 0%, #52301a 30%, #432612 46%, #3a2110 60%, #4a2c17 74%, #5c3a1f 90%, #6f4728 100%);
  background-color: var(--walnut);
  box-shadow:
    inset 0 1px 0 rgba(255, 214, 160, .34),
    inset 0 -1px 0 rgba(0, 0, 0, .7),
    0 4px 14px -4px rgba(0, 0, 0, .85),
    0 1px 0 rgba(255, 214, 160, .1);
  transition: opacity .24s var(--ease-default);
}
```

---

## 5 · Type

- **Content floor is 15px** (`0.9375rem`). Enforced; the build fails below it.
- **Eyebrow exemption:** tracked mono only — monospace family **and**
  `letter-spacing >= 0.14em` — down to **11px**. Metadata only. A form label, an
  error message or a status readout is **content**, not an eyebrow.
- Three-step hierarchy: **Bricolage Grotesque** display for the page,
  **Instrument Serif** (`--f-s`) for section headings (`h2`), **Work Sans** for
  prose, **JetBrains Mono** for eyebrows.
- Sizes in `rem`, never `px` — the root font size carries the reader's Text
  size setting and iOS Dynamic Type, and `px` cannot follow it.

---

## 6 · Rules a template must not break

1. **No emoji.** Unicode glyphs (`▶ ❚❚ ♥ ✕ ✓ ★ ⬟ ♪`) are the vocabulary.
2. **There is no DJ role.** Deleted from the product 2026-08-06.
3. **Promoter is not an account type.** It is a 10% payout share. `--role-promoter`
   colours that slice and nothing else.
4. **No white on the accent fill.** Use `--ink-on-accent`.
5. **No appearance/theme switcher.** One ground.
6. **70 / 20 / 10 / 0%** — artist / venue / promoters / iHYPE. Never restate it
   differently.
7. **Audio only.** No video anywhere.
8. **admin@ihype.org** and **ihype.org** are the only contact and domain.

---

## 7 · What is currently WRONG in the templates

Run `npm run audit:design` for the live list. As of this generation:

- 71  emoji          in 17 template(s) — ADHERENCE §29 — no emoji, anywhere
- 39  dj-role        in 7 template(s) — ADHERENCE §4 — there is no DJ role
- 31  promoter-role  in 7 template(s) — ADHERENCE §3 — promoter is not an account role
- 44  ink-on-accent  in 22 template(s) — ADHERENCE §32 — white on accent is 3.27:1, fails AA

These are design defects and must be fixed **in Claude Design and re-vendored**
— correcting them in `.tsx` is undone by the next session that faithfully
applies the template.

---

## 8 · What the code still does NOT have

Honest gaps, so a template does not assume them:

- **Transport knob** with drag gestures (tap play/pause, drag for next/prev,
  drag up for the full player) — not built.
- **Full player artwork in a brass bezel** — the full player is on walnut, but
  the cover does not yet carry the `.walnut-plate` bezel.
- **The map** is a real interactive map, not the prototype's stylised canvas.
- **Marketing, legal and admin routes** carry the palette and type but not the
  cabinet. Only the app shell is furniture.
