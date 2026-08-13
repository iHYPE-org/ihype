#!/usr/bin/env node
/**
 * Every route this app serves, which shell it renders in, and whether anything
 * links to it.
 *
 * ## Why this exists
 *
 * "There is a lot of bloat and hidden UX that keeps popping up." That is an
 * INVENTORY problem, not a code problem: until this script, nobody — including
 * the agents working on it — could name every surface a member can reach. Two
 * shells, 117 routes, and no way to see the boundary meant surfaces kept
 * surfacing by surprise.
 *
 * The number that matters is `legacy app shell`. It is the retirement target,
 * and the only honest measure of progress toward one shell. Everything else on
 * the board is context for reading it.
 *
 * ## Three classifications, and why the third is not a failure
 *
 *   MMM          `/app/*` — the design system's shell. Where things should end.
 *   LEGACY SHELL rendered inside `AppShell`, per `SHELL_ROUTES`. The target.
 *   OUTSIDE      marketing, legal, auth, admin, embeds, OG images.
 *
 * OUTSIDE is not work-in-progress. A logged-out landing page is not the app,
 * and wrapping it in MMM would be a mistake rather than progress — so it is
 * counted separately and deliberately excluded from the ratchet. Conflating
 * the two is what makes "108 pages to port" sound impossible when the real
 * figure is half that.
 *
 * ## Reachability is a hint, not a verdict
 *
 * "No inbound link" does NOT mean dead. Most unlinked routes here are
 * deliberate redirect aliases for URLs already living in sent email, app-store
 * listings and bookmarks — `/charter`, `/privacy`, `/me/payouts`. Deleting one
 * because this script called it unlinked would break a link somebody already
 * clicked. It is reported to prompt a question, never to justify a deletion.
 *
 *     npm run audit:routes            summary
 *     npm run audit:routes -- --list  every route, grouped
 *     npm run audit:routes -- --max-legacy=51
 *
 * The ratchet is the point: that count must go DOWN. Never raise it to make a
 * build pass — raising it is the whole failure this measures.
 */

import { readFileSync } from 'node:fs';
import { globSync } from 'glob';

const ARGS = process.argv.slice(2);
const WANT_LIST = ARGS.includes('--list');
const MAX_LEGACY = (() => {
  const raw = ARGS.find((a) => a.startsWith('--max-legacy='));
  return raw ? Number(raw.split('=')[1]) : null;
})();

/**
 * `SHELL_ROUTES` is parsed out of `app-nav.ts` rather than duplicated here.
 *
 * A second copy of the registry would drift, and a drifted inventory is worse
 * than none because it is quoted in decisions. Parsing is the lesser evil, and
 * it FAILS LOUDLY on zero entries — a format change must break this script
 * rather than silently reclassify every route as OUTSIDE and report a
 * triumphant drop in legacy pages.
 */
function shellRoutes() {
  const source = readFileSync('src/lib/app-nav.ts', 'utf8');
  const block = source.slice(source.indexOf('SHELL_ROUTES'));
  const entries = [...block.matchAll(/\{\s*path:\s*'([^']+)',\s*kind:\s*'(exact|prefix)'/g)]
    .map((m) => ({ path: m[1], kind: m[2] }));
  if (entries.length === 0) {
    console.error('[audit:routes] Parsed 0 SHELL_ROUTES entries — app-nav.ts changed shape.');
    process.exit(1);
  }
  return entries;
}

function routePaths() {
  return globSync('src/app/**/page.tsx')
    .map((file) => {
      const dir = file.slice('src/app'.length).replace(/\/page\.tsx$/, '');
      // Route groups `(marketing)` are organisational and not part of the URL.
      const path = dir.replace(/\/\([^/]+\)/g, '');
      return path === '' ? '/' : path;
    })
    .sort();
}

/** Source text with comments stripped, for the reachability scan. */
function sourceCorpus() {
  return globSync('src/**/*.{ts,tsx}')
    .filter((f) => !f.includes('__tests__'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function main() {
  const entries = shellRoutes();
  const corpus = sourceCorpus();

  const inShell = (path) =>
    entries.some((e) => (e.kind === 'exact' ? path === e.path : path === e.path || path.startsWith(`${e.path}/`)));

  const linked = (path) => {
    if (path === '/') return true;
    // Match on the static prefix: a dynamic route is linked via a template
    // literal whose leading text is all a scan can see.
    const stat = path.split('/[')[0];
    if (!stat || stat === '/') return true;
    return new RegExp(`["'\`]${stat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[/"'\`?]`).test(corpus);
  };

  const groups = { mmm: [], legacyShell: [], outside: [] };
  for (const path of routePaths()) {
    const row = { path, linked: linked(path) };
    if (path === '/app' || path.startsWith('/app/')) groups.mmm.push(row);
    else if (inShell(path)) groups.legacyShell.push(row);
    else groups.outside.push(row);
  }

  const total = groups.mmm.length + groups.legacyShell.length + groups.outside.length;
  console.log('\n  ROUTE INVENTORY\n');
  console.log(`  ${String(groups.mmm.length).padStart(4)}  MMM (/app/*)            the design system's shell`);
  console.log(`  ${String(groups.legacyShell.length).padStart(4)}  legacy app shell        ← the retirement target`);
  console.log(`  ${String(groups.outside.length).padStart(4)}  outside both shells     marketing, legal, auth, admin`);
  console.log(`  ${String(total).padStart(4)}  total\n`);

  const unlinked = [...groups.mmm, ...groups.legacyShell, ...groups.outside].filter((r) => !r.linked);
  console.log(`  ${unlinked.length} route(s) with no inbound link in src/ — a question, not a verdict;`);
  console.log('  most are deliberate redirect aliases for URLs already in sent email.\n');

  if (WANT_LIST) {
    for (const [label, rows] of [
      ['MMM', groups.mmm],
      ['LEGACY APP SHELL', groups.legacyShell],
      ['OUTSIDE BOTH SHELLS', groups.outside],
    ]) {
      console.log(`  ── ${label} ${'─'.repeat(Math.max(0, 52 - label.length))}`);
      for (const row of rows) console.log(`     ${row.linked ? ' ' : '·'} ${row.path}`);
      console.log('');
    }
    console.log('  · = nothing in src/ links here\n');
  } else {
    console.log('  Run with --list to see every route.\n');
  }

  if (MAX_LEGACY !== null && groups.legacyShell.length > MAX_LEGACY) {
    console.error(
      `  FAIL: ${groups.legacyShell.length} routes in the legacy app shell, above the agreed ${MAX_LEGACY}.\n` +
      '  This number must go down. Do not raise it to make a build pass.\n',
    );
    process.exit(1);
  }
}

main();
