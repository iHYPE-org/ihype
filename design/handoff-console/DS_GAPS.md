# Design-system gaps found while building the console surfaces

Found by using the tokens, not by reading them. Each is a real hole in
`_ds/…/tokens/`, not a mistake in the consuming page.

---

## 1. `--role-fan-text` does not exist

`tokens/colors.css` defines a `*-text` pair for three of the four roles:

```css
--role-artist-text:     var(--accent-text);
--role-venue-text:      var(--role-venue);
--role-promoter-text:   var(--role-promoter);
--role-advertiser-text: var(--role-advertiser);
```

`--role-fan-text` is absent. Fan is the **most common account type** — it is
the default every new member gets — so this is the pair most likely to be
reached for, and the only one missing.

Why it matters: the readme states each role has a `*-text` pair "tuned for
cream, same method as `--accent-text`", and that the fill and the copy token
are never interchangeable. A consumer following that instruction writes
`var(--role-fan-text)`, gets an invalid value, and the declaration is dropped
— the text silently falls back to inherited ink. The role tint disappears with
no error.

**Fan violet `#8a4fd6` on cream `#f0dfb8` measures about 4.6:1** — it passes AA
for normal text, but only just, and it is the tightest of the four. That is
probably why it was left out: someone measured it, hesitated, and never came
back. The hesitation is the reason to define it explicitly rather than leave
it undefined.

Two ways to close it, both one line:

```css
/* If the measured fill is acceptable — matches venue/promoter/advertiser,
   which all alias their fill directly. */
--role-fan-text: var(--role-fan);

/* If 4.6:1 is too tight for body copy — darkened, same method as
   --accent-text (#923319 from #ff5029). */
--role-fan-text: #6b3aa8;   /* ≈ 7.2:1 on --bg-base */
```

The second is more consistent with the accent's own treatment: the accent has
a separate darker copy token precisely because the fill failed as text. If fan
violet is the marginal one, it deserves the same handling rather than an alias.

**Current workaround in `Console Surfaces.dc.html`:** using `var(--role-fan)`
directly, in one place (the Onboarding account row). Revert to
`var(--role-fan-text)` once defined.

---

## 2. `--line-strong` is a name that invites itself

There is no `--line-strong`. The tokens are:

```css
--line:   rgba(28,20,8,.12);
--line-2: rgba(28,20,8,.2);
```

I wrote `--line-strong` 18 times across eight screens without noticing,
because the readme's Borders section describes exactly that concept in words
—"Default separator" and "Stronger separator" — without naming the tokens. The
name follows from the prose; it just isn't the name in the file.

The failure is silent and severe. `border: 1px solid var(--line-strong)` is
invalid at computed-value time, so the **entire shorthand is dropped** and
`border-style` computes to `none` — not to a default border, to no border at
all. On those eight screens that removed two text inputs' outlines, four
outline buttons, six chips, three dividers and a badge. Everything still
laid out correctly, so nothing looked broken; the fields just looked like
unstyled text on cream.

Worth doing one of:

- **Add the alias.** `--line-strong: var(--line-2);` One line, and the name
  the prose implies now resolves.
- **Name the tokens in the readme.** The Borders section describes both
  separators without ever printing `--line` or `--line-2`.

Same class of problem as the role pair: the guide describes a concept, the
token file names it differently, and the consumer's reasonable guess fails
quietly.

---

## 3. The Borders section still describes the navy palette

From the readme, under **Borders & Dividers**:

```
Default separator:  1px solid rgba(255,255,255,0.06)
Stronger separator: 1px solid rgba(255,255,255,0.14)
```

Those are **white at low alpha** — correct for the navy "Bulletin" ground,
invisible on cream. The actual tokens are dark ink at low alpha, which the
console pass got right. The prose was not updated with them.

Anyone who follows the readme rather than reading `colors.css` paints white
dividers on a cream board and sees nothing. This is the same failure that
`MapSheet.jsx` shipped with — on-walnut ink at 7% on a light sheet — so it has
already happened once in this system's own components.

The Hover/Press section below it has the same problem: "background lightens to
`bg3` (rgba(255,255,255,~5%))" describes lightening on a dark ground. On cream,
hover darkens.

---

## Pattern

All three are the same shape: **the prose and the tokens disagree, and the
tokens are right.** The readme is carrying language from the navy era and
describing concepts it does not name. A consumer who reads the guide and
writes what it describes produces invalid CSS that fails without a warning.

Cheapest fix, in order of value:

1. Print the real token names in the Borders, Hover and Cards sections.
2. Add `--role-fan-text` and `--line-strong`.
3. Re-measure the four role hues on cream and record the numbers next to them,
   so the next person doesn't have to hesitate over fan violet the way whoever
   left it out did.
