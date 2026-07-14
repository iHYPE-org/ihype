import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { isTrustedStorageUrl } from '@/lib/object-storage';

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
