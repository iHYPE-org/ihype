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

/* ── The same spec, as a page ────────────────────────────────────────────
 * Markdown is the version a session reads. This is the version a DESIGNER
 * reads, and the difference is not styling: a spec about materials should
 * show the materials. Every swatch below is the real token value, every ratio
 * is computed above, and the dial is the real control — draggable, so the
 * interaction can be felt rather than described.
 *
 * Single-theme on purpose. The document's own first rule is that there is one
 * ground; a page that offered light and dark would be contradicting the thing
 * it specifies. So the palette is stated explicitly and the page holds on any
 * host background.
 */
const findingRows = findings.split('\n').filter((l) => l.startsWith('- ')).map((l) => {
  /* No leading `-` in this pattern: the `- ` prefix is added when the audit
     output is collected and is stripped again by `slice(2)` right here.
     Matching it as well left every row unparsed, so all five columns
     collapsed into one colspan cell under five correct headers. */
  const m = /^(\d+)\s+(\S+)\s+in (\d+) template\(s\) — (ADHERENCE §\d+) — (.+)$/.exec(l.slice(2).trim());
  return m
    ? `<tr><td class="num">${m[1]}</td><td><code>${m[2]}</code></td><td class="num">${m[3]}</td><td>${m[4]}</td><td>${m[5]}</td></tr>`
    : `<tr><td colspan="5">${l.slice(2)}</td></tr>`;
}).join('\n');

const swatch = (name, value, note) =>
  `<div class="sw"><span class="chip" style="background:${value}"></span>
     <code>${name}</code><b>${value}</b><span class="note">${note}</span></div>`;

const page = `<meta charset="utf-8">
<title>iHYPE Console Spec</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,800&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;700&family=Work+Sans:wght@400;600&display=swap">
<style>
:root{
  --bg:${GROUND}; --ink:${INK}; --ink-2:${tok('--ink-2')}; --ink-3:${tok('--ink-3')};
  --walnut:${WALNUT}; --walnut-2:${WALNUT2}; --walnut-3:${WALNUT3};
  --brass:${BRASS}; --brass-deep:${BRASS_DEEP}; --lamp:${LAMP};
  --on-walnut:${ON_WALNUT}; --on-walnut-2:${ON_WALNUT2}; --on-walnut-3:${ON_WALNUT3};
  --accent:${ACCENT}; --accent-text:${ACCENT_TEXT}; --on-accent:${ON_ACCENT};
  --rule:rgba(28,20,8,.18);
  --f-d:'Bricolage Grotesque',system-ui,sans-serif;
  --f-s:'Instrument Serif',Georgia,serif;
  --f-b:'Work Sans',system-ui,sans-serif;
  --f-m:'JetBrains Mono',ui-monospace,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:400 1rem/1.65 var(--f-b);
  -webkit-font-smoothing:antialiased}
.wrap{width:min(78ch,calc(100% - 3rem));margin:0 auto;padding:4rem 0 6rem}
header{border-bottom:3px solid var(--brass);padding-bottom:2rem;margin-bottom:3rem}
.plate{display:inline-block;font:700 .75rem/1 var(--f-m);letter-spacing:.22em;
  text-transform:uppercase;color:var(--walnut-3);background:linear-gradient(180deg,var(--brass),var(--brass-deep));
  padding:8px 14px;border-radius:2px;box-shadow:inset 0 1px 0 rgba(255,244,214,.6)}
h1{font:800 clamp(2.4rem,7vw,4rem)/1.02 var(--f-d);letter-spacing:-.03em;margin:1.2rem 0 .6rem;text-wrap:balance}
.lede{font:400 1.25rem/1.5 var(--f-s);color:var(--ink-2);max-width:56ch;margin:0}
section{margin:3.5rem 0 0}
h2{font:400 2rem/1.15 var(--f-s);letter-spacing:.005em;margin:0 0 .3rem;text-wrap:balance}
h2 .n{font:700 .8125rem/1 var(--f-m);letter-spacing:.2em;color:var(--accent-text);
  display:block;margin-bottom:.7rem}
h3{font:800 1.0625rem/1.3 var(--f-d);margin:2rem 0 .5rem}
p{max-width:66ch}
code{font:400 .9375rem/1.5 var(--f-m);background:rgba(28,20,8,.07);padding:1px 5px;border-radius:2px}
b{font-weight:600}
.rule{border:0;border-top:1px solid var(--rule);margin:3rem 0 0}
/* Swatches */
.sws{display:grid;gap:2px;margin:1.2rem 0;border:1px solid var(--rule);border-radius:3px;overflow:hidden}
.sw{display:grid;grid-template-columns:44px 15rem 6.5rem 1fr;align-items:center;gap:1rem;
  padding:.55rem .8rem;background:rgba(255,255,255,.32)}
.sw .chip{width:30px;height:30px;border-radius:2px;box-shadow:0 0 0 1px rgba(28,20,8,.25)}
.sw code{background:none;padding:0}
.sw b{font:700 .9375rem/1 var(--f-m);font-variant-numeric:tabular-nums}
.sw .note{font-size:.9375rem;color:var(--ink-3)}
/* Specimens */
.spec{margin:1.4rem 0;border-radius:3px;overflow:hidden}
.walnut{background:repeating-linear-gradient(88deg,rgba(30,14,4,.22) 0 1px,transparent 1px 5px,
  rgba(94,56,26,.14) 5px 7px,transparent 7px 15px),
  linear-gradient(180deg,var(--walnut) 0%,var(--walnut-2) 34%,var(--walnut-3) 100%);
  color:var(--on-walnut);padding:1.6rem;
  box-shadow:inset 0 1px 0 rgba(255,214,160,.22),0 18px 40px -18px rgba(0,0,0,.55);
  border:2px solid var(--brass-deep)}
.walnut p{color:var(--on-walnut-2);margin:.4rem 0 0}
.walnut .dim{color:var(--on-walnut-3);font:400 .9375rem/1.5 var(--f-m)}
.plate-demo{width:120px;height:120px;border-radius:2px;background:var(--walnut-3);
  box-shadow:0 0 0 2px var(--brass-deep),0 0 0 5px var(--brass),0 0 0 6px #6d5222,
  inset 0 3px 12px rgba(0,0,0,.7);display:grid;place-items:center;
  font:800 3rem/1 var(--f-d);color:var(--on-walnut);margin:1.4rem 6px}
/* Accent demo */
.accent-row{display:flex;flex-wrap:wrap;gap:.8rem;align-items:center;margin:1.2rem 0}
.pill{background:var(--accent);color:var(--on-accent);font:800 .9375rem/1 var(--f-d);
  padding:12px 20px;border-radius:999px}
.wrong{background:var(--accent);color:#fff;font:800 .9375rem/1 var(--f-d);
  padding:12px 20px;border-radius:999px;position:relative}
.asword{color:var(--accent-text);font:800 1.0625rem/1 var(--f-d)}
.verdict{font:700 .8125rem/1 var(--f-m);letter-spacing:.1em;text-transform:uppercase}
.ok{color:#0a655e}.no{color:#9c2707}
/* The dial */
.dialmount{display:flex;gap:10px;align-items:stretch;margin:1.4rem 0}
.dial{position:relative;flex:1;min-width:0;border-radius:3px;padding:5px 12px 6px;overflow:hidden;
  cursor:grab;touch-action:none;user-select:none;
  background:radial-gradient(150% 200% at 50% 130%,#fff3d4 0%,var(--bg) 42%,#e2cea0 78%,#d4bd8c 100%);
  box-shadow:0 0 0 1px var(--brass-deep),0 0 0 3px var(--brass),0 0 0 4px #6d5222,
    inset 0 2px 5px rgba(92,62,20,.45),inset 0 -1px 0 rgba(255,252,235,.8)}
.dial:active{cursor:grabbing}
.dial::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(150% 90% at 18% -34%,rgba(255,255,255,.55),transparent 56%),
  linear-gradient(174deg,rgba(255,255,255,.3) 0%,transparent 30%)}
.station{display:block;width:100%;border:0;background:none;padding:0;font:400 1.625rem/1.12 var(--f-s);
  letter-spacing:.005em;text-align:center;color:var(--ink);white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;cursor:inherit}
.scale{position:relative;display:block;height:20px;margin-top:2px;overflow:hidden;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent);
  mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)}
.ticks{position:absolute;inset:0;
  background-image:repeating-linear-gradient(90deg,rgba(28,20,8,.85) 0 2px,transparent 2px 46px),
   repeating-linear-gradient(90deg,rgba(28,20,8,.42) 0 1px,transparent 1px 9.2px);
  background-size:auto 15px,auto 8px;background-repeat:repeat-x;transition:background-position .42s cubic-bezier(.22,1,.3,1)}
.dial.tuning .ticks{transition:none}
.needle{position:absolute;top:0;bottom:0;left:50%;width:1.5px;margin-left:-.75px;
  background:var(--accent);z-index:3;box-shadow:0 0 3px rgba(255,80,41,.8)}
.needle::before{content:"";position:absolute;top:-2px;left:50%;width:7px;height:7px;margin-left:-3.5px;
  border-radius:1px;background:var(--accent);transform:rotate(45deg)}
.step{flex:0 0 auto;width:44px;min-height:44px;border-radius:3px;border:1px solid var(--brass-deep);
  background:linear-gradient(180deg,var(--brass),var(--brass-deep));color:var(--walnut-3);
  font:400 1.25rem/1 var(--f-d);cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,244,214,.55)}
.step:active{box-shadow:inset 0 2px 5px rgba(92,62,20,.5)}
.hint{font:400 .9375rem/1.5 var(--f-b);color:var(--ink-3);margin:.4rem 0 0}
/* Tables */
.tbl{width:100%;overflow-x:auto;margin:1.2rem 0}
table{border-collapse:collapse;width:100%;font-size:.9375rem}
th,td{text-align:left;padding:.5rem .7rem;border-bottom:1px solid var(--rule);vertical-align:top}
th{font:700 .8125rem/1 var(--f-m);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)}
td.num{font:700 .9375rem/1.5 var(--f-m);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
/* Rules list */
ol.rules{counter-reset:r;list-style:none;padding:0;margin:1.2rem 0;display:grid;gap:.7rem}
/* NOT display:grid on the li. Grid promotes every inline child AND every bare
   text run to its own grid item, so a rule reading "<b>Lead.</b> then prose"
   became one word per row. The counter is positioned instead, which leaves the
   rule text as ordinary inline flow. */
ol.rules li{counter-increment:r;position:relative;padding-left:2.9rem}
ol.rules li::before{content:counter(r,decimal-leading-zero);position:absolute;left:0;top:0;
  font:700 .8125rem/1.75 var(--f-m);color:var(--accent-text);letter-spacing:.08em}
.gap li{color:var(--ink-2)}
footer{margin-top:4rem;padding-top:1.4rem;border-top:3px solid var(--brass);
  font:400 .9375rem/1.6 var(--f-m);color:var(--ink-3)}
a{color:var(--accent-text)}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
@media (max-width:640px){.sw{grid-template-columns:34px 1fr;row-gap:.2rem}.sw .note{grid-column:2}}
</style>

<div class="wrap">
<header>
  <span class="plate">iHYPE · Design handoff · Console</span>
  <h1>The console spec</h1>
  <p class="lede">Everything below was read out of the shipping stylesheets and every ratio was
  measured, not quoted. Regenerate with <code>npm run design:handoff</code>.</p>
</header>

<section>
  <h2><span class="n">§ 01</span>There is one ground</h2>
  <p>Light, dark and console were collapsed into a single ground. There is no theme switcher, no
  <code>prefers-color-scheme</code>, no <code>[data-theme]</code> block. <b>A template must not offer an
  appearance choice.</b></p>
  <div class="sws">
    ${swatch('--bg', GROUND, 'the board')}
    ${swatch('--ink', INK, `body copy — ${ratio(INK, GROUND)}:1`)}
  </div>
  <p><code>html.high-contrast</code> still exists and is <b>not a theme</b> — it is an accessibility mode
  with its own black ground. Do not design for it; do not remove it.</p>
</section>

<hr class="rule">
<section>
  <h2><span class="n">§ 02</span>Materials</h2>
  <p>The look is not “a warm palette”. It is three materials used for three kinds of object. Getting
  this wrong is what makes a page read as a beige website instead of a receiver.</p>
  <div class="sws">
    ${swatch('--walnut', WALNUT, 'cabinet face, top of gradient')}
    ${swatch('--walnut-2', WALNUT2, 'full-player ground')}
    ${swatch('--walnut-3', WALNUT3, 'recessed wells, control glyphs')}
    ${swatch('--brass', BRASS, 'bezels, transport, step keys')}
    ${swatch('--brass-deep', BRASS_DEEP, 'the shadow side of a bezel')}
    ${swatch('--lamp', LAMP, 'pilot lamps, lit state, hover')}
  </div>

  <h3>Walnut is dark everywhere — it carries its own ink</h3>
  <p>This is the most important rule here, and it has already caused one shipped bug: the player dock
  painted dark ink on a near-black bar for weeks.</p>
  <div class="spec walnut">
    <div style="font:400 1.5rem/1.2 var(--f-s)">Ink on the cabinet</div>
    <p><code style="background:rgba(255,255,255,.1);color:var(--on-walnut-2)">--ink-on-walnut-2</code>
      — secondary copy, ${ratio(ON_WALNUT2, WALNUT)}:1 against the lightest stop.</p>
    <div class="dim">--ink-on-walnut-3 · ${ratio(ON_WALNUT3, WALNUT)}:1 · the floor for a word</div>
  </div>
  <div class="sws">
    ${swatch('--ink-on-walnut', ON_WALNUT, `${ratio(ON_WALNUT, WALNUT)}:1 on --walnut`)}
    ${swatch('--ink-on-walnut-2', ON_WALNUT2, `${ratio(ON_WALNUT2, WALNUT)}:1 — secondary`)}
    ${swatch('--ink-on-walnut-3', ON_WALNUT3, `${ratio(ON_WALNUT3, WALNUT)}:1 — floor for a word`)}
  </div>
  <p>Ratios are against <code>--walnut</code>, the <b>lightest</b> stop. Copy can land anywhere on a
  gradient, so the worst case is the only one worth quoting. <b>Never put <code>--ink</code>,
  <code>--ink-2</code> or <code>--ink-3</code> on walnut</b> — there is a lint rule that fails the build
  on it. Hairlines use <code>--rule-on-walnut</code>; the page's <code>--line</code> vanishes into timber.</p>
</section>

<hr class="rule">
<section>
  <h2><span class="n">§ 03</span>The accent is a fill, never a word</h2>
  <p><code>--accent</code> is ${ACCENT}. On the board it measures <b>${ratio(ACCENT, GROUND)}:1</b> —
  it fails AA as copy and fails even the 3:1 large-text bar.</p>
  <div class="accent-row">
    <span class="pill">Correct label</span>
    <span class="verdict ok">${ratio(ON_ACCENT, ACCENT)}:1 · pass</span>
    <span class="wrong">White label</span>
    <span class="verdict no">3.27:1 · fails</span>
  </div>
  <p><span class="asword">The accent as a word</span> uses <code>--accent-text</code> ${ACCENT_TEXT}
  — ${ratio(ACCENT_TEXT, GROUND)}:1. <b><code>--ink-on-accent</code> is dark ink, not white.</b> This
  surprises people; it is measured.</p>
  <p>The same split exists for <code>--warning-text</code>, <code>--danger-text</code> and
  <code>--success-text</code>. A fill token and a copy token are different tokens even when the hex matches.</p>
</section>

<hr class="rule">
<section>
  <h2><span class="n">§ 04</span>The tuner — drag it</h2>
  <p>It replaces every horizontal tab strip. A strip divides one row by the number of tabs, so each tab
  added shrinks every label; the dial spends the same row on <b>one</b> destination at 26px and does not
  shrink when a section is added.</p>
  <div class="dialmount">
    <button class="step" id="prev" type="button" aria-label="Previous">&lsaquo;</button>
    <div class="dial" id="dial"><span class="station" id="stn">Discover</span>
      <span class="scale"><span class="ticks" id="ticks"></span><span class="needle"></span></span></div>
    <button class="step" id="next" type="button" aria-label="Next">&rsaquo;</button>
  </div>
  <p class="hint">Drag the face, use the wheel, or press the brass keys. The scale is two repeating
  gradients driven by the drag — infinite in both directions, no cloned strip, no seam, stations wrap.
  In the app it is a <code>role="tablist"</code> with roving tabindex, never a slider: a slider announces
  a number where a member needs a destination.</p>

  <h3>The recessed plate</h3>
  <p>Artwork sits in a machined bezel — deep brass, bright brass, deep again, with an inner top shadow so
  it reads as cut <i>into</i> the faceplate. Radius 2px: a bezel is turned metal, and a large round-rect
  reads as a phone app icon.</p>
  <div class="plate-demo">A</div>
</section>

<hr class="rule">
<section>
  <h2><span class="n">§ 05</span>Type</h2>
  <p>Three faces, three jobs — and this page is set in them.</p>
  <div class="tbl"><table>
    <tr><th>Role</th><th>Face</th><th>Rule</th></tr>
    <tr><td>Page display</td><td>Bricolage Grotesque</td><td>800 weight, tight tracking</td></tr>
    <tr><td>Section heading</td><td>Instrument Serif</td><td><code>h2</code>, via <code>--f-s</code></td></tr>
    <tr><td>Prose</td><td>Work Sans</td><td>body</td></tr>
    <tr><td>Eyebrow / data</td><td>JetBrains Mono</td><td>tracked, uppercase</td></tr>
  </table></div>
  <ol class="rules">
    <li><b>15px is the content floor.</b> Enforced — the build fails below it.</li>
    <li><b>11px is the eyebrow floor</b>, and only for tracked mono: monospace family <i>and</i>
      <code>letter-spacing ≥ 0.14em</code>. Metadata only — a form label, an error message or a status
      readout is content, not an eyebrow.</li>
    <li><b>Sizes in <code>rem</code>, never <code>px</code></b> — the root size carries the reader's Text
      size setting and iOS Dynamic Type, and <code>px</code> cannot follow it.</li>
  </ol>
</section>

<hr class="rule">
<section>
  <h2><span class="n">§ 06</span>Rules a template must not break</h2>
  <ol class="rules">
    <li><b>No emoji.</b> Unicode glyphs (▶ ❚❚ ♥ ✕ ✓ ★ ⬟ ♪) are the vocabulary.</li>
    <li><b>There is no DJ role.</b> Deleted from the product 2026-08-06.</li>
    <li><b>Promoter is not an account type.</b> It is a 10% payout share; <code>--role-promoter</code>
      colours that slice and nothing else.</li>
    <li><b>No white on the accent fill.</b> Use <code>--ink-on-accent</code>.</li>
    <li><b>No appearance or theme switcher.</b> One ground.</li>
    <li><b>70 / 20 / 10 / 0%</b> — artist / venue / promoters / iHYPE. Never restate it differently.</li>
    <li><b>Audio only.</b> No video anywhere.</li>
    <li><b>admin@ihype.org</b> and <b>ihype.org</b> are the only contact and domain.</li>
  </ol>
</section>

<hr class="rule">
<section>
  <h2><span class="n">§ 07</span>What the templates get wrong today</h2>
  <p>Pulled from <code>npm run audit:design</code> when this page was generated. These are
  <b>design</b> defects — fix them in Claude Design and re-vendor. Correcting them in the code is undone
  by the next session that faithfully applies the template.</p>
  <div class="tbl"><table>
    <tr><th>Count</th><th>Finding</th><th>Templates</th><th>Rule</th><th>Why</th></tr>
    ${findingRows}
  </table></div>
</section>

<hr class="rule">
<section>
  <h2><span class="n">§ 08</span>What the code does not have</h2>
  <p>Stated so a template does not assume a control nobody has built.</p>
  <ol class="rules gap">
    <li><b>Transport knob with drag gestures</b> — tap play/pause, drag for next/prev, drag up for the
      full player. Not built.</li>
    <li><b>The map is a real interactive map</b>, toned to an aged chart — not the prototype's drawn
      coastline. Real venues sit at real coordinates.</li>
    <li><b>Marketing, legal and admin routes</b> carry the palette and type but not the cabinet. Only
      the app shell is furniture.</li>
  </ol>
</section>

<footer>
  Generated from the shipping stylesheets · <code>npm run design:handoff</code><br>
  Contrast computed at generation time · single ground by design
</footer>
</div>

<script>
(function(){
  var STOPS=['Discover','Radio','Charts','Recommended','Playlists'],PITCH=46;
  var dial=document.getElementById('dial'),ticks=document.getElementById('ticks'),
      stn=document.getElementById('stn'),off=0;
  function wrap(i,n){return ((i%n)+n)%n;}
  function paint(){var px=(-off)+'px';ticks.style.backgroundPositionX=px+', '+px;
    stn.textContent=STOPS[wrap(Math.round(off/PITCH),STOPS.length)];}
  function step(by){off+=by*PITCH;paint();}
  document.getElementById('next').addEventListener('click',function(){step(1);});
  document.getElementById('prev').addEventListener('click',function(){step(-1);});
  dial.addEventListener('wheel',function(e){e.preventDefault();step(e.deltaY>0?1:-1);},{passive:false});
  var drag=null;
  dial.addEventListener('pointerdown',function(e){drag={x:e.clientX,from:off};
    dial.classList.add('tuning');dial.setPointerCapture(e.pointerId);});
  dial.addEventListener('pointermove',function(e){if(!drag)return;
    off=drag.from-(e.clientX-drag.x);paint();});
  function end(){if(!drag)return;drag=null;dial.classList.remove('tuning');
    off=Math.round(off/PITCH)*PITCH;paint();}
  dial.addEventListener('pointerup',end);dial.addEventListener('pointercancel',end);
  dial.addEventListener('lostpointercapture',end);
  paint();
})();
</script>`;

await writeFile('design/console-2026-08/HANDOFF.html', page);
console.log(`Wrote design/console-2026-08/HANDOFF.html (${page.length} chars)`);
