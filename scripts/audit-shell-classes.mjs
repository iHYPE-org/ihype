#!/usr/bin/env node
/**
 * Audits the app shell's subpage conversion.
 *
 * `src/app/shell-surfaces.css` converts the signed-in subpages to the design
 * system by pointing each page's own class names at one shared primitive. That
 * only stays true if new pages either use the primitives or get added to the
 * alias lists — otherwise a page quietly drifts back to its own look and
 * nobody notices, because nothing fails.
 *
 * So this reports, for every page inside the shell's route registry:
 *   - class names that look like one of the nine primitives (by suffix) but
 *     are NOT covered by shell-surfaces.css — the drift set;
 *   - alias entries in shell-surfaces.css that no longer match any markup —
 *     the dead set.
 *
 * Advisory by default. `--strict` exits non-zero when the drift set is
 * non-empty, for wiring into CI once the current set is at zero.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SHELL_DIRS = [
  'listen', 'radio', 'discover', 'search', 'tracks', 'playlist', 'shows',
  'tickets', 'events', 'this-weekend', 'for-you', 'me', 'payout', 'payouts',
  'pages', 'artists', 'promoters', 'venues', 'fans', 'advertise', 'settings',
  'community', 'community-rules', 'info', 'legal', 'support',
].map((dir) => join('src/app', dir));

/**
 * Suffixes that mark a class as one of the design system's primitives. Kept in
 * step with the groups shell-surfaces.css is organised into.
 */
const PRIMITIVE_PATTERNS = [
  { role: 'stat-value', re: /stats?-(?:val|value)$/ },
  { role: 'stat-label', re: /stats?-label$/ },
  { role: 'stat-sub', re: /stats?-(?:sub|delta|note)$/ },
  { role: 'stat-card', re: /stat-card$/ },
  { role: 'card', re: /(?:-card|-panel|-box|-tile)$/ },
  { role: 'row', re: /-row$/ },
  { role: 'eyebrow', re: /(?:eyebrow|kicker)$/ },
  { role: 'title', re: /(?:-title|-heading)$/ },
  { role: 'section-head', re: /-head$/ },
  { role: 'empty', re: /empty/ },
  { role: 'pill', re: /(?:-pill|-tag|-badge|-chip)$/ },
];

/** Names deliberately left alone — body copy and chart axis text, not eyebrows. */
const EXCLUDED = new Set([
  'settings-row-label', 'fa-chart-bar-label', 'pa-chart-bar-label', 'vaa-chart-label',
  'venue-capacity-label', 'lsp-status-label', 'detail-label',
  'aa-eyebrow-row', 'dja-eyebrow-row', 'djd-eyebrow-row', 'artist-hero-row',
  'dj-hero-row', 'fan-hero-row', 'fan-chip-row', 'cta-row', 'tag-row',
  'track-stats-row', 'lsp-card-row',
]);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const files = SHELL_DIRS.flatMap((dir) => walk(dir));
const used = new Map(); // class name -> Set of files

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/className="([^"{]*)"/g)) {
    for (const name of match[1].split(/\s+/).filter(Boolean)) {
      if (!used.has(name)) used.set(name, new Set());
      used.get(name).add(file);
    }
  }
}

const css = readFileSync('src/app/shell-surfaces.css', 'utf8');
const covered = new Set(
  [...css.matchAll(/\.shell-content [^,{]*?\.([a-z0-9-]+)/g)].map((m) => m[1]),
);

const drift = [];
for (const [name, owners] of used) {
  if (EXCLUDED.has(name) || covered.has(name) || name.startsWith('shell-')) continue;
  const hit = PRIMITIVE_PATTERNS.find((pattern) => pattern.re.test(name));
  if (hit) drift.push({ name, role: hit.role, files: [...owners] });
}

/** Utilities offered for pages to opt into; not expected in markup yet. */
const OPT_IN = new Set(['is-delta', 'skeleton', 'ihype-skeleton']);
const dead = [...covered].filter(
  (name) => !used.has(name) && !name.startsWith('shell-') && !OPT_IN.has(name),
);

console.log(`Scanned ${files.length} shell files · ${used.size} distinct class names · ${covered.size} aliased.`);

if (drift.length) {
  console.log(`\n${drift.length} primitive-shaped class(es) NOT converted:`);
  for (const entry of drift.sort((a, b) => a.role.localeCompare(b.role))) {
    console.log(`  [${entry.role}] .${entry.name}  — ${entry.files[0]}`);
  }
  console.log('\nAdd them to the matching group in src/app/shell-surfaces.css.');
} else {
  console.log('\nNo unconverted primitives. Every card/row/stat/eyebrow in the shell paints from the design system.');
}

if (dead.length) {
  console.log(`\n${dead.length} alias(es) matching no markup (safe to drop):`);
  console.log(`  ${dead.join(', ')}`);
}

/* ── Colour drift ──────────────────────────────────────────────────────────
 *
 * The class audit above says a card is a card. It says nothing about the
 * colour that card paints, and that is where the shell actually drifted: 365
 * literal colours across 48 files, including brand hexes with a token that
 * already existed, and dark-theme assumptions (`#fff`, `rgba(255,255,255,…)`)
 * that inverted on the light theme.
 *
 * Chrome-contract rule 8 is "never hardcode a colour". This enforces it for
 * the pages inside the shell.
 *
 * Four kinds of literal are legitimate and are exempted by path, each for a
 * reason that would not apply to a normal page:
 *   - Satori/ImageResponse routes render outside the browser and cannot
 *     resolve a CSS custom property at all;
 *   - QR codes need a light quiet zone and dark modules to scan, in both
 *     themes;
 *   - `@media print` blocks describe paper, which has no theme;
 *   - the EPK is a press document deliberately rendered black-on-white serif.
 */
const COLOUR_EXEMPT = [
  'opengraph-image', 'twitter-image', 'apple-icon', '/icon.tsx',
  '/qr/route.tsx', '/poster/route.tsx', '/card/route.tsx', 'api/og/route.tsx',
  'artists/[slug]/epk/page.tsx',
];
/** Brand/ink values that have a token — a literal here is always convertible. */
const TOKENED = new Map(Object.entries({
  '#ff5029': '--accent', '#ff3e9a': '--accent-2', '#b983ff': '--role-fan',
  '#22e5d4': '--role-venue', '#ffb84a': '--role-promoter', '#5b8cff': '--role-dj',
  '#9e9080': '--ink-2', '#918779': '--ink-3', '#3a342e': '--ink-4',
  '#100d09': '--bg-2', '#1a1612': '--bg-3', '#221c16': '--bg-4', '#0a0805': '--bg',
  '#ff1f3d': '--heat-fire', '#3a4a5a': '--heat-cold',
  // Superseded values, kept here on purpose: these are what --ink-3 was
  // before it was raised to clear AA. A hardcoded copy keeps the failing
  // contrast forever and looks correct next to the token name.
  '#7a7060': '--ink-3', '#7a6e64': '--ink-3',
  '255,80,41': '--accent-rgb', '255,62,154': '--accent-2-rgb',
  '185,131,255': '--role-fan-rgb', '34,229,212': '--role-venue-rgb',
  '255,184,74': '--role-promoter-rgb',
}));
/** Theme-inverting literals: correct on one theme, wrong on the other. */
const THEME_UNSAFE = /#fff(?:fff)?\b|#000(?:000)?\b|rgba?\(\s*255\s*,\s*255\s*,\s*255|rgba?\(\s*0\s*,\s*0\s*,\s*0/i;

/*
 * Colour is audited over src/components as well as the shell's own pages.
 * The class check above is deliberately page-scoped — the primitives are
 * page markup — but a page's colour mostly lives in the components it
 * renders. ListenHome.tsx carried a hardcoded #fff, #22e5d4 and a black
 * scrim straight through the first colour sweep because it is not under
 * src/app, which made the sweep's "zero literals" result read better than
 * it was.
 */
const colourFiles = [...files, ...walkStyled('src/components')];
const colourHits = [];
for (const file of colourFiles) {
  const portableFile = file.replaceAll('\\', '/');
  if (COLOUR_EXEMPT.some((x) => portableFile.includes(x))) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  let inBlock = false;
  let printDepth = -1;   // brace depth at which the @media print block opened
  let depth = 0;
  lines.forEach((line, i) => {
    const wasInBlock = inBlock;
    const o = (line.match(/\/\*/g) || []).length;
    const c = (line.match(/\*\//g) || []).length;
    if (o > c) inBlock = true; else if (c > o) inBlock = false;
    const openedPrint = /@media\s+print/.test(line);
    const depthBefore = depth;
    depth += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
    if (openedPrint && printDepth < 0) printDepth = depthBefore;
    else if (printDepth >= 0 && depth <= printDepth) printDepth = -1;
    if (wasInBlock || /^\s*(\/\/|\*|\/\*)/.test(line)) return;
    // Paper has no theme, so an @media print block may name colours outright.
    if (printDepth >= 0 || openedPrint) return;
    // Per-line opt-out for the one-off cases a path exemption would overshoot
    // (a single QR swatch on an otherwise themed page). Must say why. Walk
    // back over the whole contiguous comment above, not just one line — the
    // reason is usually a sentence and wraps.
    if (/design-exempt:/.test(line)) return;
    // Walk back over the comment above, stepping over pure-syntax lines
    // (`return (`, a lone brace) so the marker can sit where it reads
    // naturally — above the function's return rather than wedged inside JSX,
    // where a // comment is not valid before an element anyway.
    const isComment = (s) => /^\s*(\/\/|\*|\/\*)/.test(s);
    /** Blank, or syntax with no content of its own — `return (`, a lone brace. */
    const isSyntaxOnly = (s) => /^\s*(return\s*\(|[({})\]]|<>)?\s*$/.test(s);
    let back = i - 1;
    let exempt = false;
    for (let hops = 0; back >= 0 && hops < 8; back -= 1, hops += 1) {
      const prev = lines[back];
      if (/design-exempt:/.test(prev)) { exempt = true; break; }
      if (!isComment(prev) && !isSyntaxOnly(prev)) break;
    }
    if (exempt) return;

    for (const [lit, tok] of TOKENED) {
      const re = lit.startsWith('#')
        ? new RegExp(lit.replace('#', '#'), 'i')
        : new RegExp(`rgba?\\(\\s*${lit.replace(/,/g, '\\s*,\\s*')}`, 'i');
      if (re.test(line)) colourHits.push({ file, n: i + 1, lit, tok, kind: 'tokened' });
    }
    // A drop shadow is dark in both themes — that is what a shadow is — so a
    // black rgba() inside one is not a theme assumption.
    const shadowOnly = /(box-?[Ss]hadow|text-?[Ss]hadow|drop-shadow)/.test(line)
      && !/#fff(?:fff)?\b/i.test(line);
    if (THEME_UNSAFE.test(line) && !shadowOnly) {
      colourHits.push({ file, n: i + 1, lit: (line.match(THEME_UNSAFE) || [''])[0], tok: null, kind: 'theme' });
    }
  });
}

const tokened = colourHits.filter((h) => h.kind === 'tokened');
const themed = colourHits.filter((h) => h.kind === 'theme');

if (!colourHits.length) {
  console.log('\nNo hardcoded colours in the shell. Every surface paints from a token.');
} else {
  if (tokened.length) {
    console.log(`\n${tokened.length} literal colour(s) that already have a token:`);
    for (const h of tokened.slice(0, 25)) console.log(`  ${h.file}:${h.n}  ${h.lit} → var(${h.tok})`);
    if (tokened.length > 25) console.log(`  … ${tokened.length - 25} more`);
  }
  if (themed.length) {
    console.log(`\n${themed.length} theme-inverting literal(s) (white/black — wrong on one theme):`);
    for (const h of themed.slice(0, 25)) console.log(`  ${h.file}:${h.n}  ${h.lit}`);
    if (themed.length > 25) console.log(`  … ${themed.length - 25} more`);
    console.log('\n  Text on a brand fill → var(--ink-on-accent). Hairlines → var(--hair-N).');
    console.log('  Genuinely theme-independent (QR, print, Satori)? Add the path to COLOUR_EXEMPT.');
  }
}

/* ── Undefined token references ────────────────────────────────────────────
 *
 * The colour check above is satisfied by `var(--anything)`. A typo, or a
 * token that was renamed out from under a page, produces `var(--gone)` —
 * which is not an error anywhere: CSS drops the declaration and the element
 * silently inherits. That is how /shows/[slug] came to render the venue and
 * promoter shares of the 70/20/10 split in the inherited body colour via
 * `var(--venue)` and `var(--promoter)`, neither of which has ever existed.
 *
 * Reported across the whole app, not just the shell — a stale reference is
 * the same defect wherever it sits. Advisory: several remaining names are
 * legitimately defined at runtime from JS (profile theming, text scale).
 */
const RUNTIME_DEFINED = [
  /^--profile-/, /^--fan-companion-/, /^--ihype-text-scale$/, /^--angle$/,
  /^--jc-color$/, /^--rk-/, /^--dock-progress$/, /^--pad-color$/, /^--album-glow$/,
  // next/font injects these on <html> at runtime (see layout.tsx). They are
  // referenced with a full fallback stack — `var(--font-syne, 'Syne', …)` —
  // precisely because they do not exist at build time. Pointing them at a
  // "real" token would break font loading.
  /^--font-(syne|dm|jb|serif|forum)$/,
];
// walk() above deliberately collects only .tsx — but tokens are DEFINED in
// .css, so reusing it here would report every real token as undefined.
function walkStyled(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkStyled(full, out);
    else if (/\.(tsx|ts|css)$/.test(full)) out.push(full);
  }
  return out;
}
const allFiles = [...walkStyled('src/app'), ...walkStyled('src/components')];
const definedTokens = new Set();
for (const f of allFiles) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:^|[;{\s])(--[a-z0-9-]+)\s*:/gi)) definedTokens.add(m[1]);
  for (const m of src.matchAll(/['"](--[a-z0-9-]+)['"]\s*:/gi)) definedTokens.add(m[1]);
}
const referenced = new Map();
for (const f of allFiles) {
  let inBlock = false;
  readFileSync(f, 'utf8').split('\n').forEach((line) => {
    const was = inBlock;
    const o = (line.match(/\/\*/g) || []).length;
    const c = (line.match(/\*\//g) || []).length;
    if (o > c) inBlock = true; else if (c > o) inBlock = false;
    if (was || /^\s*(\/\/|\*|\/\*)/.test(line)) return;  // prose names tokens too
    // Only a BARE var(--x) is a defect. `var(--x, fallback)` renders the
    // fallback, which is exactly what a fallback is for — flagging those
    // buried the handful of real ones (--wb-*, --accent-3) in ~20 false
    // positives and made the whole check easy to wave away.
    for (const m of line.matchAll(/var\(\s*(--[a-z0-9-]+)\s*([,)])/gi)) {
      if (m[2] !== ')') continue;
      if (!referenced.has(m[1])) referenced.set(m[1], new Set());
      referenced.get(m[1]).add(f);
    }
  });
}
const undefinedTokens = [...referenced]
  .filter(([name]) => !definedTokens.has(name))
  .filter(([name]) => !RUNTIME_DEFINED.some((re) => re.test(name)));

if (undefinedTokens.length) {
  console.log(`\n${undefinedTokens.length} var() reference(s) with no definition (render as nothing):`);
  for (const [name, owners] of undefinedTokens.sort((a, b) => b[1].size - a[1].size)) {
    const [first] = owners;
    console.log(`  var(${name})  — ${first}${owners.size > 1 ? ` (+${owners.size - 1} more)` : ''}`);
  }
  console.log('\nEither define the token or point the reference at the real one.');
  console.log('Runtime-set names belong in RUNTIME_DEFINED above.');
} else {
  console.log('\nEvery var() reference resolves to a defined token.');
}

if (process.argv.includes('--strict') && (drift.length || colourHits.length || undefinedTokens.length)) {
  process.exit(1);
}
