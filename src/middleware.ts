import NextAuth from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import { WORKBENCH_PATH, isProtectedPath } from '@/lib/auth-redirects';
import { MAP_TILE_HOSTS, isMapRoute } from '@/lib/csp-routes';

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

const authMiddleware = auth((request) => {
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
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`);
    return applySecurityHeaders(NextResponse.redirect(loginUrl), nonce, pathname);
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
