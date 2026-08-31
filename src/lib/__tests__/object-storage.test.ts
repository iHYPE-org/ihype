import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { isObjectStorageConfigured, isTrustedStorageUrl } from '@/lib/object-storage';
import { setContextReaderForTests } from '@/lib/runtime-env';

describe('isTrustedStorageUrl', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.R2_ACCOUNT_ID = 'acct123';
    process.env.R2_BUCKET_NAME = 'ihype-media';
    delete process.env.R2_PUBLIC_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('accepts an inline data: URL', () => {
    expect(isTrustedStorageUrl('data:audio/mpeg;base64,AAAA')).toBe(true);
  });

  it('accepts the default R2 endpoint for the configured account/bucket', () => {
    expect(isTrustedStorageUrl('https://acct123.r2.cloudflarestorage.com/ihype-media/ads/audio/foo.mp3')).toBe(true);
  });

  it('accepts a configured R2_PUBLIC_URL base', () => {
    process.env.R2_PUBLIC_URL = 'https://media.ihype.org';
    expect(isTrustedStorageUrl('https://media.ihype.org/ads/audio/foo.mp3')).toBe(true);
  });

  // The exact scenario the SSRF finding was about: a client-submitted
  // audioUrl the server would otherwise fetch() unvalidated.
  it('rejects an arbitrary external URL', () => {
    expect(isTrustedStorageUrl('https://evil.example.com/steal')).toBe(false);
  });

  it('rejects internal/metadata-service-style URLs', () => {
    expect(isTrustedStorageUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isTrustedStorageUrl('https://localhost:8080/admin')).toBe(false);
  });

  it('rejects a different R2 account/bucket than the one configured', () => {
    expect(isTrustedStorageUrl('https://otheracct.r2.cloudflarestorage.com/other-bucket/x.mp3')).toBe(false);
  });

  it('rejects non-URL garbage', () => {
    expect(isTrustedStorageUrl('not a url')).toBe(false);
    expect(isTrustedStorageUrl('')).toBe(false);
  });
});

/**
 * The reason every R2 value here is read through readRuntimeEnv() rather than
 * process.env. Worker SECRETS never appear on process.env under workerd — they
 * arrive on the Cloudflare env binding — and none of the four R2 credentials is
 * a plain [vars] entry in wrangler.toml, so they can only be secrets. Reading
 * process.env therefore reported object storage as unconfigured in production
 * however carefully it had been set up, and every caller silently fell back to
 * base64-in-Postgres (or, for ad audio, answered 503).
 *
 * This pins the fix at the only point where the two lookups differ: process.env
 * empty, values present on the binding.
 */
describe('isObjectStorageConfigured — credentials reach it from the Worker binding', () => {
  const originalEnv = { ...process.env };
  const R2_KEYS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];

  beforeEach(() => {
    for (const key of R2_KEYS) delete process.env[key];
  });

  afterEach(() => {
    setContextReaderForTests(null);
    process.env = { ...originalEnv };
  });

  it('is false when neither process.env nor the binding carries the credentials', () => {
    setContextReaderForTests(() => ({}));
    expect(isObjectStorageConfigured()).toBe(false);
  });

  it('is TRUE when the credentials exist only on the Cloudflare binding', () => {
    // Before the fix this returned false — the production failure exactly.
    setContextReaderForTests(() => ({
      R2_ACCOUNT_ID: 'acct123',
      R2_ACCESS_KEY_ID: 'key123',
      R2_SECRET_ACCESS_KEY: 'secret123',
      R2_BUCKET_NAME: 'ihype-media',
    }));
    expect(isObjectStorageConfigured()).toBe(true);
  });

  it('still reads a value that is on process.env, which must not regress', () => {
    setContextReaderForTests(() => ({}));
    for (const key of R2_KEYS) process.env[key] = 'set';
    expect(isObjectStorageConfigured()).toBe(true);
  });

  it('trusts an R2 URL whose account and bucket come from the binding', () => {
    setContextReaderForTests(() => ({ R2_ACCOUNT_ID: 'acct123', R2_BUCKET_NAME: 'ihype-media' }));
    expect(isTrustedStorageUrl('https://acct123.r2.cloudflarestorage.com/ihype-media/a.mp3')).toBe(true);
    expect(isTrustedStorageUrl('https://evil.example.com/a.mp3')).toBe(false);
  });
});
