/**
 * The media proxy reads its own `/cdn` objects from the bucket (2026-09-24,
 * DESIGN_SYNC row 513) instead of fetching its own public URL, which cost a
 * second Worker invocation and a public round trip on every play and seek.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const bindings: Record<string, unknown> = {};
vi.mock('@/lib/runtime-env', () => ({ readRuntimeBinding: (name: string) => bindings[name] }));
const logError = vi.fn();
vi.mock('@/lib/logger', () => ({ log: { error: (...a: unknown[]) => logError(...a), warn: vi.fn(), info: vi.fn() } }));

const BYTES = new Uint8Array(Array.from({ length: 400 }, (_, i) => i % 200));
const KEY = 'artist-media/p1/track.mp3';

function bucket(present = true) {
  return {
    async head() { return present ? { size: BYTES.length, httpMetadata: { contentType: 'audio/mpeg' } } : null; },
    async get(_key: string, options?: { range?: { offset: number; length: number } }) {
      if (!present) return null;
      const slice = options?.range ? BYTES.slice(options.range.offset, options.range.offset + options.range.length) : BYTES;
      return { body: new Blob([slice]).stream(), size: BYTES.length, httpMetadata: { contentType: 'audio/mpeg' } };
    },
  };
}

const asset = (storageUrl: string) => ({ originalFileName: 'track.mp3', mimeType: 'audio/mpeg', fileDataBase64: null, storageUrl });

describe('serveMediaAsset', () => {
  const fetchSpy = vi.fn();
  beforeEach(() => {
    process.env.R2_PUBLIC_BASE_URL = 'https://ihype.org';
    fetchSpy.mockReset().mockResolvedValue(new Response(BYTES, { status: 200, headers: { 'content-type': 'audio/mpeg' } }));
    vi.stubGlobal('fetch', fetchSpy);
    logError.mockReset();
    bindings.R2 = bucket();
  });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.R2_PUBLIC_BASE_URL; });

  it('serves its own /cdn object straight from the bucket, ranged, under the caller\'s cache policy', async () => {
    const { serveMediaAsset } = await import('@/lib/media-response');
    const res = await serveMediaAsset(
      new Request('https://ihype.org/api/media/0xabc', { headers: { range: 'bytes=0-99' } }),
      asset(`https://ihype.org/cdn/${KEY}`),
      { cacheControl: 'private, no-store' },
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 0-99/400');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect((await res.arrayBuffer()).byteLength).toBe(100);
  });

  it('still fetches a legacy r2.dev URL', async () => {
    const { serveMediaAsset } = await import('@/lib/media-response');
    const res = await serveMediaAsset(
      new Request('https://ihype.org/api/media/0xabc'),
      asset('https://pub-123.r2.dev/artist-media/p1/track.mp3'),
      { cacheControl: 'private, no-store' },
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });

  it('answers 502 and reports to Sentry when its own object is missing', async () => {
    bindings.R2 = bucket(false);
    const { serveMediaAsset } = await import('@/lib/media-response');
    const res = await serveMediaAsset(
      new Request('https://ihype.org/api/media/0xabc'),
      asset(`https://ihype.org/cdn/${KEY}`),
      { cacheControl: 'private, no-store' },
    );
    expect(res.status).toBe(502);
    expect(logError).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never reads a key outside the public prefixes from the bucket', async () => {
    const { serveMediaAsset } = await import('@/lib/media-response');
    await serveMediaAsset(
      new Request('https://ihype.org/api/media/0xabc'),
      asset('https://ihype.org/cdn/verification/doc.pdf'),
      { cacheControl: 'private, no-store' },
    );
    // Not an own-bucket key, so it goes the old way (and /cdn refuses it there).
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
