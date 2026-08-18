import NextAuth from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import { ADMIN_DEVICE_COOKIE, WORKBENCH_PATH, isProtectedPath } from '@/lib/auth-redirects';
import { MAP_TILE_HOSTS, isMapRoute } from '@/lib/csp-routes';
import { isLocalAuthSkipEnabled } from '@/lib/local-auth-skip';

const { auth } = NextAuth(authConfig);

function isLocalHost(hostname: string) {
  const normalizedHost = hostname.split(':')[0]?.toLowerCase() ?? hostname.toLowerCase();
  return normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost.endsWith('.localhost');
}

// Client-side Sentry posts events to the DSN's ingest host; without it in
// connect-src every browser error report is silently blocked by our own CSP.
// Lazily memoized — env vars are stable for the life of the isolate.
let cachedSentryOrigin: string | null = null;
function sentryIngestOrigin() {
  if (cachedSentryOrigin === null) {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    try {
      cachedSentryOrigin = dsn ? ` ${new URL(dsn).origin}` : '';
    } catch {
      cachedSentryOrigin = '';
    }
  }
  return cachedSentryOrigin;
}

function buildContentSecurityPolicy(nonce: string, allowEmbedding: boolean, allowSceneMap: boolean) {
  const developmentEval = process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'";
  // One map, one tile host: src/components/mmm/MmmMap.tsx draws CartoDB
  // raster tiles, and MAP_TILE_HOSTS in csp-routes.ts is the list. There used
  // to be a second entry for the retired module-deck mockup — and for a while
  // the policy allowed only THAT one, so the map that ships was blocked while
  // the mockup's was permitted.
  //
  // maplibre fetches raster tiles through the network stack rather than as
  // <img>, so connect-src is what governs them — the broad `img-src https:`
  // above does not cover this and reading it as though it did is what makes
  // the failure look like a rendering bug instead of a policy one.
  const sceneMapConnect = allowSceneMap ? ` ${MAP_TILE_HOSTS.join(' ')}` : '';
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    allowEmbedding ? 'frame-ancestors *' : "frame-ancestors 'none'",
    "object-src 'none'",
    // img-src stays broad: profile avatar/hero images are user-supplied URLs
    // that may point at any HTTPS host (including Google OAuth avatars).
    "img-src 'self' data: blob: https:",
    // Audio only ever reaches the browser through same-origin routes
    // (/api/media, /api/public-media, /cdn) — R2 is proxied server-side.
    "media-src 'self' data: blob:",
    "font-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' https://challenges.cloudflare.com https://js.stripe.com${developmentEval}`,
    `connect-src 'self' https://challenges.cloudflare.com https://api.stripe.com${sceneMapConnect}${sentryIngestOrigin()}`,
    "frame-src 'self' https://challenges.cloudflare.com https://js.stripe.com",
    ...(allowSceneMap ? ["worker-src 'self' blob:", "child-src 'self' blob:"] : []),
    'upgrade-insecure-requests',
  ].join('; ');
}

function applySecurityHeaders(response: NextResponse, nonce: string, pathname: string) {
  const allowEmbedding = pathname.startsWith('/embed/');
  // The map is the MMM shell's BASE LAYER and MmmShell is mounted in the /app
  // layout, so it exists on every /app route — not only /app/map. Scoping this
  // to one path would blank the map the moment someone opened /app/music or
  // /app/me, which is the whole reason the shell keeps it mounted.
  //
  // This is why signing in landed on a dead map: row 273 moved WORKBENCH_PATH
  // to /app/map, and this list still named /listen — where the map no longer
  // is. Without the blob worker-src below, maplibre cannot start its worker at
  // all, so the failure is a blank canvas rather than missing tiles.
  const allowSceneMap = isMapRoute(pathname);
  response.headers.set('x-pathname', pathname);
  if (!allowEmbedding) response.headers.set('X-Frame-Options', 'DENY');
  else response.headers.delete('X-Frame-Options');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', `camera=(), microphone=(), geolocation=${allowSceneMap ? '(self)' : '()'}`);
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy(nonce, allowEmbedding, allowSceneMap));
  return response;
}


/**
 * Verifies the admin device cookie's own signature, with no database round-trip.
 *
 * The device gate lives in `admin/layout.tsx`, and a layout's `redirect()`
 * cannot answer 307 once the page has begun streaming — so before this, an
 * INVALID device cookie still received 200 with the whole console in the body.
 * Measured against the real bundle: 115KB, including member email addresses.
 * The presence check added earlier closed only the ABSENT-cookie case; any
 * non-empty value walked straight through it. This closes the rest.
 *
 * Web Crypto rather than `node:crypto`: this runs in the Edge middleware
 * bundle, where the Node builtin is not available.
 *
 * ## It fails OPEN when the secret cannot be read, and that is deliberate
 *
 * If `ADMIN_DEVICE_SECRET` is not visible here, this returns `true` and the
 * request falls through to the layout's database check — exactly the behaviour
 * that shipped before this function existed. The alternative, failing closed,
 * would lock the only administrator out of the console they would use to fix
 * it, on a runtime difference rather than on anything an attacker did. A gate
 * that can brick the platform's owner is worse than the leak it prevents, and
 * the database check behind it never stopped running.
 */
async function hasValidDeviceSignature(cookieValue: string): Promise<boolean> {
  const secret = process.env.ADMIN_DEVICE_SECRET;
  if (!secret) return true;

  const dot = cookieValue.indexOf('.');
  if (dot <= 0) return false;
  const token = cookieValue.slice(0, dot);
  const provided = cookieValue.slice(dot + 1);

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token));
    const expected = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
    if (expected.length !== provided.length) return false;
    // Constant-time compare: a length-equal mismatch must not exit early.
    let diff = 0;
    for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
    return diff === 0;
  } catch {
    return true;
  }
}

const authMiddleware = auth(async (request) => {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const hostHeader = request.headers.get('host') ?? request.nextUrl.hostname;
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const pathname = request.nextUrl.pathname;

  if (
    process.env.NODE_ENV === 'production' &&
    forwardedProto &&
    forwardedProto !== 'https' &&
    !isLocalHost(hostHeader)
  ) {
    const secureUrl = request.nextUrl.clone();
    secureUrl.protocol = 'https:';
    return applySecurityHeaders(NextResponse.redirect(secureUrl, 308), nonce, pathname);
  }

  if (
    isProtectedPath(pathname) &&
    !request.auth
  ) {
    if (isLocalAuthSkipEnabled(hostHeader, process.env.LOCAL_AUTH_SKIP)) {
      const skipUrl = new URL('/api/dev/auth-skip', request.url);
      skipUrl.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`);
      return applySecurityHeaders(NextResponse.redirect(skipUrl), nonce, pathname);
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`);
    return applySecurityHeaders(NextResponse.redirect(loginUrl), nonce, pathname);
  }

  // THE DEVICE GATE HAS TO STOP THE REQUEST, NOT REDIRECT AFTER IT
  // (2026-08-14).
  //
  // `src/app/admin/layout.tsx` calls `redirect('/admin/device-register')` when
  // the device cookie does not match `User.adminDeviceTokenHash`. In the App
  // Router a layout and its page render in PARALLEL, and by the time the
  // layout's redirect is decided the page has already started streaming — so
  // Next cannot answer 307. Measured against the real production bundle in
  // workerd, with an admin session and no device cookie: `/admin` answers
  // **200, chunked**, and the body carries the entire console — every count,
  // the recent-signups list with real addresses, support requests, the audit
  // log — followed by an instruction telling the CLIENT to navigate away. A
  // browser obeys it and shows the register page, which is why this looked
  // like a working gate for as long as anyone only ever tested it in a browser.
  // `curl` with the same cookie keeps the body.
  //
  // That inverts the feature's whole purpose. Device binding exists for the
  // case where a session cookie is stolen; an attacker holding one is exactly
  // the party who reads the response instead of rendering it.
  //
  // So the gate moves in front of the render. Middleware only checks that the
  // cookie is PRESENT — the authoritative comparison stays in the layout,
  // which can hash and reach the database. Presence is enough to stop the
  // render for the case that leaks: a device that was never registered has no
  // cookie at all. A forged value gets a 200 and the layout's real check.
  //
  // `isProtectedPath` already excludes SESSION_EXEMPT_PATHS, so
  // `/admin/device-register` and `/admin/setup` cannot be caught by this and
  // the redirect cannot loop — the same reasoning the layout relies on.
  if (
    request.auth &&
    isProtectedPath(pathname) &&
    (pathname === '/admin' || pathname.startsWith('/admin/'))
  ) {
    const deviceCookie = request.cookies.get(ADMIN_DEVICE_COOKIE)?.value;
    // Absent OR unsigned-by-us. Both must stop here: the layout behind this
    // cannot refuse without leaking the page it was refusing.
    if (!deviceCookie || !(await hasValidDeviceSignature(deviceCookie))) {
      return applySecurityHeaders(
        NextResponse.redirect(new URL('/admin/device-register', request.url)),
        nonce,
        pathname,
      );
    }
  }

  if (request.auth && pathname === '/login') {
    return applySecurityHeaders(
      NextResponse.redirect(new URL(WORKBENCH_PATH, request.url)),
      nonce,
      pathname,
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('x-pathname', pathname);

  return applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    nonce,
    pathname,
  );
});

export default function middleware(request: NextRequest) {
  const host = (request.headers.get('host') ?? request.nextUrl.hostname)
    .split(':')[0]
    .toLowerCase();
  if (host === 'www.ihype.org') {
    const url = new URL(request.url);
    url.hostname = 'ihype.org';
    return NextResponse.redirect(url.toString(), 308);
  }
  return (authMiddleware as (req: NextRequest) => ReturnType<typeof NextResponse.next>)(request);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
