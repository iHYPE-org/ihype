import { describe, expect, it } from 'vitest';
import {
  PROTECTED_PREFIXES,
  SESSION_EXEMPT_PATHS,
  WELCOME_PATH,
  isProtectedPath,
  isSafeLocalRedirect,
  resolvePostAuthRedirect,
} from '@/lib/auth-redirects';

describe('auth redirects', () => {
  it('sends empty auth redirects to Welcome first', () => {
    expect(resolvePostAuthRedirect(undefined)).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect(null)).toBe(WELCOME_PATH);
  });

  it('normalizes transitional auth routes to Welcome', () => {
    expect(resolvePostAuthRedirect('/auth/landing')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/auth/landing?module=tool-hub')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/auth/magic')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/auth/magic?token=abc')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/workbench')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/workbench?tool=settings')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/dashboard')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/dashboard?tab=tickets')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/login')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/login?callbackUrl=/home')).toBe(WELCOME_PATH);
  });

  it('preserves safe in-app callback destinations', () => {
    expect(resolvePostAuthRedirect('/radio')).toBe('/radio');
    expect(resolvePostAuthRedirect('/shows/my-show')).toBe('/shows/my-show');
  });

  it('rejects external or malformed callback destinations', () => {
    expect(isSafeLocalRedirect('https://example.com')).toBe(false);
    expect(isSafeLocalRedirect('//example.com')).toBe(false);
    expect(isSafeLocalRedirect('/\\example.com')).toBe(false);
    expect(isSafeLocalRedirect('/home\nx')).toBe(false);
  });
});

describe('isProtectedPath', () => {
  it('gates every protected prefix, itself and below', () => {
    for (const prefix of PROTECTED_PREFIXES) {
      expect(isProtectedPath(prefix)).toBe(true);
      expect(isProtectedPath(`${prefix}/anything`)).toBe(true);
    }
  });

  it('leaves public paths alone', () => {
    expect(isProtectedPath('/')).toBe(false);
    expect(isProtectedPath('/login')).toBe(false);
    expect(isProtectedPath('/shows/my-show')).toBe(false);
  });

  // The deadlock this exemption exists to break: /admin/setup creates the
  // administrator account, and gating it behind a session meant the only
  // credential that could reach it was the one it existed to create. Signing up
  // instead is refused — isReservedPlatformEmail() blocks @ihype.org at
  // /api/register — so the platform had no reachable path to its own admin.
  it('does not gate the account-recovery pages', () => {
    expect(isProtectedPath('/admin/setup')).toBe(false);
    expect(isProtectedPath('/admin/device-register')).toBe(false);
    for (const path of SESSION_EXEMPT_PATHS) {
      expect(isProtectedPath(path)).toBe(false);
    }
  });

  // Exact match, not prefix. A prefix test would exempt any future admin page
  // whose name merely starts with one of these, silently unprotecting it.
  it('still gates paths that only start with an exempt one', () => {
    expect(isProtectedPath('/admin/setup-users')).toBe(true);
    expect(isProtectedPath('/admin/setup/keys')).toBe(true);
    expect(isProtectedPath('/admin/device-registers')).toBe(true);
  });

  it('keeps every exempt path inside a protected prefix', () => {
    // If one ever moved out from under a gated prefix, the exemption would be
    // silently pointless — and the reader would have no way to notice.
    for (const path of SESSION_EXEMPT_PATHS) {
      expect(PROTECTED_PREFIXES.some((prefix) => path.startsWith(`${prefix}/`))).toBe(true);
    }
  });
});
