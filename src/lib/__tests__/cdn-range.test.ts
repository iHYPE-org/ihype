import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The /cdn route's own behaviour, against a fake R2 bucket.
 *
 * `http-range.test.ts` covers the parser; this covers what the ROUTE does
 * with it — which status it answers, which headers it sets, and how many
 * times it reads the bucket. That gap is not theoretical: walk item 42's
 * first run failed on a header this layer never controlled, and a unit test
 * at this level is where that belongs, because it costs a second rather than
 * a seven-minute CI round trip.
 */

const bindings: Record<string, unknown> = {};
vi.mock('@/lib/runtime-env', () => ({
  readRuntimeBinding: (name: string) => bindings[name],
}));

const BYTES = new Uint8Array(Array.from({ length: 1000 }, (_, i) => i % 251));

function fakeBucket() {
  const calls: string[] = [];
  return {
    calls,
    async head(key: string) {
      calls.push(`head:${key}`);
      return { size: BYTES.length, httpMetadata: { contentType: 'audio/mpeg' }, httpEtag: '"abc"' };
    },
    async get(key: string, options?: { range?: { offset: number; length: number } }) {
      calls.push(options?.range ? `get:${options.range.offset}+${options.range.length}` : `get:${key}`);
      const slice = options?.range
        ? BYTES.slice(options.range.offset, options.range.offset + options.range.length)
        : BYTES;
      return {
        body: new Blob([slice]).stream(),
        size: BYTES.length,
        httpMetadata: { contentType: 'audio/mpeg' },
        httpEtag: '"abc"',
      };
    },
  };
}

const KEY = 'artist-media/abc/track.mp3';

async function call(range?: string) {
  const { GET } = await import('@/app/cdn/[...key]/route');
  return GET(
    new Request(`https://ihype.org/cdn/${KEY}`, range ? { headers: { range } } : undefined),
    { params: Promise.resolve({ key: KEY.split('/') }) },
  );
}

describe('/cdn byte ranges', () => {
  let bucket: ReturnType<typeof fakeBucket>;
  beforeEach(() => {
    bucket = fakeBucket();
    bindings.R2 = bucket;
  });

  it('advertises Accept-Ranges on the whole object, or no player will ever ask', async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(bucket.calls).toEqual([`get:${KEY}`]);
  });

  it('answers an opening probe with 206 and the total in Content-Range', async () => {
    const response = await call('bytes=0-3');
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 0-3/1000');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES.slice(0, 4));
  });

  it('reads a suffix range from the END', async () => {
    const response = await call('bytes=-4');
    expect(response.headers.get('content-range')).toBe('bytes 996-999/1000');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES.slice(996));
  });

  it('answers 416 past the end, naming the size', async () => {
    const response = await call('bytes=5000-6000');
    expect(response.status).toBe(416);
    expect(response.headers.get('content-range')).toBe('bytes */1000');
  });

  it('takes the size from head(), never by fetching a body to throw away', async () => {
    await call('bytes=0-3');
    expect(bucket.calls).toEqual(['head:' + KEY, 'get:0+4']);
  });

  it('serves the whole object for a header it cannot parse', async () => {
    const response = await call('bytes=abc-def');
    expect(response.status).toBe(200);
  });

  it('still serves the object when the binding has no head()', async () => {
    // A degraded binding must cost the seek, never the audio.
    bindings.R2 = { get: bucket.get };
    const response = await call('bytes=0-3');
    expect(response.status).toBe(200);
  });

  it('404s a key outside the public prefixes', async () => {
    const { GET } = await import('@/app/cdn/[...key]/route');
    const response = await GET(
      new Request('https://ihype.org/cdn/verification/secret.pdf'),
      { params: Promise.resolve({ key: ['verification', 'secret.pdf'] }) },
    );
    expect(response.status).toBe(404);
  });
});
