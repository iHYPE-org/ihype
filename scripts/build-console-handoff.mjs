#!/usr/bin/env node
/**
 * Generates `design/console-2026-08/HANDOFF.md` — the console/hi-fi spec that
 * goes BACK to Claude Design.
 *
 * ## Why this is generated and not written
 *
 * Every design document in this repository that was written by hand has gone
 * stale, and two of them went stale in a way that actively caused damage:
 * `SHELL_LOCK` said the shell was frozen after the owner had asked for it to
 * change, and CLAUDE.md said the overhaul required "nothing structural" while
 * the chrome was being rebuilt. A spec that names a hex, a ratio or a class
 * list is a copy of the code, and copies drift.
 *
 * So this reads the real stylesheets, extracts the real values, MEASURES the
 * contrast rather than quoting it, and runs the design audit to list what is
 * currently wrong in the templates. Re-run it and the document is true again.
 *
 * `npm run design:handoff`
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const css = await readFile('src/app/globals.css', 'utf8');
const mmm = await readFile('src/app/mmm.css', 'utf8');

/* ── Contrast, measured ─────────────────────────────────────────────────── */
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(hex(a)), lum(hex(b))].sort((x, y) => y - x);
  return ((hi + 0.05) / (lo + 0.05)).toFixed(2);
};

/** A `--token: #value;` lookup over the real `:root`, comments stripped. */
const root = css.replace(/\/\*[\s\S]*?\*\//g, '');
const tok = (name) => {
  const m = new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6}|[^;]+);`).exec(root);
  return m ? m[1].trim() : null;
};

/** A whole rule, verbatim, so the spec ships real code rather than a summary. */
function rule(source, selector) {
  const i = source.indexOf(`\n${selector} {`);
  if (i < 0) return null;
  const end = source.indexOf('\n}', i);
  return source.slice(i + 1, end + 2).trim();
}

/* ── What the templates currently get wrong ─────────────────────────────── */
let findings = '(audit did not run)';
try {
  const { stdout } = await run('node', ['scripts/audit-design-templates.mjs']);
  findings = stdout.split('\n')
    .filter((l) => /ADHERENCE §/.test(l))
    .map((l) => `- ${l.trim()}`)
    .join('\n') || '- none';
} catch (error) {
  findings = `(audit failed: ${String(error).slice(0, 80)})`;
}

const GROUND = tok('--bg');
const INK = tok('--ink');
const WALNUT = tok('--walnut');
const WALNUT2 = tok('--walnut-2');
const WALNUT3 = tok('--walnut-3');
const BRASS = tok('--brass');
const BRASS_DEEP = tok('--brass-deep');
const LAMP = tok('--lamp');
const ON_WALNUT = tok('--ink-on-walnut');
const ON_WALNUT2 = tok('--ink-on-walnut-2');
const ON_WALNUT3 = tok('--ink-on-walnut-3');
const ACCENT = tok('--accent');
const ACCENT_TEXT = tok('--accent-text');
const ON_ACCENT = tok('--ink-on-accent');

const doc = `# iHYPE console / hi-fi — design handoff

**Generated from the live stylesheets by \`npm run design:handoff\`. Do not edit
by hand — re-run it.** Every hex below was read out of \`src/app/globals.css\`
and every ratio was computed, not quoted.

This document goes back to Claude Design so templates can be redesigned in the
console scheme. It is the answer to "what does the code actually do".

---

## 1 · There is ONE ground

The light/dark/console themes were collapsed into a single ground on
2026-08-19. There is no theme switcher, no \`prefers-color-scheme\`, and no
\`[data-theme]\` block. A template must not offer an appearance choice.

| Role | Token | Value | On ground |
|---|---|---|---|
| Ground | \`--bg\` | \`${GROUND}\` | — |
| Body ink | \`--ink\` | \`${INK}\` | **${ratio(INK, GROUND)}:1** |

\`html.high-contrast\` still exists and is **not a theme** — it is an
accessibility mode with its own black ground. Do not design for it; do not
remove it.

---

## 2 · Materials — the part that makes it hi-fi

The console look is not "a warm palette". It is **three materials** used for
three different kinds of object. Getting this wrong is what makes a page look
like a beige website instead of a receiver.

| Material | Token | Value | Used for |
|---|---|---|---|
| Walnut (lightest) | \`--walnut\` | \`${WALNUT}\` | cabinet face, top of gradient |
| Walnut mid | \`--walnut-2\` | \`${WALNUT2}\` | full-player ground |
| Walnut dark | \`--walnut-3\` | \`${WALNUT3}\` | recessed wells, control glyphs |
| Brass | \`--brass\` | \`${BRASS}\` | bezels, transport, step keys |
| Brass deep | \`--brass-deep\` | \`${BRASS_DEEP}\` | the shadow side of a bezel |
| Lamp | \`--lamp\` | \`${LAMP}\` | pilot lamps, lit state, hover |

### Walnut is DARK in every context — it needs its own ink

This is the single most important rule in this document, and it has already
caused one shipped bug (the player dock painted dark ink on a near-black bar
for weeks).

| Token | Value | On \`--walnut\` |
|---|---|---|
| \`--ink-on-walnut\` | \`${ON_WALNUT}\` | **${ratio(ON_WALNUT, WALNUT)}:1** |
| \`--ink-on-walnut-2\` | \`${ON_WALNUT2}\` | **${ratio(ON_WALNUT2, WALNUT)}:1** |
| \`--ink-on-walnut-3\` | \`${ON_WALNUT3}\` | **${ratio(ON_WALNUT3, WALNUT)}:1** — the floor for a WORD |

Ratios are against \`--walnut\`, the **lightest** stop of the gradient. Copy can
land anywhere on a gradient, so the worst case is the only one worth quoting.

**Never put \`--ink\`, \`--ink-2\` or \`--ink-3\` on a walnut surface.** There is a
lint rule that fails the build on it.

Hairlines and rails on walnut: \`--rule-on-walnut\` / \`--rule-on-walnut-2\`.
The page's \`--line\` / \`--hair-*\` are dark alphas and vanish into timber.

---

## 3 · The accent is a FILL, never a word

\`--accent\` is \`${ACCENT}\`. On the cream ground it measures
**${ratio(ACCENT, GROUND)}:1** — it fails AA as copy and fails even the 3:1
large-text bar.

| Job | Token | Value | Measured |
|---|---|---|---|
| The fill | \`--accent\` | \`${ACCENT}\` | — |
| The accent as a WORD | \`--accent-text\` | \`${ACCENT_TEXT}\` | ${ratio(ACCENT_TEXT, GROUND)}:1 on ground |
| A label ON the fill | \`--ink-on-accent\` | \`${ON_ACCENT}\` | ${ratio(ON_ACCENT, ACCENT)}:1 on accent |

\`--ink-on-accent\` is **dark ink, not white**. White on this accent is 3.27:1
and fails. This surprises people; it is measured.

The same split exists for \`--warning-text\`, \`--danger-text\` and
\`--success-text\`. A fill token and a copy token are different tokens even when
the hex matches.

---

## 4 · Components, as real CSS

Copy these verbatim. They are what ships.

### The walnut panel and its edges

\`\`\`css
${rule(css, '.walnut-panel') ?? '(missing)'}

${rule(css, '.walnut-lip-top') ?? '(missing)'}

${rule(css, '.walnut-frame') ?? '(missing)'}

${rule(css, '.walnut-plate') ?? '(missing)'}
\`\`\`

The **88° grain is not 90°** on purpose: exactly vertical reads as a UI stripe
pattern, a couple of degrees off reads as cut timber.

### The tuner dial — the signature control

It replaces every horizontal tab strip. A strip divides one row by the number
of tabs, so each tab added shrinks every label; the dial spends the same row on
**one** destination at 26px and does not shrink when a section is added.

\`\`\`css
${rule(css, '.tuner-dial') ?? '(missing)'}

${rule(css, '.tuner-station') ?? '(missing)'}

${rule(css, '.tuner-scale') ?? '(missing)'}

${rule(css, '.tuner-ticks') ?? '(missing)'}

${rule(css, '.tuner-needle') ?? '(missing)'}

${rule(css, '.tuner-step') ?? '(missing)'}
\`\`\`

**The scale is infinite for free.** Two \`repeating-linear-gradient\`s whose
\`background-position\` is driven by the drag — no cloned strip, no seam,
stations wrap in both directions. The 46px major pitch is also the drag
distance per station; the two must move together.

**Semantics:** \`role="tablist"\` of \`role="tab"\` buttons with roving tabindex —
**not** \`role="slider"\`. A slider announces a number where a member needs a
destination name.

### The cabinet (app chrome)

\`\`\`css
${rule(mmm, '.mmm-console') ?? '(not on this branch — see PR #733)'}
\`\`\`

---

## 5 · Type

- **Content floor is 15px** (\`0.9375rem\`). Enforced; the build fails below it.
- **Eyebrow exemption:** tracked mono only — monospace family **and**
  \`letter-spacing >= 0.14em\` — down to **11px**. Metadata only. A form label, an
  error message or a status readout is **content**, not an eyebrow.
- Three-step hierarchy: **Bricolage Grotesque** display for the page,
  **Instrument Serif** (\`--f-s\`) for section headings (\`h2\`), **Work Sans** for
  prose, **JetBrains Mono** for eyebrows.
- Sizes in \`rem\`, never \`px\` — the root font size carries the reader's Text
  size setting and iOS Dynamic Type, and \`px\` cannot follow it.

---

## 6 · Rules a template must not break

1. **No emoji.** Unicode glyphs (\`▶ ❚❚ ♥ ✕ ✓ ★ ⬟ ♪\`) are the vocabulary.
2. **There is no DJ role.** Deleted from the product 2026-08-06.
3. **Promoter is not an account type.** It is a 10% payout share. \`--role-promoter\`
   colours that slice and nothing else.
4. **No white on the accent fill.** Use \`--ink-on-accent\`.
5. **No appearance/theme switcher.** One ground.
6. **70 / 20 / 10 / 0%** — artist / venue / promoters / iHYPE. Never restate it
   differently.
7. **Audio only.** No video anywhere.
8. **admin@ihype.org** and **ihype.org** are the only contact and domain.

---

## 7 · What is currently WRONG in the templates

Run \`npm run audit:design\` for the live list. As of this generation:

${findings}

These are design defects and must be fixed **in Claude Design and re-vendored**
— correcting them in \`.tsx\` is undone by the next session that faithfully
applies the template.

---

## 8 · What the code still does NOT have

Honest gaps, so a template does not assume them:

- **Transport knob** with drag gestures (tap play/pause, drag for next/prev,
  drag up for the full player) — not built.
- **Full player artwork in a brass bezel** — the full player is on walnut, but
  the cover does not yet carry the \`.walnut-plate\` bezel.
- **The map** is a real interactive map, not the prototype's stylised canvas.
- **Marketing, legal and admin routes** carry the palette and type but not the
  cabinet. Only the app shell is furniture.
`;

await writeFile('design/console-2026-08/HANDOFF.md', doc);
console.log(`Wrote design/console-2026-08/HANDOFF.md (${doc.length} chars)`);
