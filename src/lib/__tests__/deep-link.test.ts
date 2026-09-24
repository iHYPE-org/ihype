import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { needsBrowserNavigation, resolveInternalPath } from '@/lib/deep-link';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

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

  it('accepts a safe internal path from push notification data', () => {
    expect(resolveInternalPath('/shows/my-show?from=push')).toBe('/shows/my-show?from=push');
  });

  it('rejects a different domain', () => {
    expect(resolveInternalPath('https://evil.example.com/phishing')).toBeNull();
  });

  it('rejects a domain that merely contains ihype.org as a suffix trick', () => {
    expect(resolveInternalPath('https://ihype.org.evil.example.com/x')).toBeNull();
  });

  it('rejects protocol-relative and backslash-prefixed paths', () => {
    expect(resolveInternalPath('//evil.example.com/x')).toBeNull();
    expect(resolveInternalPath('/\\evil.example.com/x')).toBeNull();
  });

  it('rejects insecure links even for the correct host', () => {
    expect(resolveInternalPath('http://ihype.org/radio')).toBeNull();
  });

  it('rejects a malformed URL', () => {
    expect(resolveInternalPath('not a url')).toBeNull();
  });

  it('keeps Cloudflare-protected admin links outside the native shell', () => {
    expect(resolveInternalPath('https://ihype.org/admin')).toBeNull();
    expect(resolveInternalPath('https://ihype.org/admin/users')).toBeNull();
    expect(resolveInternalPath('/admin?tab=system')).toBeNull();
  });

  it('keeps Cloudflare Access callbacks outside the native shell', () => {
    expect(resolveInternalPath('https://ihype.org/cdn-cgi/access/authorized?nonce=one-use')).toBeNull();
    expect(resolveInternalPath('/cdn-cgi/access/login/ihype.org')).toBeNull();
  });

  it('does not overmatch neighboring public paths', () => {
    expect(resolveInternalPath('/administrator')).toBe('/administrator');
    expect(resolveInternalPath('/cdn-cgi/image/example')).toBe('/cdn-cgi/image/example');
  });
});

describe('the iOS association keeps Cloudflare Access in Safari', () => {
  /* The shared, string-aware masker (row 513): a bare `/\*…*\/` regex read
     the `/*` inside `'/shows/*'` as a comment opener and deleted the path
     list up to the next real comment, so the ordering it checks vanished. */
  const source = maskComments(readFileSync('src/app/.well-known/apple-app-site-association/route.ts', 'utf8'));

  it('places explicit exclusions before every app-owned path', () => {
    const admin = source.indexOf("'NOT /admin'");
    const adminChildren = source.indexOf("'NOT /admin/*'");
    const access = source.indexOf("'NOT /cdn-cgi/access/*'");
    const firstAllowed = source.indexOf("'/shows/*'");

    expect(admin).toBeGreaterThan(-1);
    expect(adminChildren).toBeGreaterThan(admin);
    expect(access).toBeGreaterThan(adminChildren);
    expect(firstAllowed).toBeGreaterThan(access);
  });
});

/*
 * THE TWO HALVES OF NATIVE SIGN-IN, HELD TOGETHER.
 *
 * `magic-link.ts` builds the URL that goes in every sign-in email;
 * `NativePushRegistration` is what receives it when App Links (Android) or
 * Universal Links (iOS) open the app instead of a browser. Each was correct
 * alone and nothing compared them — the same shape as the passkey fix, where
 * the entitlement claimed a service the served file never granted.
 *
 * If the email's shape ever changes, this fails here rather than on a handset.
 */
describe('the magic link and the native shell agree', () => {
  // The literal from src/lib/magic-link.ts. Kept as a constant rather than
  // imported because that module pulls in the mailer and a database client.
  const EMAILED_LINK = 'https://ihype.org/api/auth/magic?token=abc123';

  it('resolves to an internal path with its token intact', () => {
    expect(resolveInternalPath(EMAILED_LINK)).toBe('/api/auth/magic?token=abc123');
  });

  it('is handed to the browser, not the client router', () => {
    const path = resolveInternalPath(EMAILED_LINK);
    expect(path).not.toBeNull();
    expect(needsBrowserNavigation(path!)).toBe(true);
  });

  it('leaves ordinary pages on the client router', () => {
    for (const page of ['/shows/my-show', '/app/map', '/app/me/tickets/abc', '/']) {
      expect(needsBrowserNavigation(page)).toBe(false);
    }
  });
});
