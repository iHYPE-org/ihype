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
const OPT_IN = new Set(['is-delta']);
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

if (process.argv.includes('--strict') && drift.length) process.exit(1);
