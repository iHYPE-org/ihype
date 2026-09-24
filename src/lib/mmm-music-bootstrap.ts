/**
 * The Listen tabs' first rows, read ON THE SERVER during the page render, so
 * a tab's HTML carries them and hydration finds them waiting.
 *
 * WHY (2026-09-24, DESIGN_SYNC row 512). Row 511 preloaded each tab's first
 * reads from the document head, which moved the request forward — but the
 * ROWS still arrived only once the client had hydrated and `useJson`'s
 * effect had run, so a cold load drew the loading plate, then the rows. The
 * same route handlers that answer `/api/stations`, `/api/charts` and the rest
 * are plain async functions; this module calls them here, in the render,
 * with a request built from the incoming headers, and the page hands each
 * `ok` body to `MmmMusic` as `initialPayloads`. `useJson` renders those in
 * its FIRST render (server and client alike, so the hydration matches) and
 * never fetches a URL it was handed.
 *
 * THREE RULES, each of which the tests hold — and one that was tried and is
 * NOT here. It runs on every render of the page, client-side navigations
 * included: a first draft read rows on document loads only, so a tab hop kept
 * row 509's shape (a fast RSC payload, rows from the module cache), and it
 * could not be built — Next hides the `rsc` header from `headers()` in the
 * render (`HIDDEN_REQUEST_HEADERS`), strips it AND the `_rsc` query before the
 * middleware runs (`stripInternalSearchParams` in its adapter), and does so on
 * purpose, so that a route's payload cannot differ between a navigation and a
 * document. Measured on the built worker: a navigation's flight body carried
 * `"/api/stations"` under both attempts. So the RSC payload for a Listen tab
 * now carries the tab's rows too; what it costs is the handlers' database
 * time inside the navigation (in parallel, and a hop back inside
 * `staleTimes.dynamic` is served from the router cache and pays nothing), and
 * what it buys is that no tab ever draws the loading plate over rows the
 * server already had. Row 509's sibling warmer is deleted with it: a warmed
 * payload would never be read, because the server's answer wins.
 *
 * (1) ONLY AN `ok` BODY IS HANDED OVER. A 401, a 503 `READ_UNAVAILABLE` or a
 *     thrown handler yields no entry, and the client then fetches the URL
 *     exactly as before and shows its own error state. A failed read is never
 *     turned into an empty claim here (row 408), and never into a cached one.
 * (2) A DEADLINE, NOT A WAIT. Every handler races `BOOTSTRAP_DEADLINE_MS`;
 *     one slow read costs the page that long and no more, and the URLs that
 *     did not make it fall back to (2). The handlers keep running past the
 *     deadline — the query is spent either way — but the page does not wait.
 * (3) NOTHING HERE WRITES THE CLIENT'S MODULE CACHE. `MmmMusic`'s
 *     `tabPayloadCache` is module-level; on the server that module is shared
 *     by every request the isolate serves, so a server-side write would hand
 *     one member's stations to the next. The payloads travel as PROPS, and the
 *     client seeds its own cache from them after hydration.
 *
 * The handlers are imported by module, not fetched over HTTP: a Worker
 * fetching its own origin is a second request through Cloudflare for an
 * answer this isolate can compute, and it would need the cookie forwarded by
 * hand. The request the handlers see carries the incoming headers, so
 * `auth()`, `detectRequestLocation()` and every `x-forwarded-*` read behave
 * as they do on a direct call. None of the GET handlers here consumes a rate
 * limit (asserted by the wiring test — a limited read called twice per page
 * would spend the member's budget on the server's behalf).
 */
import { headers } from 'next/headers';
import { NextRequest } from 'next/server';
import { GET as getCharts } from '@/app/api/charts/route';
import { GET as getDiscoverSeeds } from '@/app/api/discover/seeds/route';
import { GET as getFanFavorites } from '@/app/api/fan-favorites/route';
import { GET as getFanPlaylists } from '@/app/api/fan-playlists/route';
import { GET as getLikes } from '@/app/api/likes/route';
import { GET as getMediaListens } from '@/app/api/media-listens/route';
import { GET as getRecommend } from '@/app/api/recommend/route';
import { GET as getStations } from '@/app/api/stations/route';
import { log } from '@/lib/logger';

export const BOOTSTRAP_DEADLINE_MS = 1500;

type Handler = (request: NextRequest) => Promise<Response>;

/** Pathname → the route module's GET. Query strings ride on the request URL. */
const HANDLERS: Record<string, Handler> = {
  '/api/charts': (request) => getCharts(request),
  '/api/discover/seeds': (request) => getDiscoverSeeds(request),
  '/api/fan-favorites': (request) => getFanFavorites(request),
  '/api/fan-playlists': () => getFanPlaylists(),
  '/api/likes': (request) => getLikes(request),
  '/api/media-listens': () => getMediaListens(),
  '/api/recommend': () => getRecommend(),
  '/api/stations': () => getStations(),
};

/**
 * The bodies that came back `ok` in time, keyed by the URL the client would
 * ask for, plus WHEN they were read — the client seeds its cache at that
 * instant, so a payload the router cache replays 30 s later is revalidated
 * on the same stale-while-revalidate rule as any other cached read.
 */
export type InitialPayloads = { at: number; payloads: Record<string, unknown> };

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    work.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(null); },
    );
  });
}

async function readOne(url: string, requestHeaders: Headers, origin: string): Promise<unknown> {
  const pathname = new URL(url, origin).pathname;
  const handler = HANDLERS[pathname];
  if (!handler) return undefined;
  const request = new NextRequest(new URL(url, origin), { headers: requestHeaders, method: 'GET' });
  const response = await withDeadline(handler(request), BOOTSTRAP_DEADLINE_MS);
  if (!response?.ok) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * Read `urls` through their handlers and return the bodies that came back
 * `ok` in time, keyed by the URL the client will ask for. Absent keys mean
 * "fetch it yourself"; nothing here is ever an empty list standing in for a
 * failed read.
 */
export async function bootstrapMusicPayloads(urls: readonly string[]): Promise<InitialPayloads> {
  const requestHeaders = new Headers(await headers());
  const at = Date.now();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? 'ihype.org';
  const proto = requestHeaders.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host}`;
  const entries = await Promise.all(
    urls.map(async (url) => {
      try {
        return [url, await readOne(url, requestHeaders, origin)] as const;
      } catch (error) {
        // A handler that throws is a client-side fetch, not a page failure.
        log.warn('[music-bootstrap] read failed', { url, error: error instanceof Error ? error.message : String(error) });
        return [url, undefined] as const;
      }
    }),
  );
  const payloads: Record<string, unknown> = {};
  for (const [url, payload] of entries) {
    if (payload !== undefined) payloads[url] = payload;
  }
  return { at, payloads };
}
