#!/usr/bin/env node
/**
 * Which routes actually carry the console design?
 *
 * ## Why this exists
 *
 * "All pages are on the new design" was, for three sessions running, a claim
 * nobody could check. `audit:routes` counts routes by SHELL, which answers a
 * different question — a page can sit inside the MMM shell and still paint its
 * own colours. `audit:shell` does check colour, but only across the 43 files
 * it classifies as shell surfaces, so the ~70 routes outside both shells
 * (marketing, legal, auth, admin) were never looked at by anything.
 *
 * The gap that leaves is not theoretical. The console conversion found three
 * separate rules painting a ground the token system had not chosen, and every
 * one of them was outside `audit:shell`'s reach: the last `body` rule in
 * globals.css, `.nav`, and `.fan-entry-orange`. Each was valid CSS that no
 * check could see.
 *
 * ## What it measures, and why THIS
 *
 * A raw colour literal. Not "does the file import a token", not a heuristic
 * about class names — a page that writes `#1a1a1a` **cannot** follow the
 * ground, whatever else it does, and that is exactly what changing the ground
 * exposed. It is the one signal that is both cheap to compute and impossible
 * to satisfy accidentally.
 *
 * A route is measured together with everything it renders: imports are
 * followed transitively through `src/`, because a page whose own file is clean
 * but whose card component paints `#7fb3ff` is not a converted page. That is
 * the whole reason `AdvertisePage` carried 23 literals while the route file
 * looked spotless.
 *
 * ## What is deliberately NOT counted
 *
 *   · `@media print` blocks — paper is white; a literal there is correct.
 *   · Satori/ImageResponse, QR, email HTML, the EPK print document — none of
 *     them have this stylesheet, so tokens would resolve to nothing.
 *   · Comments. This file's own prose names hex codes; so does globals.css,
 *     at length, explaining which literals were removed and why. Counting
 *     those would make the number go UP as the documentation improved.
 *   · `/admin/*`. It is internal tooling, and holding it to the member-facing
 *     design bar is how a ratchet gets switched off. Reported separately.
 *
 * ## The ratchet
 *
 * `--max=N` fails when more than N member-facing routes carry literals. The
 * number goes DOWN, never up — same contract as `audit:routes --max-legacy`
 * and `audit:css --max`. A route that is already dirty stays passing; a route
 * that becomes dirty fails the build.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const MAX = Number(args.find((a) => a.startsWith('--max='))?.slice(6) ?? Infinity);
const LIST = args.includes('--list');

/* Paths whose colour is legitimately literal — see the header. */
const EXEMPT_FILE = [
  'opengraph-image', 'api/og/', 'qr/route', 'poster/route', 'card/route',
  'epk/', '/email', 'email/', 'manifest', 'robots', 'sitemap',
  /* Member-selectable profile themes — "midnight-neon", "y2k-sparkle" and
     six more. These are decoration a MEMBER picks for their own public page,
     not chrome the product paints, so holding them to the single ground would
     be deleting a feature by lint. Whether that feature survives the decision
     to have one ground at all is a product question and belongs to the owner,
     not to this script. Left in, they were 29 literals landing on two routes
     and made this audit's headline number wrong by a third on its first run. */
  'lib/profile-design',
  /* Email HTML. It does not carry this stylesheet — a mail client has no
     :root to read tokens from — so a literal there is the only thing that
     works, exactly like the Satori surfaces above. */
  'lib/mailer',
];

/* One more exemption, but narrower than a path: a QR code's own ink.
   It is read by a camera, not a person — the contrast is a scanning
   requirement, not a theme decision, and "fixing" it to a token is how a
   ticket stops scanning at the door. */
const EXEMPT_LINE = /qr|<rect|quiet ?zone|design-exempt/i;

const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

/** Strip what must not be counted: comments first, then print blocks.
 *
 * Block comments collapse to NEWLINES, not to a space, and that is the whole
 * fix for a real hole: the exemption below is decided per line against the RAW
 * source, so the stripped text has to keep the same line numbering. It did not,
 * and the consequence was that every `design-exempt` marker written as a comment
 * ABOVE the line it excuses was deleted before the exemption could see it — so
 * `/shows/[slug]`'s door QR counted as a colour violation while carrying a
 * comment explaining, correctly, that a QR must not follow the theme. */
function strip(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => '\n'.repeat(block.split('\n').length - 1))
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')      // line comments, sparing "http://"
    .replace(/@media\s+print\s*\{[\s\S]*?\n\s*\}/g, ' ');
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

const allFiles = await walk('src');
const bySpecifier = new Map();
for (const f of allFiles) {
  const portable = f.split(path.sep).join('/');
  bySpecifier.set(portable, f);
}

/** Resolve an import specifier to a file in src/, or null if external. */
function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = 'src/' + spec.slice(2);
  else if (spec.startsWith('.')) {
    base = path.join(path.dirname(fromFile), spec).split(path.sep).join('/');
  } else return null;
  for (const ext of ['.tsx', '.ts', '.css', '/index.tsx', '/index.ts']) {
    if (bySpecifier.has(base + ext)) return bySpecifier.get(base + ext);
  }
  return bySpecifier.get(base) ?? null;
}

const IMPORT = /(?:^|\n)\s*import\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/g;

const cache = new Map();
/** Every file a page pulls in, transitively, within src/. */
async function closure(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  if (cache.has(file)) {
    for (const f of cache.get(file)) seen.add(f);
    return seen;
  }
  let source;
  try { source = await readFile(file, 'utf8'); } catch { return seen; }
  for (const m of source.matchAll(IMPORT)) {
    const target = resolveImport(m[1], file);
    if (target) await closure(target, seen);
  }
  return seen;
}

/** Literals in one file, ignoring comments, print blocks and exempt paths. */
const literalCache = new Map();
async function literalsIn(file) {
  if (literalCache.has(file)) return literalCache.get(file);
  const portable = file.split(path.sep).join('/');
  let n = 0;
  if (/\.(tsx|ts|css)$/.test(portable) && !EXEMPT_FILE.some((x) => portable.includes(x))) {
    const raw = (await readFile(file, 'utf8')).split('\n');
    const source = strip(raw.join('\n')).split('\n');
    /* A marker excuses its own line and the two below it, because a comment
       explaining a literal is written above the literal, not beside it. */
    const excused = new Set();
    raw.forEach((line, i) => {
      if (!EXEMPT_LINE.test(line)) return;
      for (const offset of [0, 1, 2]) excused.add(i + offset);
    });
    n = source.reduce((sum, line, i) => (excused.has(i) ? sum : sum + (line.match(HEX) ?? []).length), 0);
  }
  literalCache.set(file, n);
  return n;
}

/* globals.css is imported by the root layout, so it would land in EVERY
   route's closure and make all 110 identical. It is the design system's own
   file — the place literals are DEFINED — so it is measured once, separately,
   rather than charged to every page that inherits it. */
const SHARED = ['src/app/globals.css', 'src/app/mmm.css', 'src/app/mmm-primitives.css',
  'src/app/mmm-workflows.css', 'src/app/mobile-fit.css', 'src/app/marketing.css',
  'src/app/shell.css', 'src/app/shell-surfaces.css', 'src/app/admin/admin.css'];

const pages = allFiles
  .map((f) => f.split(path.sep).join('/'))
  .filter((f) => /^src\/app\/.*\/page\.tsx$/.test(f) || f === 'src/app/page.tsx');

const rows = [];
for (const page of pages) {
  const route = '/' + page.replace(/^src\/app\//, '').replace(/\/?page\.tsx$/, '');
  const files = await closure(bySpecifier.get(page) ?? page);
  let count = 0;
  const owners = [];
  for (const f of files) {
    const portable = f.split(path.sep).join('/');
    if (SHARED.includes(portable)) continue;
    const n = await literalsIn(f);
    if (n) { count += n; owners.push(`${portable} (${n})`); }
  }
  rows.push({ route: route === '/' ? '/' : route.replace(/\/$/, ''), count, owners });
}

const admin = rows.filter((r) => r.route.startsWith('/admin'));
const member = rows.filter((r) => !r.route.startsWith('/admin'));
const dirty = member.filter((r) => r.count > 0).sort((a, b) => b.count - a.count);

console.log('\n  RETRO COVERAGE\n');
console.log(`  ${String(member.length).padStart(4)}  member-facing routes`);
console.log(`  ${String(member.length - dirty.length).padStart(4)}  paint only from tokens  ← converted`);
console.log(`  ${String(dirty.length).padStart(4)}  still carry raw colour  ← the work`);
console.log(`  ${String(admin.length).padStart(4)}  admin routes (reported, not gated)\n`);

if (dirty.length) {
  console.log('  Routes carrying raw colour, worst first:\n');
  for (const r of dirty.slice(0, LIST ? dirty.length : 12)) {
    console.log(`  ${String(r.count).padStart(4)}  ${r.route}`);
    if (LIST) for (const o of r.owners) console.log(`        ${o}`);
  }
  if (!LIST && dirty.length > 12) console.log(`\n  …and ${dirty.length - 12} more. Run with --list.`);
}

const adminDirty = admin.filter((r) => r.count > 0).length;
if (adminDirty) console.log(`\n  (${adminDirty} of ${admin.length} admin routes carry literals — internal tooling, not gated.)`);

if (dirty.length > MAX) {
  console.error(`\n  FAIL: ${dirty.length} member-facing routes carry raw colour, budget is ${MAX}.`);
  console.error('  This number goes DOWN. Convert the route, or fix the component it renders.\n');
  process.exit(1);
}
console.log(`\n  Coverage: ${member.length - dirty.length}/${member.length} member-facing routes paint only from tokens.\n`);
