import { describe, expect, it } from 'vitest';
import { getDeviceCookieName } from '@/lib/admin-device';
import {
  PROTECTED_PREFIXES,
  SESSION_EXEMPT_PATHS,
  WELCOME_PATH,
  WORKBENCH_PATH,
  isProtectedPath,
  isSafeLocalRedirect,
  resolvePostAuthRedirect,
  ADMIN_DEVICE_COOKIE,
} from '@/lib/auth-redirects';

describe('auth redirects', () => {
  /**
   * Signing IN lands on the map, not on Welcome.
   *
   * Welcome used to be the default here, so every returning member saw an
   * interstitial on the way to where they were going. It is still the right
   * screen for a NEW account, which is why `AuthRegister` now asks for it by
   * name — that is a decision the two call sites can make and this shared
   * default cannot, because it cannot tell signing up from signing in.
   */
  it('sends empty auth redirects to the workbench', () => {
    expect(resolvePostAuthRedirect(undefined)).toBe(WORKBENCH_PATH);
    expect(resolvePostAuthRedirect(null)).toBe(WORKBENCH_PATH);
  });

  it('still preserves Welcome when a caller asks for it, which signup does', () => {
    expect(resolvePostAuthRedirect(WELCOME_PATH)).toBe(WELCOME_PATH);
  });

  it('normalizes transitional auth routes to the workbench', () => {
    expect(resolvePostAuthRedirect('/auth/landing')).toBe(WORKBENCH_PATH);
    expect(resolvePostAuthRedirect('/auth/landing?module=tool-hub')).toBe(WORKBENCH_PATH);
    expect(resolvePostAuthRedirect('/auth/magic')).toBe(WORKBENCH_PATH);
    expect(resolvePostAuthRedirect('/auth/magic?token=abc')).toBe(WORKBENCH_PATH);
    expect(resolvePostAuthRedirect('/workbench')).toBe(WORKBENCH_PATH);
    expect(resolvePostAuthRedirect('/workbench?tool=settings')).toBe(WORKBENCH_PATH);
    expect(resolvePostAuthRedirect('/dashboard')).toBe(WORKBENCH_PATH);
    expect(resolvePostAuthRedirect('/dashboard?tab=tickets')).toBe(WORKBENCH_PATH);
    expect(resolvePostAuthRedirect('/login')).toBe(WORKBENCH_PATH);
    expect(resolvePostAuthRedirect('/login?callbackUrl=/home')).toBe(WORKBENCH_PATH);
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

  // The device gate lives in two places on purpose: middleware checks the
  // cookie is PRESENT (before the console can stream — see the block in
  // src/middleware.ts), and the layout does the authoritative hash comparison.
  // Middleware cannot import admin-device.ts to learn the name, so the name
  // lives here and that module imports it. This asserts the two have not been
  // allowed to drift back into two strings: if they do, middleware silently
  // stops matching and the gate goes back to leaking the whole console body
  // as a streamed 200.
  it('shares one definition of the admin device cookie name', () => {
    expect(getDeviceCookieName()).toBe(ADMIN_DEVICE_COOKIE);
  });
});
