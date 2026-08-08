import NextAuth from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import { WORKBENCH_PATH, isProtectedPath } from '@/lib/auth-redirects';

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
  const sceneMapConnect = allowSceneMap ? ' https://tiles.openfreemap.org' : '';
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
  // The map needs two things ordinary pages must not have: `worker-src blob:`,
  // because maplibre-gl builds its tile worker from a blob URL, and
  // geolocation, to open on where you actually are.
  //
  // This was keyed on `/listen` and `/ui-preview` — the two surfaces that USED
  // to host a map. The map moved into the Music · Map · Me shell at `/app/map`,
  // which is also the post-sign-in landing surface, and this allowance did not
  // move with it: maplibre's worker was blocked by CSP on the one route whose
  // whole point is the map. Keyed on the shell prefix rather than `/app/map`
  // exactly, because the map is mounted in the `/app` LAYOUT and stays mounted
  // underneath `/app/music/*` and `/app/me` (ADHERENCE rule 7).
  const allowSceneMap = pathname === '/app' || pathname.startsWith('/app/');
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
