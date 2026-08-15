#!/usr/bin/env node
/**
 * Packages the LEGACY-SHELL pages for handoff to Claude Design.
 *
 * The design workflow in this repo runs one way: Claude Design authors a
 * `.dc.html`, Claude Code translates it into the `.tsx`. That works when the
 * design is the thing being created. It does not work for the ~50 pages that
 * already exist inside the legacy app shell and have never been through DS8:
 * the design side cannot redraw a page it cannot see, and asking it to invent
 * one from a route name produces a page that has to be reconciled with the
 * real one afterwards — which is how a surface ends up with two designs.
 *
 * So this exports what is actually on screen today. For each legacy route it
 * captures the rendered DOM, screenshots at both widths, and a content outline
 * (headings, actions, labels, and the copy under them). That is the input a
 * redesign works FROM.
 *
 * ## The route list is parsed, never re-typed
 *
 * `SHELL_ROUTES` in `src/lib/app-nav.ts` is the one definition of which routes
 * render inside `AppShell`, and `scripts/audit-routes.mjs` already parses it
 * rather than duplicating it. This does the same, and fails loudly on zero
 * entries for the same reason: a format change must break this script rather
 * than silently export an empty set and look like the work is done.
 *
 * ## It exports STRUCTURE and COPY, not styling
 *
 * The screenshots are for orientation. What a redesign needs is the inventory
 * — every heading, every control, every piece of copy that has to survive the
 * redraw — because that is what gets silently dropped when a page is rebuilt
 * from a picture. The outline is the deliverable; the PNG is context for it.
 *
 * ## Content, not chrome
 *
 * Everything is captured from inside `.shell-content`, the app shell's one
 * scrolling region. The header, drawer and dock are the SAME on every page and
 * are already designed (SHELL_LOCK_2026-08-08.md signed them off as final), so
 * exporting them 50 times would bury the part that differs in the part that
 * does not.
 *
 * Usage — needs an instance to read and a session cookie for gated pages:
 *
 *     BASE=http://localhost:8787 \
 *     SESSION_COOKIE='__Secure-authjs.session-token=…' \
 *     node scripts/export-legacy-for-design.mjs
 *
 * Writes to `design/export/legacy/`, which is gitignored — these are large
 * binary snapshots of a moving target, and committing them would put a
 * regenerable artifact under review on every change.
 */

import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8787';
const SESSION_COOKIE = process.env.SESSION_COOKIE || '';
const DEVICE_COOKIE = process.env.DEVICE_COOKIE || '';
const OUT_DIR = process.env.OUT_DIR || 'design/export/legacy';
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);

/** Parsed out of app-nav.ts. See the header. */
function shellRoutes() {
  const source = readFileSync('src/lib/app-nav.ts', 'utf8');
  const block = source.slice(source.indexOf('SHELL_ROUTES'));
  const entries = [...block.matchAll(/\{\s*path:\s*'([^']+)',\s*kind:\s*'(exact|prefix)'/g)]
    .map((m) => ({ path: m[1], kind: m[2] }));
  if (entries.length === 0) {
    console.error('[export:design] Parsed 0 SHELL_ROUTES entries — app-nav.ts changed shape.');
    process.exit(1);
  }
  return entries;
}

/**
 * Which DS8 template governs a route, straight out of the map.
 *
 * Carried into the export so the design side is not asked to work out the
 * mapping a second time — and so a route with NO template is visible as a
 * question rather than an omission.
 */
function templateMap() {
  const path = 'design/design-system-8/ROUTE_TEMPLATE_MAP.md';
  const rows = [];
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const cells = line.split('|').map((c) => c.trim());
      if (cells.length < 4) continue;
      const template = cells[2]?.match(/`(templates\/[^`]+)`/)?.[1];
      if (!template) continue;
      for (const route of cells[1].matchAll(/`([^`]+)`/g)) rows.push({ route: route[1], template });
    }
  } catch {
    // Absent map is reported per-route as "unmapped" rather than fatal: the
    // export is still useful without it.
  }
  return rows;
}

function templateFor(route, rows) {
  const exact = rows.find((r) => r.route === route);
  if (exact) return exact.template;
  const prefix = rows.find((r) => r.route.endsWith('/*') && route.startsWith(r.route.slice(0, -2)));
  return prefix?.template ?? null;
}

/** A route becomes a directory name: `/shows/[slug]` → `shows--slug`. */
const dirNameFor = (route) =>
  route.replace(/^\//, '').replace(/[[\]]/g, '').replace(/\//g, '--') || 'root';

/**
 * A dynamic route cannot be fetched as written — `/artists/[slug]` is not a
 * URL. These are the stand-ins, and they are the preview-namespace rows from
 * `seed-preview-content.mjs`, so an exported page has real content on it
 * rather than an empty state that misrepresents the design.
 */
const PREFIX_SAMPLES = {
  // These prefixes have NO index page — `/tracks` and `/playlist` exist only
  // as `[hexId]`/`[slug]`, and `/events` only as `/events/new`. Fetching the
  // bare prefix returns 404, which the first run of this script duly exported
  // as four "pages" that do not exist.
  '/events': '/events/new',
  '/tracks': null,
  '/playlist': null,
  '/payout': null,
};

/**
 * Detail pages, captured IN ADDITION to their index.
 *
 * `/artists` and `/artists/preview-harbor-lights` are different designs, and a
 * redesign that only ever sees the index will redraw the index. The slugs are
 * `seed-preview-content.mjs`'s rows, so these pages carry real content rather
 * than an empty state that misrepresents the layout.
 */
const DETAIL_ROUTES = [
  { route: '/artists/[slug]', url: '/artists/preview-harbor-lights' },
  { route: '/venues/[slug]', url: '/venues/preview-state-theatre' },
  { route: '/shows/[slug]', url: '/shows/preview-show-2' },
];

function resolveUrl(route) {
  if (route in PREFIX_SAMPLES) return PREFIX_SAMPLES[route];
  if (route.includes('[')) return null;
  return route;
}

async function capture(page, route, url, template) {
  const dir = join(OUT_DIR, dirNameFor(route));
  mkdirSync(dir, { recursive: true });

  // `domcontentloaded`, not `networkidle`. A page holding any long-lived
  // connection — an analytics beacon, a poll, a font still streaming — never
  // reaches network idle, and the first run timed out on `/artists`,
  // `/venues` and `/fans` for exactly that reason while they were rendering
  // perfectly well. The settle wait below is what the screenshots need.
  const response = await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1200);
  const status = response?.status() ?? 0;
  // AN EXPIRED SESSION MUST NOT EXPORT AS A PAGE.
  //
  // Gated routes redirect to /login, which answers 200 — so without this the
  // export happily writes the sign-in screen into `settings--accessibility/`
  // and reports a successful capture. The first real run did exactly that for
  // 11 of 28 pages, and every one looked fine in the index. A design handed
  // that would redraw the login page eleven times.
  //
  // Checked on the landed URL rather than the title, because the title is
  // page-authored and a route could legitimately be called "Sign in".
  const landed = new URL(page.url()).pathname;
  const bounced = landed !== url && (landed.startsWith('/login') || landed.startsWith('/register'));

  // Everything below reads from the shell's content region only — see header.
  const extracted = await page.evaluate(() => {
    const root = document.querySelector('.shell-content') || document.body;
    const text = (el) => (el.innerText || '').trim().replace(/\s+/g, ' ');
    const take = (sel) => [...root.querySelectorAll(sel)].map(text).filter(Boolean);
    return {
      title: document.title,
      h1: take('h1'),
      h2: take('h2'),
      h3: take('h3'),
      actions: [...new Set(take('button, a.button, [role="button"]'))].slice(0, 60),
      labels: [...new Set(take('label, .meta, .badge, .eyebrow'))].slice(0, 80),
      paragraphs: take('p').slice(0, 40),
      tableHeads: take('th'),
      html: root.outerHTML,
    };
  });

  writeFileSync(join(dir, 'content.html'), extracted.html);

  const outline = [
    `# ${route}`,
    '',
    `- **URL captured:** \`${url}\``,
    `- **HTTP status:** ${status}`,
    `- **DS8 template:** ${template ? `\`${template}\`` : '**unmapped — needs a decision**'}`,
    `- **Page title:** ${extracted.title}`,
    '',
    '## Headings',
    ...(extracted.h1.length ? extracted.h1.map((h) => `1. ${h}`) : ['_none_']),
    ...extracted.h2.map((h) => `  - ${h}`),
    ...extracted.h3.map((h) => `    - ${h}`),
    '',
    '## Actions on this page',
    ...(extracted.actions.length ? extracted.actions.map((a) => `- ${a}`) : ['_none_']),
    '',
    '## Labels, badges and meta',
    ...(extracted.labels.length ? extracted.labels.map((l) => `- ${l}`) : ['_none_']),
    '',
    '## Table columns',
    ...(extracted.tableHeads.length ? extracted.tableHeads.map((t) => `- ${t}`) : ['_none_']),
    '',
    '## Copy',
    ...(extracted.paragraphs.length ? extracted.paragraphs.map((p) => `> ${p}`) : ['_none_']),
    '',
    '## Files',
    '- `content.html` — the rendered content region, chrome excluded',
    '- `phone.png` — 393px',
    '- `desktop.png` — 1280px',
    '',
  ].join('\n');
  writeFileSync(join(dir, 'outline.md'), outline);

  await page.setViewportSize({ width: 393, height: 852 });
  await page.screenshot({ path: join(dir, 'phone.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: join(dir, 'desktop.png'), fullPage: true });

  return { route, url, status, template, bounced, headings: extracted.h1.length + extracted.h2.length };
}

async function main() {
  // Deduped by path: SHELL_ROUTES carries both an `exact` and a `prefix` entry
  // for some routes (`/shows` is both), and capturing the same URL twice
  // produces two identical directories and a misleading page count.
  const seen = new Set();
  const entries = shellRoutes()
    .filter((e) => (seen.has(e.path) ? false : seen.add(e.path)))
    .filter((e) => (ONLY ? e.path.includes(ONLY) : true))
    .concat(DETAIL_ROUTES.filter((d) => (ONLY ? d.route.includes(ONLY) : true)).map((d) => ({ path: d.route, kind: 'detail', url: d.url })));
  const rows = templateMap();

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  // `CHROMIUM_PATH` because the browser lives in different places depending on
  // who is running this: CI installs Playwright's own build, while a sandbox
  // may ship a system Chromium at /opt/pw-browsers/chromium and no headless
  // shell at all. Undefined falls back to Playwright's default resolution.
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  if (SESSION_COOKIE) {
    const cookies = [SESSION_COOKIE, DEVICE_COOKIE].filter(Boolean).map((raw) => {
      const [name, ...rest] = raw.split('=');
      return {
        name: name.trim(),
        value: rest.join('='),
        domain: new URL(BASE).hostname,
        path: '/',
        // `__Secure-` and `__Host-` prefixes are only legal on a secure cookie,
        // and Chromium rejects the whole call rather than the one field.
        secure: name.trim().startsWith('__Secure-') || name.trim().startsWith('__Host-'),
      };
    });
    await context.addCookies(cookies);
  }

  const page = await context.newPage();
  const results = [];
  const skipped = [];

  for (const entry of entries) {
    const url = entry.url ?? resolveUrl(entry.path);
    if (!url) {
      // Named rather than dropped: a dynamic route with no sample is a gap in
      // this script's fixtures, and a silent omission would read as "that page
      // does not exist".
      skipped.push(entry.path);
      continue;
    }
    try {
      const result = await capture(page, entry.path, url, templateFor(entry.path, rows));
      if (result.bounced) {
        skipped.push(`${entry.path} (needs a session — bounced to sign-in)`);
        rmSync(join(OUT_DIR, dirNameFor(entry.path)), { recursive: true, force: true });
        console.log(`  auth ${entry.path} — bounced to sign-in`);
        continue;
      }
      if (result.status >= 400) {
        // Exporting a 404 as a page to redesign is worse than not exporting it:
        // it puts a surface on the list that does not exist.
        skipped.push(`${entry.path} (HTTP ${result.status} at ${url})`);
        rmSync(join(OUT_DIR, dirNameFor(entry.path)), { recursive: true, force: true });
        console.log(`  skip ${entry.path} — ${result.status}`);
        continue;
      }
      results.push(result);
      console.log(`  ${String(result.status).padEnd(4)} ${entry.path}`);
    } catch (error) {
      skipped.push(`${entry.path} (${error instanceof Error ? error.message.slice(0, 60) : 'failed'})`);
    }
  }

  await browser.close();

  const unmapped = results.filter((r) => !r.template);
  const index = [
    '# Legacy shell pages — export for design',
    '',
    `Captured from \`${BASE}\`. Regenerate with \`node scripts/export-legacy-for-design.mjs\`.`,
    '',
    'These are the pages that render inside the LEGACY app shell and have not',
    'been through Design System 8. Each directory holds the rendered content',
    'region, an outline of everything on the page that has to survive a redraw,',
    'and screenshots at both widths.',
    '',
    'The chrome — header, drawer, dock — is deliberately excluded. It is the same',
    'on every page and was signed off as final in `SHELL_LOCK_2026-08-08.md`.',
    '',
    `## Pages (${results.length})`,
    '',
    '| Route | Status | DS8 template |',
    '|---|---|---|',
    ...results.map((r) => `| [\`${r.route}\`](./${dirNameFor(r.route)}/outline.md) | ${r.status} | ${r.template ? `\`${r.template}\`` : '**unmapped**'} |`),
    '',
    ...(unmapped.length
      ? [
          `## Unmapped (${unmapped.length})`,
          '',
          'No DS8 template governs these routes. That is a decision to make before',
          'redrawing them, not something to infer from a neighbouring page.',
          '',
          ...unmapped.map((r) => `- \`${r.route}\``),
          '',
        ]
      : []),
    ...(skipped.length
      ? [
          `## Not captured (${skipped.length})`,
          '',
          'Dynamic routes with no sample row, or pages that failed to load. Add a',
          'sample to `DYNAMIC_SAMPLES` and re-run.',
          '',
          ...skipped.map((s) => `- \`${s}\``),
          '',
        ]
      : []),
  ].join('\n');

  writeFileSync(join(OUT_DIR, 'README.md'), index);

  console.log(`\nExported ${results.length} pages to ${OUT_DIR}`);
  if (unmapped.length) console.log(`  ${unmapped.length} have no DS8 template`);
  if (skipped.length) console.log(`  ${skipped.length} not captured`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
