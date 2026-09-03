import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';

/* Source with comments removed. Every guard in this file matches on CODE, and
   three separate versions of these checks passed while reading an explanatory
   comment that merely mentioned the thing they were meant to prove. A comment
   is not coverage — strip first, then match. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(`${dir}/${e.name}`) : e.name.endsWith('.ts') ? [`${dir}/${e.name}`] : [],
  );
}

/**
 * Every scheduled job is actually scheduled, and every job it names exists.
 *
 * Cloudflare invokes the cron Worker only on the expressions listed in
 * `wrangler.cron.toml`, and `workers/cron.ts` then matches
 * `job.schedule === event.cron` — an EXACT string comparison. A job whose
 * schedule is not in the toml is therefore not "late" or "misconfigured": it
 * has never run, and nothing anywhere says so. The dispatcher logs
 * "No job matched schedule" for the opposite case and nothing at all for this
 * one.
 *
 * That is not hypothetical. `/api/cron/nearby-show-notify` sat at
 * `0 9 * * *` under a comment reading "already covered by daily 9am slot".
 * There was no daily 9am slot — the two nine-o'clock entries are
 * `0 9 * * 1` (Monday) and `0 9 1 * *` (the 1st of the month) — so the job
 * that tells a fan about a show near them never fired once. Three sibling
 * comments in the same block made the same claim and were correct, which is
 * exactly why the wrong one read as safe.
 *
 * A comment cannot be a coverage guarantee. This is.
 */

const dispatcher = readFileSync('workers/cron.ts', 'utf8');
const toml = readFileSync('wrangler.cron.toml', 'utf8');
const cronRoute = readFileSync('src/app/api/cron/route.ts', 'utf8');

type Job = { path: string; schedule: string };

const jobs: Job[] = [...dispatcher.matchAll(/path:\s*'([^']+)'\s*,\s*schedule:\s*'([^']+)'/g)]
  .map((match) => ({ path: match[1], schedule: match[2] }));

/** The `crons = [...]` array with its comments stripped — a `#` note is not a trigger. */
const armed: string[] = (() => {
  const block = /^crons\s*=\s*\[([\s\S]*?)^\]/m.exec(toml);
  if (!block) throw new Error('wrangler.cron.toml has no crons array');
  return [...block[1].replace(/#.*/g, '').matchAll(/"([^"]+)"/g)].map((m) => m[1]);
})();

/**
 * The service worker's precache list holds only pages that really are pages.
 *
 * `cache.addAll()` rejects the WHOLE batch on any non-2xx, so one dead entry
 * does not degrade the precache — it means `/offline` is never stored and the
 * offline fallback is missing exactly when it is needed. (`/shows` did this
 * once; CLAUDE.md records it.) A REDIRECT is the quieter version of the same
 * mistake: it installs fine, but the stored response carries
 * `redirected: true`, and `FetchEvent.respondWith()` refuses a redirected
 * response for a navigation — so the cached copy can only ever fail. `/hype`
 * was such an entry, a 307 to the `/` sitting directly above it.
 */
describe('the service worker precache list', () => {
  const sw = readFileSync('public/sw.js', 'utf8');
  const corePages: string[] = (() => {
    const block = /const CORE_PAGES = \[([\s\S]*?)\];/.exec(sw);
    if (!block) throw new Error('sw.js has no CORE_PAGES array');
    // Strip both comment styles first — a path named inside prose is not an entry.
    const body = block[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  })();

  const redirectSources = new Set(
    [...readFileSync('next.config.mjs', 'utf8').matchAll(/source:\s*'([^']+)'[\s\S]{0,200}?destination:/g)].map((m) => m[1]),
  );

  it('parses a non-empty list, so a format change fails here rather than passing vacuously', () => {
    expect(corePages.length).toBeGreaterThan(0);
  });

  it('precaches no redirect', () => {
    expect(corePages.filter((page) => redirectSources.has(page))).toEqual([]);
  });

  it('precaches only paths that resolve to a real page', () => {
    const missing = corePages.filter((page) => {
      if (page === '/') return !existsSync('src/app/page.tsx');
      return !existsSync(`src/app${page}/page.tsx`) && !existsSync(`src/app${page}/route.ts`);
    });
    expect(missing, 'cache.addAll rejects the whole batch on one bad entry').toEqual([]);
  });
});

describe('cron wiring', () => {
  it('parses a dispatcher table and a trigger list, so a format change fails here', () => {
    // Both halves silently becoming empty would make every assertion below
    // vacuous — the same failure mode `audit:routes` guards against.
    expect(jobs.length).toBeGreaterThan(20);
    expect(armed.length).toBeGreaterThan(10);
  });

  it('arms every schedule the dispatcher dispatches on', () => {
    const unarmed = [...new Set(jobs.filter((j) => !armed.includes(j.schedule)).map((j) => `${j.path} @ ${j.schedule}`))];
    expect(unarmed, 'these jobs can never fire — add the expression to wrangler.cron.toml').toEqual([]);
  });

  it('dispatches something on every schedule it arms', () => {
    // The reverse leak: an armed expression nothing matches wakes the Worker
    // to log "No job matched schedule" and do nothing.
    const used = new Set(jobs.map((j) => j.schedule));
    expect(armed.filter((a) => !used.has(a))).toEqual([]);
  });

  it('points every job at a route that exists', () => {
    const missing: string[] = [];
    for (const { path } of jobs) {
      const [pathname, query] = path.split('?');
      if (query) {
        // The multiplexed route branches on the job name.
        const name = query.replace('job=', '');
        if (!cronRoute.includes(`'${name}'`)) missing.push(`${path} — /api/cron has no branch for '${name}'`);
      } else if (!existsSync(`src/app${pathname}/route.ts`)) {
        missing.push(`${path} — no route file`);
      }
    }
    expect(missing).toEqual([]);
  });
});

/* ── The two copies of the show page must agree about selling ──────────────
   A show renders twice: `/shows/[slug]` (public, the URL people share) and
   `/app/shows/[slug]` (the same show in the signed-in shell). `show-detail.ts`
   exists because they had drifted before; this is the half a shared module
   cannot cover, because the gate reads runtime env and that module is pure.

   The drift found on 2026-09-03: the public copy checked
   `isPaymentProcessingConfigured()` and rendered an honest "Paid tickets ·
   Coming soon" notice, while the shell copy rendered the whole purchase form
   unconditionally. `POST /api/shows/[showId]/tickets` refuses that state with
   503 TICKET_PAYMENTS_DISABLED, so a member picked a quantity, pressed Buy and
   got an error — on the SIGNED-IN surface, which is the one real members use,
   while only logged-out visitors saw the honest half. */
describe('the show page sells the same way on both copies', () => {
  const pages = [
    'src/app/shows/[slug]/page.tsx',
    'src/app/app/shows/[slug]/page.tsx',
  ];

  it('derives the money from one place in both copies', () => {
    /* The public copy painted its 70/20/10 bar with `price * (pct/100)` and
       `toFixed(2)` — three independent roundings of a float, disagreeing with
       the integer-cent helper (and so with the payout entries) by a cent at
       ordinary prices. Both copies read `splitFaceValueCents` now. */
    const handRolled = pages.filter((f) => !/\bsplitFaceValueCents\b/.test(code(f)));
    expect(
      handRolled,
      'this copy computes the split itself — use splitFaceValueCents, which the payout entries follow',
    ).toEqual([]);
  });

  it('gates the sale on payment readiness in both copies', () => {
    const ungated = pages.filter((f) => !/\bisPaymentProcessingConfigured\b/.test(code(f)));
    expect(
      ungated,
      'this copy offers a purchase form the ticket route answers 503 to — see the public copy for the notice to render instead',
    ).toEqual([]);
  });
});

/* ── One release rule, not fourteen ────────────────────────────────────────
   Whether a track may be shown publicly is `releasedMediaWhere()`: published
   AND its publish moment unset or past. A listing that writes its own version
   serves the states the release pipeline exists to hide — a HELD upload the
   copyright scan flagged, or an unannounced release.

   The free-use crate had `{ isPublished: true }` inline, dropping the
   `publishAt` half, and was the only public listing of the fourteen not
   reading the helper.

   WHAT THIS CHECKS, AND WHAT IT DOES NOT. It pins an explicit list: each of
   these surfaces must read the helper. Two heuristic versions came first and
   both were wrong in ways worth recording — one flagged `data:` writes and
   `select:` projections that merely share the syntax (a guard that cries wolf
   is a guard someone switches off), and the next could not see through the
   real bug's own shape, a filter assigned to a variable and spread into
   `where`, so it passed while the defect was reinstated. A list cannot be
   fooled by either. Its cost is that a NEW public listing is not covered until
   it is added here, which is the honest trade. */
describe('public media listings share one release rule', () => {
  const publicListings = [
    'src/app/api/artist-media/free-use/route.ts',
    'src/app/api/charts/route.ts',
    'src/app/api/discover/seeds/route.ts',
    'src/app/api/media-listens/route.ts',
    'src/app/api/profile/[slug]/route.ts',
    'src/app/api/public-media/[hexId]/route.ts',
    'src/app/api/radio/route.ts',
    'src/app/api/recommend/route.ts',
    'src/app/api/search/route.ts',
    'src/app/api/shows/[showId]/media/[hexId]/route.ts',
    'src/lib/radioStation.ts',
    /* Delegates: its where-clause is `stationWhere()`, which composes
       `releasedMediaWhere` in src/lib/stations.ts. Listing the route rather
       than the builder keeps this list to surfaces that actually serve rows. */
    'src/app/api/stations/[slug]/tracks/route.ts',
  ];

  const readsTheRule = (f: string) => /\b(releasedMediaWhere|stationWhere)\b/.test(code(f));

  it('reads releasedMediaWhere on every public listing', () => {
    const handRolled = publicListings.filter((f) => !readsTheRule(f));
    expect(
      handRolled,
      'use releasedMediaWhere() — an inline isPublished check omits the publishAt half',
    ).toEqual([]);
  });

  it('names only files that really list media', () => {
    // A stale entry would pass forever while guarding nothing.
    const notListings = publicListings.filter((f) => !/artistMediaAsset\.(findMany|findFirst)/.test(code(f)));
    expect(notListings).toEqual([]);
  });
});

/* ── The basemap must be keyed, and nothing will tell you if it is not ─────
   CARTO requires a key, and on RASTER an unkeyed request does not fail: it
   answers 200 with a valid PNG carrying an "API KEY REQUIRED" watermark — no
   error, no 4xx, no log line, the map just looks slightly wrong. Measured
   2026-09-03: 33,863 bytes unkeyed against 35,505 keyed for the same tile.

   The map is VECTOR now, where the key is not yet enforced — style and tiles
   measured byte-identical either way — so this guard is about attribution
   rather than a broken map today: CARTO counts the free tier per key. It stays
   because enforcement clearly arrives, and because the failure it guards
   against is one nothing else would report. The parameter is `key`; `api_key`
   is accepted and ignored, which fails the same silent way. */
describe('the basemap is keyed', () => {
  const mapFile = 'src/components/mmm/MmmMap.tsx';

  it('never builds a cartocdn URL without a key', () => {
    const src = code(mapFile);
    const urls = [...src.matchAll(/https:\/\/[^'"`\s]*basemaps\.cartocdn\.com[^'"`\s]*/g)].map((m) => m[0]);
    expect(urls.length, 'no CARTO URL found — has the basemap moved?').toBeGreaterThan(0);
    const unkeyed = urls.filter((u) => !/[?&]key=/.test(u));
    expect(unkeyed, 'CARTO counts the free tier per key; an unkeyed raster tile is also served watermarked').toEqual([]);
  });

  it('uses `key`, not the `api_key` CARTO silently ignores', () => {
    expect(code(mapFile)).not.toMatch(/basemaps\.cartocdn\.com[^'"`\s]*[?&]api_key=/);
  });
});
