import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  isObjectStorageConfigured,
  isTrustedStorageUrl,
  objectPublicUrl,
  storeMediaFile,
  deleteMediaFile,
} from '@/lib/object-storage';
import { setContextReaderForTests } from '@/lib/runtime-env';

/** A stand-in for the Worker's R2 binding. */
function fakeBucket() {
  return {
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    puts: [] as string[],
  };
}

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.R2_PUBLIC_BASE_URL = 'https://ihype.org';
});

afterEach(() => {
  setContextReaderForTests(null);
  process.env = { ...originalEnv };
});

/**
 * Storage runs on the Worker's R2 BINDING, not on S3 credentials. The old
 * credential path was dead in production for its whole life — the live Worker
 * carries no R2_* secret and never did — so these pin the property that
 * actually matters: a bucket on the binding means storage is on, and no bucket
 * means the inline fallback, never a crash.
 */
describe('isObjectStorageConfigured', () => {
  it('is true when the Worker env carries an R2 bucket', () => {
    setContextReaderForTests(() => ({ R2: fakeBucket() }));
    expect(isObjectStorageConfigured()).toBe(true);
  });

  it('is false with no Cloudflare context at all (local node, build, tests)', () => {
    setContextReaderForTests(() => null);
    expect(isObjectStorageConfigured()).toBe(false);
  });

  it('is false when the env exists but carries no R2 binding', () => {
    setContextReaderForTests(() => ({ KV: {} }));
    expect(isObjectStorageConfigured()).toBe(false);
  });

  it('does not mistake some other value named R2 for a bucket', () => {
    // A string or a stub without put/delete must not be treated as storage,
    // or storeMediaFile throws instead of falling back.
    setContextReaderForTests(() => ({ R2: 'not-a-bucket' }));
    expect(isObjectStorageConfigured()).toBe(false);
    setContextReaderForTests(() => ({ R2: { put: () => {} } }));
    expect(isObjectStorageConfigured()).toBe(false);
  });
});

describe('storeMediaFile', () => {
  const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';

  it('puts the object on the bucket and returns its /cdn/ URL', async () => {
    const bucket = fakeBucket();
    setContextReaderForTests(() => ({ R2: bucket }));

    const stored = await storeMediaFile('profile/p1/graphics/a.png', dataUrl, 'image/png');

    expect(bucket.put).toHaveBeenCalledTimes(1);
    expect(bucket.put.mock.calls[0][0]).toBe('profile/p1/graphics/a.png');
    expect(bucket.put.mock.calls[0][2]).toEqual({ httpMetadata: { contentType: 'image/png' } });
    expect(stored).toEqual({
      key: 'profile/p1/graphics/a.png',
      url: 'https://ihype.org/cdn/profile/p1/graphics/a.png',
      storageType: 'r2',
    });
  });

  it('falls back to the inline data URL when no bucket is bound', async () => {
    setContextReaderForTests(() => null);
    const stored = await storeMediaFile('profile/p1/graphics/a.png', dataUrl, 'image/png');
    expect(stored).toEqual({ key: 'profile/p1/graphics/a.png', url: dataUrl, storageType: 'inline' });
  });

  it('writes the decoded bytes, not the base64 text', async () => {
    const bucket = fakeBucket();
    setContextReaderForTests(() => ({ R2: bucket }));
    // "hi" base64-encoded.
    await storeMediaFile('ads/audio/x.bin', 'data:application/octet-stream;base64,aGk=', 'application/octet-stream');
    const written = Buffer.from(bucket.put.mock.calls[0][1] as ArrayBuffer);
    expect(written.toString('utf8')).toBe('hi');
  });
});

describe('deleteMediaFile', () => {
  it('deletes through the binding', async () => {
    const bucket = fakeBucket();
    setContextReaderForTests(() => ({ R2: bucket }));
    await deleteMediaFile('ads/audio/x.mp3');
    expect(bucket.delete).toHaveBeenCalledWith('ads/audio/x.mp3');
  });

  it('is a no-op, not a throw, without a bucket — cleanup must not fail the request', async () => {
    setContextReaderForTests(() => null);
    await expect(deleteMediaFile('ads/audio/x.mp3')).resolves.toBeUndefined();
  });

  it('swallows a bucket error for the same reason', async () => {
    setContextReaderForTests(() => ({
      R2: { put: vi.fn(), delete: vi.fn().mockRejectedValue(new Error('gone')) },
    }));
    await expect(deleteMediaFile('ads/audio/x.mp3')).resolves.toBeUndefined();
  });
});

describe('isTrustedStorageUrl', () => {
  // The SSRF gate: /api/advertise/campaigns fetches this URL server-side to
  // vet the audio, so anything it accepts is somewhere the server can be
  // pointed at.
  it('accepts an inline data: URL', () => {
    expect(isTrustedStorageUrl('data:audio/mpeg;base64,AAAA')).toBe(true);
  });

  it('accepts our own /cdn/ path, which is what storeMediaFile now returns', () => {
    expect(isTrustedStorageUrl(objectPublicUrl('ads/audio/a.mp3'))).toBe(true);
    expect(isTrustedStorageUrl('https://ihype.org/cdn/ads/audio/a.mp3')).toBe(true);
  });

  it('still accepts a direct R2 host, for rows written before the rewrite', () => {
    expect(isTrustedStorageUrl('https://acct123.r2.cloudflarestorage.com/ihype-media/a.mp3')).toBe(true);
    expect(isTrustedStorageUrl('https://pub-abc123.r2.dev/a.mp3')).toBe(true);
  });

  it('rejects our own origin OUTSIDE /cdn/', () => {
    // Origin alone would trust every route on the site — most of the surface
    // this check exists to close, including the internal API.
    expect(isTrustedStorageUrl('https://ihype.org/api/admin/users')).toBe(false);
    expect(isTrustedStorageUrl('https://ihype.org/')).toBe(false);
  });

  it('rejects arbitrary and internal hosts', () => {
    expect(isTrustedStorageUrl('https://evil.example.com/a.mp3')).toBe(false);
    expect(isTrustedStorageUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isTrustedStorageUrl('https://ihype.org.evil.com/cdn/a.mp3')).toBe(false);
    expect(isTrustedStorageUrl('not a url')).toBe(false);
  });

  it('rejects plain http when the configured base is https', () => {
    expect(isTrustedStorageUrl('http://ihype.org/cdn/a.mp3')).toBe(false);
  });

  it('trusts our own origin on a dev box, where that origin is http', () => {
    // The scheme is part of the origin comparison, so this widens nothing:
    // it trusts exactly the base URL the app is configured with. Without it
    // the app distrusts its own uploads locally and ad campaigns cannot be
    // created against a spot uploaded moments earlier.
    process.env.R2_PUBLIC_BASE_URL = 'http://localhost:8787';
    expect(isTrustedStorageUrl('http://localhost:8787/cdn/ads/audio/a.wav')).toBe(true);
    expect(isTrustedStorageUrl('http://localhost:8787/api/admin/users')).toBe(false);
    expect(isTrustedStorageUrl('http://evil.example.com/cdn/a.wav')).toBe(false);
  });
});
