import NextAuth from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';

const { auth } = NextAuth(authConfig);

function isLocalHost(hostname: string) {
  const normalizedHost = hostname.split(':')[0]?.toLowerCase() ?? hostname.toLowerCase();
  return normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost.endsWith('.localhost');
}

function buildContentSecurityPolicy(nonce: string, allowEmbedding: boolean) {
  const developmentEval = process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    allowEmbedding ? 'frame-ancestors *' : "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' https://challenges.cloudflare.com https://js.stripe.com${developmentEval}`,
    "connect-src 'self' https://challenges.cloudflare.com https://api.stripe.com",
    "frame-src 'self' https://challenges.cloudflare.com https://js.stripe.com",
    'upgrade-insecure-requests',
  ].join('; ');
}

function applySecurityHeaders(response: NextResponse, nonce: string, pathname: string) {
  const allowEmbedding = pathname.startsWith('/embed/');
  response.headers.set('x-pathname', pathname);
  if (!allowEmbedding) response.headers.set('X-Frame-Options', 'DENY');
  else response.headers.delete('X-Frame-Options');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy(nonce, allowEmbedding));
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
    (pathname === WORKBENCH_PATH || pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) &&
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
