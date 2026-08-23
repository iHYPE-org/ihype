# Migration order

Six phases. Each has a gate. **Do not start a phase until the previous gate
passes** — the reason previous attempts produced unusable results is that
everything moved at once, so nothing could be verified against anything.

Phases 1–2 are the ones that matter. If you do only those, the design is
already 80% landed, because almost all visible drift is token drift.

---

## Phase 1 — Land the tokens (half a day)

Copy `css/ihype-console.css` into `src/styles/`. Import it first in
`app/layout.tsx`, before `globals.css`. Change nothing else.

**Gate:** the app's background is cream `#f0dfb8`, body text is `#1c1408`, and
body type is Work Sans. Inspect `<body>` in devtools and confirm the computed
values literally. If the ground is still the old navy, your import order is
wrong or something downstream is overriding `body`.

*Expect this phase to look broken.* Existing hardcoded colours are now fighting
the new ground. That is the drift becoming visible, which is the point.

---

## Phase 2 — Turn on the linter and measure (half a day)

```bash
cp lint/_adherence.oxlintrc.json .oxlintrc.json
npm i -D oxlint && npm run lint:design
```

**Gate:** you have a number. Commit it to the PR description. That number is
your drift debt, and it is the only honest measure of how far production is
from the design.

Wire `lint:design` into CI as a **warning** now, and flip it to an **error**
at the end of Phase 4. Flipping it early blocks all other work; never flipping
it means this whole exercise decays within a quarter.

---

## Phase 3 — Token-swap the leaves, mechanically (1–2 days)

Find and replace hardcoded values with tokens, bottom-up: leaf components
before containers. This is mechanical, not creative — **no layout changes
allowed in this phase.** Any diff that moves an element is out of scope.

Substitution order, most-common-first:

```
#0b1220 → var(--bg-base)          (old navy ground)
#eef1f6 → var(--ink-1)            (old off-white ink)
#ff5029 → var(--accent)  as fill
        → var(--accent-text)  as text   ← check every instance individually
border-radius: 18px → var(--radius-panel)
border-radius: 12px → var(--radius-panel)   on cards/rows/stats
Bricolage Grotesque → var(--font-display)   (now Instrument Serif)
```

**Gate:** lint warning count is down by at least half, and no screenshot has
changed layout — only colour, type and radius. Diff screenshots before/after.
If an element moved, you did too much.

---

## Phase 4 — Materials (2–3 days)

Now the structural part. Apply the console material classes to the chrome:

- Player dock, full player, nav, map frame → `.walnut-panel` / `.mmm-console`
- Album art → `.walnut-plate` (brass ring is in the class; don't add one)
- Bezels, transport keys → `.brass-hardware`
- Map surface → `.map-parchment`

Then sweep every walnut surface and repoint its ink to
`--ink-on-walnut(-2/-3)`.

**Gate:** grep the diff for `--ink-1`, `--ink-2`, `--ink-3` inside any element
that has a walnut class in its ancestry. Zero results, or you have unreadable
text. Flip `lint:design` to an error in CI at the end of this phase.

---

## Phase 5 — The tuner dial (2–3 days)

The signature control, and the only phase with real interaction work: drag,
wheel, brass keys stepping by one, roving tabindex.

Use `.tuner-dial`, `.tuner-scale`, `.tuner-ticks`, `.tuner-needle`,
`.tuner-step` verbatim. The multi-layer radial-gradient face is not
reproducible by approximation — if you find yourself writing a gradient, you
have gone wrong.

**Gate:** `role="tablist"` of `role="tab"`, not `role="slider"`. Keyboard
arrows move between stations and announce the destination *name*. Drag and
wheel both tune. 44px minimum on every brass key.

---

## Phase 6 — Screen by screen (ongoing)

Only now, one screen at a time, against the design references. Order by
traffic, not by ease.

**Gate, per screen:** side-by-side against its design reference at 375px and
at 1280px. Check the five failure modes from `RULES.md`: walnut ink, accent
as text, panel radius, 15px floor, undeclared props.

---

## What "done" looks like

```
npm run lint:design    →  0 warnings, enforced in CI as an error
```

Plus: `ihype-console.css` has never been edited in the repo, and `CLAUDE.md`
is at the root so the next change — yours or a model's — starts from the
contract instead of from a guess.
