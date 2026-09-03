import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
