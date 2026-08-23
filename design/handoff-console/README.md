# Getting the iHYPE console design into production without drift

**Generated 2026-08-22 from the iHYPE Design System (console direction, 2026-08-20).**

---

## Why it keeps drifting

You have been handing over a *description* of the design and asking someone —
a person or a model — to re-derive it. Re-derivation always drifts, because
every value is a decision and a re-implementer has to make all of them again
with less context than you had.

Four specific failure modes, all fixable:

1. **The design is prose, so it gets interpreted.** "Warm cream ground, brass
   bezels, machined 3px corners" is a paragraph a competent developer will
   honour approximately. `--bg-base: #f0dfb8` is not approximable.
2. **The prose contradicts the tokens — in four places.** The design system's
   `readme.md` says Bricolage Grotesque is the display face; `typography.css`
   says Instrument Serif is, and that *Bricolage is retired.* An implementer
   reading the readme ships the wrong typeface and is not being careless — the
   source lied. Three more of these are catalogued in `CONTRADICTIONS.md`,
   including the breakpoint ambiguity that produces invented media queries.
   In every case the prose is stale and the tokens are current, which is the
   whole argument for generating rather than describing.
3. **Nothing fails when it drifts.** A wrong hex compiles, deploys, and looks
   plausible. Drift that costs nothing is drift that accumulates.
4. **The handoff has no seam.** If production CSS and design CSS are two
   hand-maintained copies, they diverge on the first hotfix, permanently.

## The fix, in one sentence

**Stop shipping a description. Ship `css/ihype-console.css` and `components/`
as code to be copied, make everything downstream read `var(--token)`, and let
the linter fail the build when someone types a hex.**

That is the correction to the first version of this package, which was still
mostly prose. Code cannot recreate a design from a description — it can only
copy code. So the deliverable is code: the token bundle, and 37 components that
actually read it.

That converts drift from a judgement call into a compile error.

---

## What is in this package

| Path | What it is | What to do with it |
|---|---|---|
| `css/ihype-console.css` | All 8 token files concatenated verbatim — colors, type, spacing, radii, walnut/brass materials, motion, breakpoints, base reset. 33KB. | Copy into the repo. Import once, first. Never edit. |
| `RULES.md` | The implementation contract. Written to be dropped into the production repo as `CLAUDE.md` / `AGENTS.md` / `.cursorrules`. | Commit at repo root. This is the file that constrains every future AI change. |
| `PHASES.md` | Migration order, with a verification gate after each phase. | Work top to bottom. Do not skip gates. |
| `lint/_adherence.oxlintrc.json` | Machine-checkable adherence rules: raw hex, raw px, non-system fonts, and the exact prop signature of all 37 components. | Wire into CI. This is the enforcement. |
| `TAILWIND.md` | Token→Tailwind theme bridge. | Only if the repo uses Tailwind. |
| `CONTRADICTIONS.md` | Four places the design system disagrees with itself, each resolved. | Read before Phase 3. Fix at source when you can. |
| `APPLY.md` | **Do this.** The ordered path: fix the two stale sources, replace the design system's component sources and recompile, vendor the three shipped-ahead surfaces, then work the drift audit. Includes what NOT to do. | Start here. |
| `components/core/` + `components/shell/` | **All 37 components, re-anchored — laid out as a drop-in replacement for the design system's own folders.** `RotaryNav`, `TunerDial` and `JoystickTransport` now default to the shipped dock geometry (74px knobs, matched). Keep the existing `.d.ts` files; replace the `.jsx` only. — 6 of 37 read tokens before, 36 of 37 now. Plus `RotaryNav` / `TunerDial` / `JoystickTransport` rebuilt as real instrument hardware, and the keyframes they need. | Drop into the repo. Prop signatures are unchanged, so no call site breaks. |
| `DESIGN_GAP.md` | **Start here.** Where production's design actually stands, read from `mmm.css` and the repo's own drift audit. Corrects two of my earlier conclusions: production is token-disciplined, and it is AHEAD of the design system in three places. | Work its corrected order. |
| `api/RECONCILIATION.md` | **Read this before any backend work.** What production actually has (read from `iHYPE-org/ihype@main`) versus what the design system's `engineering/` copy claims. Production is far ahead; the copy is stale and misled me for two rounds. | Act on the corrected order at the end. |
| `BACKEND.md` | §§5–8 stand (data contract, state matrix, write paths). §§1 and 4 are superseded by the reconciliation. The API contract has drifted from the product the same way the components had — three blocking contradictions, the endpoints the design needs that don't exist, the component data contract, state matrix and write paths. | Resolve §1, then work the suggested order at the end. |
| `api/openapi.yaml` | **The corrected API contract (v0.2.0).** HYPE respecified as 24h per target, role enums fixed, ticket schema added, 18 missing endpoints added, 6 dead ones removed, the charter split typed as `const` so it cannot drift. | Diff against `engineering/openapi.yaml` and adopt. |
| `api/schema.sql` | **Corrected Postgres schema (v0.2.0).** HYPE rewritten as 24h-per-target with the rule in one function, ticket credential split from its id, the charter enforced by CHECK constraints, k≥5 in the query layer. | Adopt with the migration below. |
| `api/migration-v0.2.0.sql` | Takes a live database from v0.1.0 to v0.2.0. Snapshot first — two steps are irreversible. | Read every step before running any of it. |
| `api/CHANGES.md` | Every change and why, including the one judgement call. | Read before adopting. |
| `types.d.ts` | The wire format and the component-facing shapes, as two deliberately separate layers. | Drop in as the shared contract. |
| `VERIFICATION.md` | The before/after audit, the three documented residues, and the 11 live bugs the re-anchor surfaced. | Read before Phase 4. |
| `STRATEGY.md` | **Withdrawn** — see `DESIGN_GAP.md`. Kept for the general reasoning about why Code drifts in a multi-generation codebase. Why an incremental token migration fights a losing battle there, and the clean-route-tree alternative that keeps the backend untouched. | Decide between this and `PHASES.md` before starting. |

### Which plan applies to you

`PHASES.md` assumes production has **one** visual generation to migrate.
`STRATEGY.md` is for when it has **three** — where every file Code reads
teaches it the old design, and the majority vote beats any rules file. If you
recognise the second case, read `STRATEGY.md` first; `PHASES.md` then applies
inside the new route tree rather than across the whole app.

Two live pages in the design project accompany these:

- **Token Proof Sheet** — every material, ink pair, contrast trap, radius and
  type step rendered straight from the token files. Your Phase 1 gate.
- **Component Diff Harness** — each component rendered live beside a slot you
  drop production screenshots into, with its lint-enforced prop signature
  above it. Your Phase 6 gate, and a standing record of what still differs.

---

## About the design files

The HTML/DC files in this design project are **design references** — prototypes
showing intended look and behaviour. They are not production code to paste in.

**But the CSS token bundle is different.** `css/ihype-console.css` *is*
production code, and it should be copied byte-for-byte rather than reinterpreted.
That distinction is the whole point of this package: recreate the *markup and
components* in the repo's own idiom (React/Next, its own file layout, its own
data layer), and take the *values* as given.

Fidelity: **high**. Every colour, size, radius, easing curve and duration in the
bundle is final and measured — the contrast ratios are annotated inline in the
comments. Treat any deviation as a bug, not a preference.

---

## Install (Next.js app router, ~10 minutes)

```bash
# 1. Land the bundle
mkdir -p src/styles
cp css/ihype-console.css src/styles/ihype-console.css

# 2. Land the contract at the repo root
cp RULES.md CLAUDE.md          # or AGENTS.md, whichever your tooling reads

# 3. Land the linter
cp lint/_adherence.oxlintrc.json .oxlintrc.json
npm i -D oxlint
```

```tsx
// 4. src/app/layout.tsx — FIRST import, before globals.css
import '../styles/ihype-console.css';
import './globals.css';
```

```json
// 5. package.json
"scripts": {
  "lint:design": "oxlint --config .oxlintrc.json src"
}
```

```yaml
# 6. .github/workflows/ci.yml — the step that makes drift cost something
- run: npm run lint:design
```

Then run `npm run lint:design` once and read the output. The count of warnings
*is* your drift measurement. Write it down. It should only ever go down.

---

## The three material rule (the one thing people get wrong)

The console is not one palette. It is **three materials**, and ink comes from
the material it sits on:

| Material | Surface tokens | Ink tokens | Used for |
|---|---|---|---|
| **The board** (cream) | `--bg-base` `--bg-surface` `--bg-raised` `--bg-overlay` | `--ink-1` `--ink-2` `--ink-3` | Page ground, every card / row / stat |
| **Walnut** | `--walnut` `--walnut-2` `--walnut-3` | `--ink-on-walnut` `-2` `-3` | Console chrome: player dock, full player, nav, map frame |
| **Brass / lamp** | `--brass` `--brass-deep` `--lamp` | — | Bezels, transport keys, pilot lamps, hairlines on walnut |

**Never pair `--ink-1/2/3` with a walnut surface.** The shipped app has a lint
guard for exactly this. Walnut is a dark material; board ink on it is
unreadable, and it is the single most common mistake in every previous attempt.

The map is a fourth surface with its own tokens (`--map-void`, `--map-ink`,
`--map-line`, `--map-pin`) — aged chart, not walnut and not the board.

---

## The accessibility traps, stated once

These are the three places where the obvious choice is the wrong one. They are
annotated in the CSS, but they are worth reading before you start, because in
each case the wrong version looks fine to a designer's eye and fails an audit.

1. **`--accent` (#ff5029) is a fill, never a word.** On cream it measures
   2.48:1 and fails AA as text. Any accent-coloured *copy* uses
   `--accent-text` (#923319, 5.89:1).
2. **Ink on the accent fill is dark, not white.** `--ink-on-accent` (#1c1408).
   White on #ff5029 is 3.27:1 and fails everywhere, including on the button it
   used to sit on.
3. **`--ink-4` (#a3906a) is 2.65:1 — hairlines only, never text.** The floor
   for a word on the board is `--ink-3`; on walnut it is `--ink-on-walnut-3`.

Related: the **content floor is 15px** (`--text-base`). A dial readout, a form
label, an error message is content, not an eyebrow. The only exemption is
tracked mono metadata (`--text-xs`, 11px, all-caps, `--font-mono`).

---

## Radii, because this one is counterintuitive

`--radius-panel` is **3px**, and it is what every card, row, stat and section
panel reads. It used to be 18px. A console is machined: panels have a cut edge,
not a moulded one.

`--radius-pill` (9999px) is deliberately untouched — a button that reads as a
key still reads as a key. `--radius-card` is a legacy alias pointing at
`--radius-panel`; both names are safe.

The temptation, every single time, is to "soften" 3px back to 8 or 12 because
it looks severe in isolation. It is not severe in context. Leave it.

---

## Components

37 components have machine-checked prop signatures in
`lint/_adherence.oxlintrc.json`. That file is the component contract — it is
more reliable than any table I could write here, because the linter reads it.

To see what `<Button>` accepts, search that file for `name.name='Button'`:

> Declared props: `children, tone, accent, disabled, leading, full, onClick`
> — and `tone` must be `solid | ghost | outline`.

Adding a prop that isn't declared is a lint warning, which is the signal that
you are about to fork a component instead of using it.

Console chrome components — `TunerDial`, `RotaryNav`, `JoystickTransport`,
`FullPlayer`, `PlayerPill`, `LogoTrigger` — have verbatim CSS in the bundle
(`.tuner-dial`, `.walnut-panel`, `.walnut-plate`, `.mmm-console`,
`.map-parchment`, `.brass-hardware`, `.dock-ash-cap`). **Use those classes.
Do not restate their gradients ad hoc** — they are multi-layer background
stacks with blend modes, and a hand-rolled approximation is instantly visible.

One accessibility note carried from the source: the tuner dial is a
`role="tablist"` of `role="tab"` with roving tabindex, **not** `role="slider"`.
A slider announces a number where this needs a destination name.

---

## Mobile

375px is the floor, not the edge case. **620px is the app shell's one
breakpoint** — the only one baked into a token, where the safe-area insets
flip. The `--bp-*` scale (480/768/1024/1280/1536) belongs to the marketing
site, not the console. Anything else is invented; see `CONTRADICTIONS.md` §2.
44px touch targets. `dvh`, never `vh`. Safe areas come from `--pane-pad`, `--chrome-l`,
`--chrome-r`, `--player-l` — which already contain their
`env(safe-area-inset-*)` calls. Consume them; do not re-derive them.

```css
/* right */                          /* wrong */
padding: var(--pane-pad);            padding: calc(16px + env(safe-area-inset-top)) 16px 100px;
```

---

## When you next change the design

Change it in the design system, regenerate `ihype-console.css`, copy it in,
run `lint:design`. Do not hand-patch the repo copy — that is the moment the
two versions start diverging, and every previous attempt has died there.
