#!/usr/bin/env node
/*
  EVERY ABSOLUTE URL THIS PRODUCT PUBLISHES, RESOLVED AGAINST THE ROUTES IT
  ACTUALLY HAS.

  A published URL is a claim about a route the same way a documented path is a
  claim about a file, and nothing in this repository compared either until
  `audit:doc-paths` closed the first half. This closes the second.

  What it found on the run that produced it (2026-09-14), all measured against
  production rather than reasoned about:

    - `email-digest.ts` put `/shows` in the DAILY digest, twice. Signed in that
      is an HTTP 404 — `src/app/shows/` holds only `[slug]`.
    - `weekly-picks.ts` and `new-to-scene.ts` put `/discover` in the Monday
      mail. Also 404: that route was deleted 2026-08-18 and, unusually, not
      even aliased.
    - `sitemap.ts` submitted SIX URLs `robots.txt` forbids, including its two
      highest-priority entries.

  TWO KINDS OF WRONG, AND THEY ARE NOT THE SAME KIND.

  DEAD is absolute: a path that resolves to no route and no redirect is broken
  for everyone, in an email or anywhere else.

  BLOCKED is about the SITEMAP ONLY, and conflating the two would make this
  script useless. `robots.txt` disallows `/app`, so a sitemap entry that lands
  there is a contradiction search engines report as an error — while an EMAIL
  link to `/app/me/events/new` is exactly right, because the member reading it
  is signed in. The same URL is correct in one publisher and wrong in the
  other. Only entries reached from `sitemap.ts` are judged against robots.

  `sitemap.ts`'s own docstring already states the rule — "The sitemap must not
  offer search engines a URL the page itself refuses to render" — and records
  fixing this contradiction once before, for `/register` and `/login`. That fix
  went to the two URLs named at the time rather than to the rule, and the
  contradiction came back on six entries. THAT is why this is a script and not
  a comment.

  IT READS THE THREE LISTS RATHER THAN RESTATING THEM — the route tree from
  `src/app/`, the redirects from `next.config.mjs`, the disallow list from
  `src/app/robots.ts`. Every area of this codebase that hurt did so because two
  copies of one fact drifted (`csp-routes.ts` twice, `measure:dock`'s private
  token table, the cron dispatcher's schedules). A scanner that hardcodes what
  it checks is the same defect wearing a lab coat.
*/
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { maskComments } from './lib/mask-comments.mjs';

const ROOT = process.cwd();
const APP = join(ROOT, 'src', 'app');

const args = process.argv.slice(2);
const MAX = Number((args.find((a) => a.startsWith('--max=')) || '--max=0').slice(6));

/* ---------- the three lists, read from source ---------- */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Every URL path the App Router serves, with `[param]` kept as a wildcard. */
function routeTable() {
  const routes = [];
  for (const file of walk(APP)) {
    const name = file.split('/').pop();
    /* METADATA FILES ARE ROUTES, UNDER NAMES OF THEIR OWN. `sitemap.ts` serves
       `/sitemap.xml` and `robots.ts` serves `/robots.txt`, so a table built
       from `page`/`route` alone reports robots.ts's own sitemap link as dead —
       which it did on the first run. */
    const metadata = { 'sitemap.ts': 'sitemap.xml', 'robots.ts': 'robots.txt', 'manifest.ts': 'manifest.webmanifest' }[name];
    if (!metadata && !/^(page|route)\.(t|j)sx?$/.test(name)) continue;
    let p = '/' + relative(APP, file).split('/').slice(0, -1).concat(metadata ? [metadata] : []).join('/');
    // Route groups `(marketing)` and parallel slots `@slot` are not URL segments.
    p = p.split('/').filter((s) => !/^[(@]/.test(s)).join('/') || '/';
    routes.push(p === '' ? '/' : p);
  }
  return routes;
}

/** `source -> destination` from next.config.mjs's redirects().
 *
 *  SCOPED TO `redirects()` AND PAIRED BY SEGMENT, both learned the hard way on
 *  the first run. A naive "source, then the next destination within N chars"
 *  desynchronises the moment an entry carries a `has:` block, and it also
 *  scoops up `headers()` — whose entries have a `source` and no destination at
 *  all, so each one steals the next redirect's. The visible symptom was
 *  `/artists` reported DEAD while production answers 308 to `/app/map`.
 *  A scanner that is wrong about its own inputs invents findings, and an
 *  invented finding is worse than a missed one: it is what teaches people to
 *  stop reading the output. */
function redirectTable() {
  const src = maskComments(readFileSync(join(ROOT, 'next.config.mjs'), 'utf8'));
  const start = src.indexOf('redirects()');
  if (start < 0) return [];
  // Up to the next top-level config member, so `headers()` is never read here.
  const after = src.slice(start);
  const end = after.search(/\n\s{0,4}(headers|rewrites|async headers|async rewrites)\s*\(/);
  const body = end < 0 ? after : after.slice(0, end);

  const table = [];
  const chunks = body.split(/source:\s*/).slice(1);
  for (const chunk of chunks) {
    const source = /^'([^']+)'/.exec(chunk);
    if (!source) continue;
    // The first destination BEFORE the next source — never across an entry.
    const destination = /destination:\s*'([^']+)'/.exec(chunk);
    if (!destination) continue;

    /* A CONDITIONAL REDIRECT CANNOT BE ASSUMED FOR A PLAIN PATH. The www→apex
       rule is `source: '/:path*'` with `has: [{ type: 'host', value:
       'www.ihype.org' }]` — it matches EVERY path, so a table that ignores the
       condition hands it to the first lookup and every URL "resolves" through
       it to an absolute URL on another host. The symptom was `/artists`
       reported DEAD while production answers 308, and the entry that swallowed
       it was three hundred lines away from anything to do with artists. Skip
       anything carrying `has:` or `missing:`. */
    if (/\b(has|missing):\s*\[/.test(chunk.slice(0, destination.index))) continue;

    /* An absolute destination leaves this app's route table entirely; there is
       nothing here to resolve it against, and the canonical-host rule above is
       the only one that has one. */
    if (/^https?:/.test(destination[1])) continue;

    table.push({ source: source[1], destination: destination[1] });
  }
  return table;
}

/** The disallow list, read from robots.ts rather than restated. */
function disallowList() {
  const src = maskComments(readFileSync(join(APP, 'robots.ts'), 'utf8'));
  const block = /disallow:\s*\[([\s\S]*?)\]/.exec(src);
  if (!block) return [];
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/* ---------- matching ---------- */

/** A concrete path against one route pattern, `[slug]` and `[...rest]` included. */
function routeMatches(pattern, path) {
  const pp = pattern.split('/').filter(Boolean);
  const ap = path.split('/').filter(Boolean);
  for (let i = 0; i < pp.length; i++) {
    if (/^\[\.\.\./.test(pp[i])) return ap.length >= i;
    if (ap[i] === undefined) return false;
    if (/^\[.+\]$/.test(pp[i])) continue;
    if (pp[i] !== ap[i]) return false;
  }
  return pp.length === ap.length;
}

/** Next matches `/a/:b` and `/a/:path*` in redirect sources. */
function sourceMatches(source, path) {
  const sp = source.split('/').filter(Boolean);
  const ap = path.split('/').filter(Boolean);
  for (let i = 0; i < sp.length; i++) {
    if (/^:.*\*$/.test(sp[i])) return ap.length >= i;
    if (ap[i] === undefined) return false;
    if (/^:/.test(sp[i])) continue;
    if (sp[i] !== ap[i]) return false;
  }
  return sp.length === ap.length;
}

const isBlocked = (path, disallow) =>
  disallow.some((d) => path === d || path.startsWith(d.endsWith('/') ? d : `${d}/`));

/* ---------- the publishers ---------- */

/* An interpolation is an unknown VALUE, not an unknown SHAPE: `${base}/artists/${p.slug}`
   is one segment of slug, so it stands in for exactly one segment and resolves
   against `[slug]`. Collapsing it to nothing instead would make every dynamic
   URL look like its own parent and hide the very cases worth checking. */
/* `<` and `>` TERMINATE A PATH. An RSS feed (the retired `artists/verified.rss` did) writes its URLs inside
   XML — `<link>${baseUrl}/artists</link>` — and the first draft of this regex
   swallowed the closing tag, reporting `/artists</link>` as a dead route. The
   first list containing something like that is the last one anyone reads
   carefully, which is the lesson `audit:untranslated` records about its own
   bracket heuristic. Found by sampling the output, not by reading the code. */
const BASE = /\$\{(?:getBaseUrl\(\)|baseUrl|BASE_URL|BASE|appUrl|base)\}((?:\/[^`'"\s)<>]*)?)/g;

function publishedUrls() {
  const found = [];
  for (const file of walk(join(ROOT, 'src'))) {
    if (!/\.(t|j)sx?$/.test(file) || /__tests__|\.test\./.test(file)) continue;
    const rel = relative(ROOT, file);
    const src = maskComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(BASE)) {
      let path = (m[1] || '/').split('?')[0].split('#')[0];
      path = path.replace(/\$\{[^}]*\}/g, 'x');   // one value, one segment
      if (path !== '/' ) path = path.replace(/\/$/, '');
      if (!path.startsWith('/')) continue;
      found.push({
        file: rel,
        line: src.slice(0, m.index).split('\n').length,
        path,
        // Only what the SITEMAP submits is judged against robots.
        sitemap: rel === 'src/app/sitemap.ts',
      });
    }
  }
  return found;
}

/* ---------- run ---------- */

const routes = routeTable();
const redirects = redirectTable();
const disallow = disallowList();
const urls = publishedUrls();

/* A zero is earned, never assumed — the same refusal `audit:mounts` and
   `audit:doc-paths` make. Each of these going quiet is a rename, not a
   triumph. */
if (!routes.length || !redirects.length || !disallow.length || !urls.length) {
  console.error('\nThis scan collected nothing it needs:');
  console.error(`  routes ${routes.length} · redirects ${redirects.length} · disallow ${disallow.length} · published URLs ${urls.length}`);
  console.error('A path has moved. Fix the roots rather than reading this as a pass.');
  process.exit(2);
}

/** Resolve a path through the redirect table until it lands (or loops). */
function resolve(path) {
  const seen = new Set();
  let current = path;
  for (let hop = 0; hop < 5; hop++) {
    /* REDIRECTS FIRST, AS NEXT DOES (row 513). `redirects()` runs before the
       filesystem, so a file route under a redirect's source is SHADOWED — the
       `/artists/verified.rss` handler answered 307 into `/app/artists/…` in
       production while this check, testing routes first, called it resolved. */
    const hit = redirects.find((r) => sourceMatches(r.source, current));
    if (!hit) {
      return routes.some((r) => routeMatches(r, current)) ? { final: current, ok: true } : { final: current, ok: false };
    }
    if (seen.has(hit.destination)) return { final: current, ok: false };
    seen.add(hit.destination);
    current = hit.destination.split('?')[0].replace(/:[A-Za-z]+\*?/g, 'x');
  }
  return { final: current, ok: false };
}

const dead = [];
const blocked = [];
for (const u of urls) {
  const { final, ok } = resolve(u.path);
  if (!ok) { dead.push({ ...u, final }); continue; }
  if (u.sitemap && isBlocked(final, disallow)) blocked.push({ ...u, final });
}

console.log(`Resolved ${urls.length} published URL(s) against ${routes.length} routes and ${redirects.length} redirects.`);
console.log(`robots.txt disallows: ${disallow.join(' ')}\n`);

for (const d of dead) {
  console.log(`DEAD     ${d.path}`);
  console.log(`         ${d.file}:${d.line} — no route and no redirect answers this.`);
}
for (const b of blocked) {
  console.log(`BLOCKED  ${b.path}  ->  ${b.final}`);
  console.log(`         ${b.file}:${b.line} — the sitemap submits it and robots.txt forbids the destination.`);
}

const total = dead.length + blocked.length;
if (total > MAX) {
  console.error(`\nFAIL — ${dead.length} dead, ${blocked.length} robots-blocked, budget ${MAX}.`);
  console.error('A published URL is a promise. Point it at a route that answers,');
  console.error('and never submit to a sitemap what robots.txt refuses.');
  process.exit(1);
}
console.log(
  total === 0
    ? `Every published URL resolves, and the sitemap submits nothing robots.txt forbids. (budget ${MAX})`
    : `${total} finding(s), within the budget of ${MAX}.`,
);
