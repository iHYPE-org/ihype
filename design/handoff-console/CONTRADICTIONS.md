# Known contradictions in the design system

Found while assembling this package, 2026-08-22. **Each of these is a place
where two files in the design system disagree, so an implementer can be
diligent and still ship the wrong thing.** That is a meaningful share of the
drift you have been seeing: it is not always carelessness downstream, it is
sometimes ambiguity upstream.

Resolutions below are what `RULES.md` and `css/ihype-console.css` encode.
Fix them at the source too, or they will keep re-emerging.

---

## 1. The display typeface — readme vs. tokens

| Source | Claim |
|---|---|
| `readme.md` → VISUAL FOUNDATIONS → Typography | "**Bricolage Grotesque** — display face. Variable, with an optical-size axis… Weight 800 for headlines and the wordmark, 600 for nav pills" |
| `tokens/typography.css` | `--font-display: 'Instrument Serif', …` and, in comment: "Instrument Serif is the display face… **Bricolage Grotesque is retired**" |
| `tokens/fonts.css` | No Bricolage `@font-face` at all. Comment: "Bricolage Grotesque is **GONE, not merely unused**" |
| `_adherence.oxlintrc.json` | Permitted fonts: Work Sans, JetBrains Mono, Instrument Serif — Bricolage would be a lint error |

**Resolved: Instrument Serif.** The tokens, the webfont loader and the linter
all agree; only the readme prose is stale.

Consequences the readme also gets wrong:
- **Weight 800 does not exist.** Instrument Serif ships 400 regular + 400
  italic only. Any `font-weight: 800` on display type is silently synthesising
  a fake bold — which is the "fonts fall back or get swapped" symptom.
- **`--tracking-display` (−.035em) should not be applied to it.** That
  negative tracking exists for Bricolage, which sets wide by default.
  Instrument Serif is already tight. Set `letter-spacing: normal` locally.
  The token is retained only for old marketing templates that still load
  Bricolage themselves.
- **The `--opsz-*` tokens are inert** for console work. Instrument Serif has
  no optical-size axis.

**Fix at source:** update the readme's Typography section, and delete or
clearly quarantine `--tracking-display` / `--opsz-*`.

---

## 2. Breakpoints — six or one?

| Source | Claim |
|---|---|
| `tokens/breakpoints.css` | Six: `--bp-xs` 375, `--bp-sm` 480, `--bp-md` 768, `--bp-lg` 1024, `--bp-xl` 1280, `--bp-2xl` 1536 |
| `readme.md` → Mobile, and `MOBILE.md` | "**one breakpoint at 620px**" |
| `tokens/spacing.css` | The only media query in the whole token set is `@media (min-width: 620px)`, which re-declares `--pane-pad`, `--chrome-l`, `--chrome-r`, `--player-l` |

**Resolved, and it is not actually a conflict once stated properly:**

- **620px is the *app shell's* breakpoint** — the one that moves the console
  from phone layout to larger. It is the only breakpoint baked into a token,
  and the safe-area insets flip there. **Use 620px for all console chrome.**
- **The `--bp-*` scale belongs to the marketing site** (landing, charter,
  about, advertise) where a conventional responsive grid is appropriate.
- **Anything else is invented.** If you find yourself writing `@media
  (min-width: 900px)`, stop.

This is the "mobile breakpoints get invented" failure mode, and it happens
because the token file advertises six options without saying which surface
each belongs to.

**Fix at source:** add that scoping note to `breakpoints.css`. It currently
says only "use the px values directly in @media", which reads as permission.

---

## 3. `--radius-card` — 18px or 3px?

| Source | Claim |
|---|---|
| `readme.md` → CHANGELOG v8 | "Token additions: `--radius-card` (18px)" |
| `readme.md` → Cards & Panels, and `tokens/spacing.css` | `--radius-card: var(--radius-panel)` — i.e. **3px**, "kept as a legacy alias" |

**Resolved: 3px.** The v8 changelog entry is historical and describes the
superseded Bulletin direction. The console pass (2026-08-20) repointed the
alias. Both names are safe to use today and both give 3px.

Worth knowing because "18px" appears in a changelog that reads like current
documentation, and 18px is exactly the kind of value someone restores when
3px looks too severe in isolation.

---

## 4. Separator colours are documented for the old dark ground

`readme.md` → Borders & Dividers still says:

> Default separator: `1px solid rgba(255,255,255,0.06)`
> Stronger separator: `1px solid rgba(255,255,255,0.14)`
> Hover: background lightens to `bg3` (rgba(255,255,255,~5%))

**These are white-on-dark values from the retired navy direction.** On the
cream board they are invisible. The tokens are right:

```css
--line:   rgba(28,20,8,.12);   /* default separator */
--line-2: rgba(28,20,8,.2);    /* stronger */
/* hover on the board: --hair-50, rgba(28,20,8,.05) — ink at low alpha,
   because white would wash the cream out rather than lift it */
```

**Fix at source:** the Borders, Hover/Press and Backgrounds subsections of the
readme all still describe the dark ground.

---

## Why this list matters more than it looks

Four contradictions, and in every case the *prose* is stale and the *tokens*
are current. That is the structural argument for this whole package: prose
documentation of a design system decays silently, and generated CSS plus a
linter does not.

Reading order for anyone implementing: **tokens first, linter second, prose
last and sceptically.**
