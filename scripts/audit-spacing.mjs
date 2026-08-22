/**
 * Spacing consistency — `npm run audit:spacing`
 *
 * ## What this measures, and what it deliberately does not
 *
 * The design system publishes a spacing scale (`tokens/spacing.css`, mirrored
 * into `globals.css` as `--space-1` … `--space-16`: 4 8 12 16 20 24 32 40 48
 * 64). **Nothing in `src/` reads a single rung of it.** Every spacing value in
 * the app is a literal, which is the starting condition rather than the finding.
 *
 * Counting literals is not useful on its own: a 1px hairline, a 2px optical
 * nudge and a `-4px` overlap are all correct and none are on the scale. So the
 * scan is narrowed to the properties that set RHYTHM — padding, margin, gap —
 * at 4px and above, where a number is a spacing decision rather than a detail.
 *
 * Three reports, in order of how much a reader would notice:
 *
 *   1. **Near-miss clusters.** Two or three numbers doing one job — 18 and 20,
 *      or 6 and 8 and 10 — is what reads as sloppy, and it is invisible in any
 *      one file. This is the report worth acting on.
 *   2. **A primitive spaced two ways.** The same class given different values
 *      for the same property in different rules. `shell-surfaces.css` exists
 *      because nine names were painting one card; this is the same failure in
 *      the other dimension.
 *   3. **Where the literals are.** Inline `style={{ padding: 18 }}` cannot be
 *      corrected centrally, so the files holding the most of it are the ones
 *      where a change is a rewrite rather than an edit.
 *
 * `--max=N` is a ratchet on report 1's total, in the shape `audit:css` and
 * `audit:retro` already use: existing debt passes, a new near-miss fails.
 * Nothing here is a style opinion — every rung is the design system's own.
 *
 * ## Deliberately NOT in CI yet, and what the number was on the day
 *
 * The baseline is **941** near-miss literals across 89 files (2026-08-22), and
 * the npm script runs advisory with no `--max` on purpose: wiring a gate at 941
 * locks in a number nobody has agreed to pay down, and half of it sits in five
 * files (`mmm.css` 159 of its 283, `AdvertisePage.tsx` 127, `globals.css` 102,
 * `PagesHome.tsx` 50, `PageEditor.tsx` 35). Add `--max=941` to `ci.yml`'s fast
 * lane when the first tranche is converted, and lower it from there.
 *
 * ## The finding the numbers add up to
 *
 * 90% of rhythm literals land on a 2px step and only 57% on the 4px step the
 * design system publishes; 6, 10, 14, 18, 22, 26, 30, 34, 38, 42 and 46 are all
 * in live use. So this is not 941 typos — the app runs a coherent 2px grid that
 * happens to be undocumented, beside a documented 4px one. Converting means
 * choosing the published scale, which is what CLAUDE.md says is the source of
 * truth, and moving ~941 values by up to 2px each.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import path from 'node:path';

const SCALE = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64];
/** Below this a number is a hairline, a nudge or a border, not rhythm. */
const FLOOR = 4;
const STRICT = process.argv.includes('--strict');
const maxArg = process.argv.find((a) => a.startsWith('--max='));
const MAX = maxArg ? Number(maxArg.slice('--max='.length)) : null;
const VERBOSE = process.argv.includes('--list');

/* Vendored design-system components are generated and reverted by the next
   `vendor:ds` run, exactly as with the colour check in `audit:shell`: a finding
   there is a note for `UPSTREAM_FIXES.md`, not something this repo can fix. */
const EXEMPT_PATH = ['src/components/ds/'];

/** Comments collapsed to newlines so reported line numbers stay honest. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
}

const CSS_PROP = /(?:margin|padding|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?/;
const JSX_PROP = /(?:margin|padding|gap|rowGap|columnGap)(?:Top|Right|Bottom|Left|Inline|Block)?/;

/** Every rhythm literal in the repo, with where it came from. */
function collect() {
  const hits = [];
  const files = [
    ...globSync('src/**/*.css'),
    ...globSync('src/**/*.tsx'),
  ].map((f) => f.split(path.sep).join('/')).sort();

  for (const file of files) {
    if (EXEMPT_PATH.some((x) => file.includes(x))) continue;
    const raw = readFileSync(file, 'utf8');
    const source = stripComments(raw);
    const lineOf = (index) => source.slice(0, index).split('\n').length;

    if (file.endsWith('.css')) {
      /* Rule-scoped, so report 2 can ask which SELECTOR set a value. A brace
         scan rather than a parser: these stylesheets are flat. */
      for (const m of source.matchAll(new RegExp(`([^{}]+)\\{([^{}]*)\\}`, 'g'))) {
        const selector = m[1].trim().split('\n').pop().trim();
        for (const d of m[2].matchAll(new RegExp(`(${CSS_PROP.source})\\s*:\\s*([^;]+)`, 'g'))) {
          /* `calc()` and `var()` are derived from something — a token, a
             geometry table — and are not a loose number. */
          if (/calc\(|var\(/.test(d[2])) continue;
          for (const v of d[2].matchAll(/(-?\d+(?:\.\d+)?)px/g)) {
            hits.push({ file, line: lineOf(m.index), selector, prop: d[1], value: Math.abs(Number(v[1])), kind: 'css' });
          }
        }
      }
      continue;
    }

    // Inline React styles. A bare number becomes px; a string may carry several.
    for (const m of source.matchAll(new RegExp(`\\b(${JSX_PROP.source})\\s*:\\s*(-?\\d+(?:\\.\\d+)?)\\b`, 'g'))) {
      hits.push({ file, line: lineOf(m.index), selector: null, prop: m[1], value: Math.abs(Number(m[2])), kind: 'jsx' });
    }
    for (const m of source.matchAll(new RegExp(`\\b(${JSX_PROP.source})\\s*:\\s*'([^']*)'`, 'g'))) {
      if (/calc\(|var\(/.test(m[2])) continue;
      for (const v of m[2].matchAll(/(-?\d+(?:\.\d+)?)px/g)) {
        hits.push({ file, line: lineOf(m.index), selector: null, prop: m[1], value: Math.abs(Number(v[1])), kind: 'jsx' });
      }
    }
  }
  return hits.filter((h) => h.value >= FLOOR);
}

/** The rung a value is trying to be, and how far off it is. */
function nearest(value) {
  let best = SCALE[0];
  for (const rung of SCALE) if (Math.abs(rung - value) < Math.abs(best - value)) best = rung;
  return { rung: best, distance: Math.abs(best - value) };
}

const hits = collect();
const onScale = hits.filter((h) => SCALE.includes(h.value));

console.log(`\nRhythm literals (padding · margin · gap, >= ${FLOOR}px): ${hits.length}`);
console.log(`  on the design system's scale: ${onScale.length} (${Math.round(onScale.length / hits.length * 100)}%)`);
console.log(`  distinct values in use: ${new Set(hits.map((h) => h.value)).size}`);

/* ── 1 · Near-miss clusters ─────────────────────────────────────────────── */
const bands = new Map();
for (const hit of hits) {
  const { rung, distance } = nearest(hit.value);
  // Within 2px of a rung and not ON it: a number meant to be that rung.
  if (distance === 0 || distance > 2) continue;
  if (!bands.has(rung)) bands.set(rung, new Map());
  const band = bands.get(rung);
  band.set(hit.value, (band.get(hit.value) ?? 0) + 1);
}
let nearMiss = 0;
const clusters = [...bands.entries()]
  .map(([rung, band]) => {
    const total = [...band.values()].reduce((a, b) => a + b, 0);
    nearMiss += total;
    return { rung, band, total, onRung: hits.filter((h) => h.value === rung).length };
  })
  .sort((a, b) => b.total - a.total);

console.log('\n1 · Near-miss clusters — numbers doing a rung\'s job without being it');
console.log('   Each row: a scale rung, how often it is used, and the off-scale');
console.log('   neighbours competing with it for the same visual job.\n');
console.log('   rung  on-rung   near-miss neighbours   (? = equidistant from two rungs, so a choice)');
for (const c of clusters) {
  const neighbours = [...c.band.entries()].sort((a, b) => b[1] - a[1])
    .map(([v, n]) => {
      /* 6 and 10 sit two from BOTH neighbouring rungs, so which rung they
         belong to is a decision rather than a correction. Marked, because
         "collapse to the nearest" is not advice for those. */
      const ambiguous = SCALE.filter((r) => Math.abs(r - v) === nearest(v).distance).length > 1;
      return `${v}px x${n}${ambiguous ? '?' : ''}`;
    }).join(', ');
  console.log(`   ${String(c.rung).padStart(4)}px  x${String(c.onRung).padEnd(7)} ${neighbours}`);
}
console.log(`\n   total near-miss literals: ${nearMiss}`);

/* ── 2 · One visual role, many spacings ────────────────────────────────────
   The first version of this report compared the same class against itself and
   was wrong twice over: a class legitimately carries different padding at
   different breakpoints, and `padding: 12px 20px` is ONE decision that it read
   as "12 vs 20". Same-selector disagreement is also already `audit:css`'s job.

   What no other check can see is whether the app's CARDS agree with each other
   — the question `shell-surfaces.css` answers for paint and nothing answers for
   rhythm. So this groups by the role in the class NAME and reports the spread:
   "cards are padded eleven ways" is both perceptible and actionable, where
   "this card is padded twice" mostly is not. */
const ROLES = ['card', 'row', 'panel', 'sheet', 'chip', 'pill', 'stat', 'tile', 'pane', 'section', 'field', 'btn', 'modal'];
const byRole = new Map();
for (const hit of hits) {
  if (hit.kind !== 'css' || !hit.selector) continue;
  /* The declaration, not the value: a shorthand is one decision and its parts
     must not be counted as a disagreement with each other. */
  const classes = [...hit.selector.matchAll(/\.(-?[_a-zA-Z][-\w]*)/g)].map((m) => m[1].toLowerCase());
  const role = ROLES.find((r) => classes.some((c) => c.split('-').includes(r)));
  if (!role) continue;
  const prop = hit.prop.startsWith('padding') ? 'padding' : hit.prop.startsWith('margin') ? 'margin' : 'gap';
  const key = `${role}|${prop}`;
  if (!byRole.has(key)) byRole.set(key, new Map());
  byRole.get(key).set(hit.value, (byRole.get(key).get(hit.value) ?? 0) + 1);
}
const spreads = [...byRole.entries()]
  .map(([key, values]) => ({ key, distinct: values.size, values }))
  .filter((r) => r.distinct > 2)
  .sort((a, b) => b.distinct - a.distinct);

console.log(`\n2 · One visual role, many spacings — how far the app's own vocabulary drifts`);
for (const r of spreads.slice(0, VERBOSE ? spreads.length : 10)) {
  const [role, prop] = r.key.split('|');
  const list = [...r.values.entries()].sort((a, b) => b[1] - a[1])
    .map(([v, n]) => `${v}px${n > 2 ? `x${n}` : ''}`).join(' ');
  console.log(`   ${(role + ' ' + prop).padEnd(16)} ${String(r.distinct).padStart(2)} values: ${list}`);
}
if (!VERBOSE && spreads.length > 10) console.log(`   … ${spreads.length - 10} more (run with --list)`);

/* ── 3 · Where the literals are ────────────────────────────────────────── */
const perFile = new Map();
for (const hit of hits) perFile.set(hit.file, (perFile.get(hit.file) ?? 0) + 1);
const inlineHeavy = [...perFile.entries()]
  .filter(([f]) => f.endsWith('.tsx'))
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);
console.log('\n3 · Inline spacing by file — these cannot be corrected centrally');
for (const [file, n] of inlineHeavy) console.log(`   ${String(n).padStart(4)}  ${file}`);

console.log('\n' + '─'.repeat(68));
if (MAX !== null && nearMiss > MAX) {
  console.error(`\nFAIL: ${nearMiss} near-miss spacing literals, above the agreed baseline of ${MAX}.`);
  console.error('A number within 2px of a scale rung is that rung with a typo. Use the rung.');
  process.exit(1);
}
if (MAX !== null) {
  console.log(`Near-miss total ${nearMiss}, within the baseline of ${MAX}. Pre-existing debt, not a clean bill of health.`);
} else {
  console.log('Advisory run — pass --max=N to ratchet the near-miss total.');
}
if (STRICT && spreads.length) {
  console.error(`\nFAIL (--strict): ${spreads.length} role/property pairs carry more than two spacing values.`);
  process.exit(1);
}
