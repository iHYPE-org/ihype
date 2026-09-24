/**
 * Four connections the final pre-launch scan found broken in production
 * (2026-09-24, DESIGN_SYNC row 513), each measured with curl before the fix.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { permissionsPolicyFor } from '@/lib/csp-routes';
import { isProtectedPath } from '@/lib/auth-redirects';
import { buildTicketVerificationUrl } from '@/lib/tickets';

describe('permissionsPolicyFor', () => {
  it('lets the signed-in shell use the camera, where the door scanner lives', () => {
    expect(permissionsPolicyFor('/app/me/shows/night-one/scan')).toContain('camera=(self)');
    // The policy is the DOCUMENT's; a member reaches the scanner by client
    // navigation from any shell screen.
    expect(permissionsPolicyFor('/app/map')).toContain('camera=(self)');
  });

  it('keeps the camera off everywhere outside the shell', () => {
    for (const path of ['/', '/shows/night-one', '/login', '/info']) {
      expect(permissionsPolicyFor(path), path).toContain('camera=()');
    }
  });

  it('lets the landing page and the shell ask for location, and nothing else', () => {
    expect(permissionsPolicyFor('/')).toContain('geolocation=(self)');
    expect(permissionsPolicyFor('/app/map')).toContain('geolocation=(self)');
    expect(permissionsPolicyFor('/shows/night-one')).toContain('geolocation=()');
  });

  it('never grants the microphone', () => {
    for (const path of ['/', '/app/map', '/app/me/shows/x/scan']) {
      expect(permissionsPolicyFor(path)).toContain('microphone=()');
    }
  });
});

describe('the root share card', () => {
  it('is public, so a link to any public page unfurls with its image', () => {
    expect(isProtectedPath('/opengraph-image')).toBe(false);
    expect(isProtectedPath('/twitter-image')).toBe(false);
  });
});

describe('the iOS app-link file', () => {
  const saved = process.env.APPLE_TEAM_ID;
  afterEach(() => {
    if (saved === undefined) delete process.env.APPLE_TEAM_ID;
    else process.env.APPLE_TEAM_ID = saved;
  });

  it('claims the per-ticket URL every ticket email and QR carries', async () => {
    process.env.APPLE_TEAM_ID = 'ABCDE12345';
    const { GET } = await import('@/app/.well-known/apple-app-site-association/route');
    const res = await GET();
    const body = await res.json() as { applinks: { details: Array<{ paths: string[] }> } };
    const paths = body.applinks.details[0]!.paths;
    const ticketPath = new URL(buildTicketVerificationUrl('abc123')).pathname;
    const matches = paths.some((p) => !p.startsWith('NOT ') && (
      p === ticketPath || (p.endsWith('/*') && ticketPath.startsWith(p.slice(0, -1)))
    ));
    expect(matches, `${ticketPath} against ${paths.join(', ')}`).toBe(true);
  });
});

describe('Android passkeys', () => {
  const saved = process.env.ANDROID_CERT_SHA256_FINGERPRINTS;
  afterEach(() => {
    if (saved === undefined) delete process.env.ANDROID_CERT_SHA256_FINGERPRINTS;
    else process.env.ANDROID_CERT_SHA256_FINGERPRINTS = saved;
  });

  it('the activity turns WebView WebAuthn on for the app, behind a feature check', async () => {
    const { readFileSync } = await import('node:fs');
    const activity = readFileSync('android/app/src/main/java/com/ihype/app/MainActivity.java', 'utf8');
    expect(activity).toMatch(/WebViewFeature\.isFeatureSupported\(WebViewFeature\.WEB_AUTHENTICATION\)/);
    expect(activity).toMatch(/WEB_AUTHENTICATION_SUPPORT_FOR_APP/);
    // Capacitor declares webkit as `implementation`; the app must name it to compile.
    expect(readFileSync('android/app/build.gradle', 'utf8')).toMatch(/androidx\.webkit:webkit:\$androidxWebkitVersion/);
  });

  it('the domain grants the app its credentials', async () => {
    process.env.ANDROID_CERT_SHA256_FINGERPRINTS = Array.from({ length: 32 }, () => 'AB').join(':');
    const { GET } = await import('@/app/.well-known/assetlinks.json/route');
    const res = await GET();
    const body = await res.json() as Array<{ relation: string[] }>;
    expect(body[0]!.relation).toContain('delegate_permission/common.get_login_creds');
    expect(body[0]!.relation).toContain('delegate_permission/common.handle_all_urls');
  });

  it('the server accepts the origin app-mode WebAuthn sends (the third half)', async () => {
    /* App mode signs clientDataJSON with `android:apk-key-hash:…`, not the
       page origin; without this every Android ceremony is refused after the
       device accepted it. Verified against a live handset is still owed. */
    const { readFileSync } = await import('node:fs');
    const passkey = readFileSync('src/lib/passkey.ts', 'utf8');
    expect(passkey).toMatch(/readRuntimeEnv\('ANDROID_CERT_SHA256_FINGERPRINTS'\)/);
    expect(passkey.match(/expectedOrigin: origin,/g)).toHaveLength(2);
  });
});
