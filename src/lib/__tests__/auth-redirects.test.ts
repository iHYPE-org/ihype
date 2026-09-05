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

  // The point of the inversion. A route nobody classified is PROTECTED, so
  // forgetting produces a login redirect rather than an exposed page. If this
  // ever goes back to false, the gate has been turned inside out again and
  // every future page ships public by default.
  it('protects a route nobody has classified', () => {
    expect(isProtectedPath('/some-page-added-next-year')).toBe(true);
    expect(isProtectedPath('/internal/tooling')).toBe(true);
    expect(isProtectedPath('/artists/some-band')).toBe(true);
    expect(isProtectedPath('/tracks/abc123')).toBe(true);
  });

  // The funnel. Gating any of these is a deadlock: the charter's 10% promoter
  // share is attributed by a link a stranger clicks, and a stranger has no
  // session by definition.
  it('leaves the funnel and referral entry points open', () => {
    for (const path of ['/', '/join', '/launch', '/for-artists', '/register', '/login']) {
      expect(isProtectedPath(path), path).toBe(false);
    }
    expect(isProtectedPath('/h/abc123')).toBe(false);
    expect(isProtectedPath('/invite/abc123')).toBe(false);
    expect(isProtectedPath('/shows/signal-yard')).toBe(false);
    expect(isProtectedPath('/embed/deadbeef')).toBe(false);
  });

  // Apple and Google both require a publicly reachable privacy policy URL for
  // a store listing, and a consent link nobody can open is not consent.
  it('leaves legal and policy reachable without an account', () => {
    for (const path of ['/info', '/info/anything', '/privacy', '/terms', '/charter', '/community-rules']) {
      expect(isProtectedPath(path), path).toBe(false);
    }
  });

  // Static files under public/ come through the same matcher as pages. A
  // default-deny gate that redirects the service worker or the app icons to a
  // login page breaks installability and offline, silently.
  it('never gates a static asset', () => {
    for (const path of ['/manifest.json', '/sw.js', '/robots.txt', '/sitemap.xml',
                        '/icons/icon-192.png', '/.well-known/security.txt', '/brand/logo.webp']) {
      expect(isProtectedPath(path), path).toBe(false);
    }
  });

  /**
   * The association files, and why the test above could not catch them.
   *
   * That loop passes `/.well-known/security.txt`, which has a DOT — so it
   * exercised `isStaticAsset()`'s extension heuristic and proved nothing about
   * the namespace. `apple-app-site-association` has no extension by Apple's
   * specification, so default-deny caught it and production answered
   * **HTTP 307 to /login** (measured 2026-09-04). Apple's CDN does not follow
   * redirects: it records the domain as unverified and Universal Links can
   * never work, while the route handler sits there serving correct JSON to
   * anyone who happens to be signed in.
   *
   * Asserted as literal strings rather than by walking the directory, because
   * these exact names are what Apple and Google fetch — a rename is a silent
   * outage at a third party.
   */
  it('never gates an extensionless .well-known file', () => {
    for (const path of [
      '/.well-known/apple-app-site-association',
      '/.well-known/assetlinks.json',
      '/.well-known/openid-configuration',
    ]) {
      expect(isProtectedPath(path), path).toBe(false);
    }
  });

  // The public part of /shows is exactly the show page. Door-staff and
  // organiser tooling lives one segment deeper and must stay gated, even
  // though each of those routes also defends itself.
  it('opens the show page but not the tooling beneath it', () => {
    expect(isProtectedPath('/shows/signal-yard')).toBe(false);
    expect(isProtectedPath('/shows/signal-yard/opengraph-image')).toBe(false);
    for (const deep of ['scan', 'checkin', 'qr', 'poster', 'cancel', 'lineup']) {
      expect(isProtectedPath(`/shows/signal-yard/${deep}`), deep).toBe(true);
    }
  });

  it('depth-limits the other single-segment public entry points', () => {
    expect(isProtectedPath('/h/abc')).toBe(false);
    expect(isProtectedPath('/h/abc/anything')).toBe(true);
    expect(isProtectedPath('/invite/abc')).toBe(false);
    expect(isProtectedPath('/embed/abc')).toBe(false);
    expect(isProtectedPath('/embed/abc/admin')).toBe(true);
  });

  // A member's own data is not the front door, even where the front door is.
  it('gates the private surface behind a public sibling', () => {
    expect(isProtectedPath('/advertise')).toBe(false);
    expect(isProtectedPath('/advertise/dashboard')).toBe(true);
    expect(isProtectedPath('/support')).toBe(false);
    expect(isProtectedPath('/support/tickets')).toBe(true);
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

/**
 * The two URLs the app stores hold us to, asserted because a silent redirect
 * to /login is what failure looks like here — not an error, not a 404, just a
 * sign-in wall where a reviewer expected a page.
 *
 * `/delete-account` is Google Play's Data Safety deletion URL. It must open
 * with no account and no app installed; behind default-deny it would answer a
 * redirect to /login, which is the exact thing the URL exists to disprove.
 *
 * `/.well-known/apple-app-site-association` is the same class of mistake and
 * has already happened once: it has NO file extension, so the static-asset
 * heuristic could not see it, production answered 307, and Apple's CDN — which
 * does not follow redirects — could only ever have recorded the domain as
 * unverified.
 */
describe('store-facing URLs stay reachable signed out', () => {
  it('serves the Play account-deletion page without a session', () => {
    expect(isProtectedPath('/delete-account')).toBe(false);
  });

  it('serves both association files without a session', () => {
    expect(isProtectedPath('/.well-known/apple-app-site-association')).toBe(false);
    expect(isProtectedPath('/.well-known/assetlinks.json')).toBe(false);
  });

  it('still gates a members-only page, so the check above means something', () => {
    /* Without this the suite would pass just as happily if isPublicPath
       answered "not protected" for everything. */
    expect(isProtectedPath('/app/me/settings')).toBe(true);
  });
});
