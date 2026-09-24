/**
 * The Listen tabs' server bootstrap (DESIGN_SYNC row 512) — the three rules
 * its header states, each driven rather than read:
 *
 *  1. only an `ok` body is handed over — a 503, a 401 and a thrown handler
 *     each leave their URL absent, never an empty list;
 *  2. a handler past the deadline leaves its URL absent and does not hold the
 *     page;
 *  3. the module never touches the client's payload cache, and no GET it
 *     calls consumes a rate limit;
 *  4. a request carrying `READ_IN_BROWSER_HEADER` is handed nothing and calls
 *     no handler — and the browser spec that faults these endpoints sends it,
 *     because a read answered on the server never crosses the network it
 *     faults.
 *
 * There is deliberately no "navigation reads nothing" rule: Next hides every
 * mark of a client-side navigation from the render and the middleware alike,
 * and a test here pins the two places in the installed Next that do so, so a
 * later attempt finds the reason before it finds the bug.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

const requestHeaders = new Map<string, string>();
vi.mock('next/headers', () => ({
  headers: async () => new Headers(Object.fromEntries(requestHeaders)),
}));

const handlers = {
  stations: vi.fn(),
  charts: vi.fn(),
  recommend: vi.fn(),
  mediaListens: vi.fn(),
  favorites: vi.fn(),
  likes: vi.fn(),
  playlists: vi.fn(),
  seeds: vi.fn(),
};
vi.mock('@/app/api/stations/route', () => ({ GET: (...args: unknown[]) => handlers.stations(...args) }));
vi.mock('@/app/api/charts/route', () => ({ GET: (...args: unknown[]) => handlers.charts(...args) }));
vi.mock('@/app/api/recommend/route', () => ({ GET: (...args: unknown[]) => handlers.recommend(...args) }));
vi.mock('@/app/api/media-listens/route', () => ({ GET: (...args: unknown[]) => handlers.mediaListens(...args) }));
vi.mock('@/app/api/fan-favorites/route', () => ({ GET: (...args: unknown[]) => handlers.favorites(...args) }));
vi.mock('@/app/api/likes/route', () => ({ GET: (...args: unknown[]) => handlers.likes(...args) }));
vi.mock('@/app/api/fan-playlists/route', () => ({ GET: (...args: unknown[]) => handlers.playlists(...args) }));
vi.mock('@/app/api/discover/seeds/route', () => ({ GET: (...args: unknown[]) => handlers.seeds(...args) }));
vi.mock('@/lib/logger', () => ({ log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('bootstrapMusicPayloads', () => {
  beforeEach(() => {
    requestHeaders.clear();
    requestHeaders.set('host', 'ihype.org');
    requestHeaders.set('cookie', 'session=abc');
    for (const fn of Object.values(handlers)) fn.mockReset();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('hands over only the bodies that came back ok, keyed by the URL the client asks for', async () => {
    const { bootstrapMusicPayloads } = await import('@/lib/mmm-music-bootstrap');
    handlers.stations.mockResolvedValue(json({ stations: [{ slug: 'a' }] }));
    handlers.charts.mockResolvedValue(json({ error: 'READ_UNAVAILABLE' }, 503));
    handlers.recommend.mockResolvedValue(json({ error: 'unauthenticated' }, 401));
    handlers.mediaListens.mockRejectedValue(new Error('db down'));
    const out = await bootstrapMusicPayloads([
      '/api/stations',
      '/api/charts?dataset=area&scope=local',
      '/api/recommend',
      '/api/media-listens',
      '/api/not-a-listen-read',
    ]);
    expect(out.payloads).toEqual({ '/api/stations': { stations: [{ slug: 'a' }] } });
    expect(typeof out.at).toBe('number');
    // The failed reads are ABSENT — not `[]`, not `null` (row 408).
    expect('/api/charts?dataset=area&scope=local' in out.payloads).toBe(false);
    expect('/api/recommend' in out.payloads).toBe(false);
    expect('/api/media-listens' in out.payloads).toBe(false);
  });

  it('builds the handler\'s request from the incoming headers and the full URL, query included', async () => {
    const { bootstrapMusicPayloads } = await import('@/lib/mmm-music-bootstrap');
    requestHeaders.set('x-forwarded-host', 'ihype.org');
    requestHeaders.set('x-forwarded-proto', 'https');
    handlers.charts.mockResolvedValue(json({ rows: [] }));
    await bootstrapMusicPayloads(['/api/charts?dataset=genre&genre=jazz']);
    const request = handlers.charts.mock.calls[0]![0] as Request;
    expect(new URL(request.url).searchParams.get('genre')).toBe('jazz');
    expect(new URL(request.url).origin).toBe('https://ihype.org');
    expect(request.headers.get('cookie')).toBe('session=abc');
    expect(request.method).toBe('GET');
  });

  it('has no navigation rule, because the installed Next hides every mark of one from the render and the middleware', async () => {
    const root = process.cwd();
    const source = maskComments(readFileSync(join(root, 'src/lib/mmm-music-bootstrap.ts'), 'utf8'));
    expect(source).not.toMatch(/get\('rsc'\)|next-router-prefetch|_rsc/);
    // The flight headers are hidden from headers() in the request store…
    const flight = readFileSync(join(root, 'node_modules/next/dist/client/components/app-router-headers.js'), 'utf8');
    expect(flight).toMatch(/const FLIGHT_HEADERS = \[\s*RSC_HEADER,/);
    const store = readFileSync(join(root, 'node_modules/next/dist/server/async-storage/request-store.js'), 'utf8');
    expect(store).toMatch(/\.\.\._approuterheaders\.FLIGHT_HEADERS,/);
    expect(store).toMatch(/HIDDEN_REQUEST_HEADERS/);
    // …and stripped, with the `_rsc` query, before the middleware runs.
    const adapter = readFileSync(join(root, 'node_modules/next/dist/server/web/adapter.js'), 'utf8');
    expect(adapter).toMatch(/for \(const header of _approuterheaders\.FLIGHT_HEADERS\)\{[\s\S]{0,200}requestHeaders\.delete\(header\)/);
    expect(adapter).toMatch(/stripInternalSearchParams\)\(normalizeURL\)/);
    // So the middleware forwards no such flag either.
    expect(maskComments(readFileSync(join(root, 'src/middleware.ts'), 'utf8'))).not.toMatch(/x-ihype-navigation|_rsc/);
  });

  it('a handler past the deadline leaves its URL absent and does not hold the page', async () => {
    vi.useFakeTimers();
    const { bootstrapMusicPayloads, BOOTSTRAP_DEADLINE_MS } = await import('@/lib/mmm-music-bootstrap');
    handlers.stations.mockResolvedValue(json({ stations: [] }));
    handlers.recommend.mockReturnValue(new Promise(() => { /* never */ }));
    const pending = bootstrapMusicPayloads(['/api/stations', '/api/recommend']);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEADLINE_MS + 1);
    const out = await pending;
    expect(out.payloads).toEqual({ '/api/stations': { stations: [] } });
    expect('/api/recommend' in out.payloads).toBe(false);
  });

  it('a request that asks to read in the browser is handed nothing and calls no handler', async () => {
    const { bootstrapMusicPayloads, READ_IN_BROWSER_HEADER } = await import('@/lib/mmm-music-bootstrap');
    handlers.stations.mockResolvedValue(json({ stations: [{ slug: 'a' }] }));
    requestHeaders.set(READ_IN_BROWSER_HEADER, '1');
    const out = await bootstrapMusicPayloads(['/api/stations']);
    expect(out.payloads).toEqual({});
    expect(typeof out.at).toBe('number');
    expect(handlers.stations).not.toHaveBeenCalled();
  });

  it('the browser spec that faults a Listen endpoint sends that header before it navigates', () => {
    const root = process.cwd();
    const spec = maskComments(readFileSync(join(root, 'e2e/engagement-flows.spec.ts'), 'utf8'));
    const lib = maskComments(readFileSync(join(root, 'src/lib/mmm-music-bootstrap.ts'), 'utf8'));
    const name = lib.match(/READ_IN_BROWSER_HEADER = '([^']+)'/)?.[1];
    expect(name).toBeTruthy();
    expect(spec).toContain(`'${name}': '1'`);
    // Every page.route fault on a Listen read is preceded by the header on the same page.
    const faults = [...spec.matchAll(/page\.route\('\*\*\/api\/(fan-favorites|stations)'/g)];
    expect(faults.length).toBe(2);
    for (const fault of faults) {
      const before = spec.slice(Math.max(0, fault.index! - 400), fault.index);
      expect(before, `the fault on ${fault[1]} needs setExtraHTTPHeaders(READ_IN_BROWSER) before it`).toMatch(/setExtraHTTPHeaders\(READ_IN_BROWSER\)/);
    }
  });

  it('never imports the client component or names its cache, and calls no GET that consumes a rate limit', () => {
    const root = process.cwd();
    // Masked first: the module's own header NAMES the cache it must not touch,
    // and a scanner that reads its own prose fails on it (the mask-comments rule).
    const source = maskComments(readFileSync(join(root, 'src/lib/mmm-music-bootstrap.ts'), 'utf8'));
    expect(source).not.toMatch(/components\/mmm\/MmmMusic/);
    expect(source).not.toMatch(/tabPayloadCache/);
    // Every handler the table names: its GET must not spend the member's budget.
    const routes = [...source.matchAll(/from '@\/app\/api\/([^']+)\/route'/g)].map((m) => m[1]!);
    expect(routes.length).toBeGreaterThanOrEqual(8);
    for (const route of routes) {
      const file = readFileSync(join(root, 'src/app/api', route, 'route.ts'), 'utf8');
      const getAt = file.indexOf('export async function GET');
      expect(getAt, `${route} must export GET`).toBeGreaterThan(-1);
      const nextExport = file.indexOf('\nexport ', getAt + 1);
      const getBody = file.slice(getAt, nextExport === -1 ? undefined : nextExport);
      expect(getBody, `${route}'s GET consumes a rate limit; the bootstrap would spend it on the server's behalf`).not.toMatch(/consumeRateLimit\(/);
    }
  });
});
