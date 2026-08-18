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
 *     npm run audit:routes -- --max-legacy=50
 *
 * The ratchet is the point: that count must go DOWN. Never raise it to make a
 * build pass — raising it is the whole failure this measures.
 */

import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
import ts from 'typescript';

const ARGS = process.argv.slice(2);
const WANT_LIST = ARGS.includes('--list');
const MAX_LEGACY = (() => {
  const raw = ARGS.find((a) => a.startsWith('--max-legacy='));
  return raw ? Number(raw.split('=')[1]) : null;
})();

// Tombstones for URL families that once rendered the retired authenticated
// shell. This is intentionally audit-only: no runtime navigation registry may
// claim them again. Public marketing/auth/admin routes are absent.
const RETIRED_APP_ROUTES = [
  '/radio', '/discover', '/search', '/tracks', '/playlist',
  '/shows', '/tickets', '/events', '/this-weekend', '/for-you',
  '/me/promote', '/payout', '/payouts', '/pages', '/me/dashboard',
  '/me/analytics', '/me/booking', '/artists', '/promoters', '/venues',
  '/fans', '/settings', '/community', '/legal',
].map((path) => ({ path, kind: 'prefix' }));

/**
 * Public surfaces that sit under a retired prefix and are NOT the retired shell.
 *
 * `/shows/[slug]` is the URL people share to sell tickets. It renders logged
 * out, it is indexed, and it carries the ticket purchase card — so it belongs
 * with `/`, `/info` and `/login` in OUTSIDE, not in the retirement target.
 *
 * This is not a loophole for porting work: it is an exact path, and the test
 * for adding another is whether the page must serve a signed-out stranger. If
 * it only ever serves a signed-in member, it is shell work and belongs in the
 * ratchet. Getting this wrong once already cost real money — the page was
 * turned into an alias into `/app/*`, which is auth-gated, so every shared
 * ticket link bounced a buyer to the login screen.
 */
const PUBLIC_EXCEPTIONS = new Set(['/shows/[slug]']);

function routes() {
  return globSync('src/app/**/page.tsx')
    .map((file) => {
      // `glob` returns native separators on Windows. Normalize before parsing
      // routes or every `/app/*` page becomes a literal `\app\...\page.tsx`
      // string and the audit reports a false zero for both MMM and legacy
      // shells — exactly the failure this inventory exists to prevent.
      const normalized = file.replaceAll('\\', '/');
      const dir = normalized.slice('src/app'.length).replace(/\/page\.tsx$/, '');
      // Route groups `(marketing)` are organisational and not part of the URL.
      const path = dir.replace(/\/\([^/]+\)/g, '');
      return { file: normalized, path: path === '' ? '/' : path };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Compatibility aliases are not rendered legacy surfaces. Keep this
 * deliberately conservative: a redirect import plus no JSX means the page
 * cannot paint the retired shell before navigating. A page containing any JSX
 * remains in the rendered count even when it also redirects for auth.
 */
function isRedirectOnly(file) {
  const source = readFileSync(file, 'utf8');
  if (!/from ['"]next\/navigation['"]/.test(source) || !/\bredirect\s*\(/.test(source)) return false;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let hasJsx = false;
  const visit = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      hasJsx = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return !hasJsx;
}

/** Source text with comments stripped, for the reachability scan. */
function sourceCorpus() {
  return globSync('src/**/*.{ts,tsx}')
    .map((file) => file.replaceAll('\\', '/'))
    .filter((f) => !f.includes('__tests__'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function main() {
  const entries = RETIRED_APP_ROUTES;
  const corpus = sourceCorpus();

  const inShell = (path) =>
    !PUBLIC_EXCEPTIONS.has(path) &&
    entries.some((e) => (e.kind === 'exact' ? path === e.path : path === e.path || path.startsWith(`${e.path}/`)));

  const linked = (path) => {
    if (path === '/') return true;
    // Match on the static prefix: a dynamic route is linked via a template
    // literal whose leading text is all a scan can see.
    const stat = path.split('/[')[0];
    if (!stat || stat === '/') return true;
    return new RegExp(`["'\`]${stat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[/"'\`?]`).test(corpus);
  };

  const groups = { mmm: [], legacyShell: [], legacyRedirect: [], outside: [] };
  for (const { file, path } of routes()) {
    const row = { path, linked: linked(path) };
    if (path === '/app' || path.startsWith('/app/')) groups.mmm.push(row);
    else if (inShell(path) && isRedirectOnly(file)) groups.legacyRedirect.push(row);
    else if (inShell(path)) groups.legacyShell.push(row);
    else groups.outside.push(row);
  }

  const total = groups.mmm.length + groups.legacyShell.length + groups.legacyRedirect.length + groups.outside.length;
  console.log('\n  ROUTE INVENTORY\n');
  console.log(`  ${String(groups.mmm.length).padStart(4)}  MMM (/app/*)            the design system's shell`);
  console.log(`  ${String(groups.legacyShell.length).padStart(4)}  rendered legacy pages   ← the retirement target`);
  console.log(`  ${String(groups.legacyRedirect.length).padStart(4)}  compatibility redirects safe aliases into MMM`);
  console.log(`  ${String(groups.outside.length).padStart(4)}  outside both shells     marketing, legal, auth, admin`);
  console.log(`  ${String(total).padStart(4)}  total\n`);

  const unlinked = [...groups.mmm, ...groups.legacyShell, ...groups.legacyRedirect, ...groups.outside].filter((r) => !r.linked);
  console.log(`  ${unlinked.length} route(s) with no inbound link in src/ — a question, not a verdict;`);
  console.log('  most are deliberate redirect aliases for URLs already in sent email.\n');

  if (WANT_LIST) {
    for (const [label, rows] of [
      ['MMM', groups.mmm],
      ['RENDERED LEGACY PAGES', groups.legacyShell],
      ['COMPATIBILITY REDIRECTS', groups.legacyRedirect],
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
