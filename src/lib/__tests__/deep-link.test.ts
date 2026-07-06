import { describe, it, expect } from 'vitest';
import { resolveInternalPath } from '@/lib/deep-link';

describe('resolveInternalPath', () => {
  it('extracts the path from a real ihype.org URL', () => {
    expect(resolveInternalPath('https://ihype.org/shows/my-show')).toBe('/shows/my-show');
  });

  it('preserves query string and hash', () => {
    expect(resolveInternalPath('https://ihype.org/shows?tab=foryou#top')).toBe('/shows?tab=foryou#top');
  });

  it('accepts the www subdomain', () => {
    expect(resolveInternalPath('https://www.ihype.org/artists/dj-test')).toBe('/artists/dj-test');
  });

  it('is case-insensitive on hostname', () => {
    expect(resolveInternalPath('https://IHYPE.ORG/radio')).toBe('/radio');
  });

  it('defaults to / for a bare-domain link', () => {
    expect(resolveInternalPath('https://ihype.org')).toBe('/');
  });

  it('rejects a different domain', () => {
    expect(resolveInternalPath('https://evil.example.com/phishing')).toBeNull();
  });

  it('rejects a domain that merely contains ihype.org as a suffix trick', () => {
    expect(resolveInternalPath('https://ihype.org.evil.example.com/x')).toBeNull();
  });

  it('rejects a malformed URL', () => {
    expect(resolveInternalPath('not a url')).toBeNull();
  });
});
