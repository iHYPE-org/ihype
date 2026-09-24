/**
 * The service worker never answers a media request, and a cache write that
 * fails never replaces the network's answer (2026-09-24, DESIGN_SYNC row 513).
 *
 * A media element asks for audio with `Range: bytes=0-`, `/cdn` answers a range
 * with a 206, and the Cache API rejects a 206 by specification. The worker used
 * to await that rejected `cache.put`, fall into its catch and hand the audio
 * element the offline HTML page, so every uploaded track failed to decode in
 * Chromium on every visit after the first. The e2e station plays a static
 * sample that answers 200 even to a range request, so no browser test could
 * see it. This test runs the real `public/sw.js` in a sandbox whose Cache
 * refuses a 206 exactly as the specification says.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const ORIGIN = 'https://ihype.org';

type Listener = (event: unknown) => void;

function loadWorker(network: (request: Request) => Response | Promise<Response>, opts: { putRejects?: boolean } = {}) {
  const listeners: Record<string, Listener> = {};
  const puts: string[] = [];
  const stores = new Map<string, Map<string, Response>>();
  const cacheFor = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      async match(req: Request | string) {
        const key = typeof req === 'string' ? new URL(req, ORIGIN).href : req.url;
        return store.get(key)?.clone();
      },
      async put(req: Request | string, response: Response) {
        const key = typeof req === 'string' ? new URL(req, ORIGIN).href : req.url;
        // The specification: "If response's status is 206, throw a TypeError."
        if (response.status === 206) throw new TypeError('Partial response (status code 206) is unsupported');
        if (opts.putRejects) throw new DOMException('Quota exceeded', 'QuotaExceededError');
        puts.push(key);
        store.set(key, response);
      },
      async addAll() { /* install is not exercised here */ },
    };
  };
  const caches = {
    async open(name: string) { return cacheFor(name); },
    async match(req: Request | string) {
      for (const name of stores.keys()) {
        const hit = await cacheFor(name).match(req);
        if (hit) return hit;
      }
      return undefined;
    },
    async keys() { return [...stores.keys()]; },
    async delete(name: string) { return stores.delete(name); },
  };
  const self = {
    addEventListener(type: string, fn: Listener) { listeners[type] = fn; },
    registration: { active: null },
    clients: { claim: async () => undefined, matchAll: async () => [] },
    location: { origin: ORIGIN },
    skipWaiting: async () => undefined,
  };
  const sandbox = {
    self, caches, location: { origin: ORIGIN },
    fetch: async (req: Request | string) => network(typeof req === 'string' ? new Request(new URL(req, ORIGIN)) : req),
    Response, Request, Headers, URL, DOMException, console,
  };
  vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), sandbox);

  async function dispatch(request: Request): Promise<Response | 'not-intercepted'> {
    let answered: Promise<Response> | undefined;
    listeners.fetch!({ request, respondWith(p: Promise<Response>) { answered = p; }, waitUntil() {} });
    return answered ? await answered : 'not-intercepted';
  }
  return { dispatch, puts };
}

const audioBody = () => new Uint8Array([0xff, 0xfb, 0x90, 0x00]);

describe('public/sw.js and media', () => {
  it('leaves a ranged audio request to the network, never answering it with the offline page', async () => {
    const { dispatch, puts } = loadWorker(() => new Response(audioBody(), {
      status: 206,
      headers: { 'Content-Type': 'audio/mpeg', 'Content-Range': 'bytes 0-3/4', 'Cache-Control': 'public, max-age=31536000, immutable' },
    }));
    const result = await dispatch(new Request(`${ORIGIN}/cdn/artist-media/p/track.mp3`, { headers: { Range: 'bytes=0-' } }));
    expect(result).toBe('not-intercepted');
    expect(puts).toEqual([]);
  });

  it('never stores a 206 even when no Range header arrived, and still returns it', async () => {
    const { dispatch, puts } = loadWorker(() => new Response(audioBody(), {
      status: 206,
      headers: { 'Content-Type': 'audio/mpeg', 'Content-Range': 'bytes 0-3/4', 'Cache-Control': 'public, max-age=31536000, immutable' },
    }));
    const result = await dispatch(new Request(`${ORIGIN}/cdn/artist-media/p/track.mp3`));
    expect(result).not.toBe('not-intercepted');
    const response = result as Response;
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(puts).toEqual([]);
  });

  it('returns the network response when the cache write is refused, instead of the offline page', async () => {
    const { dispatch } = loadWorker(() => new Response('{"ok":true}', {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
    }), { putRejects: true });
    const result = await dispatch(new Request(`${ORIGIN}/data/feed.json`));
    const response = result as Response;
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(await response.text()).toBe('{"ok":true}');
  });
});
