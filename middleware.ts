import NextAuth from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';

const { auth } = NextAuth(authConfig);

function isLocalHost(hostname: string) {
  const normalizedHost = hostname.split(':')[0]?.toLowerCase() ?? hostname.toLowerCase();
  return normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost.endsWith('.localhost');
}

const authMiddleware = auth((request) => {
  const hostHeader = request.headers.get('host') ?? request.nextUrl.hostname;
  const forwardedProto = request.headers.get('x-forwarded-proto');

  if (
    process.env.NODE_ENV === 'production' &&
    forwardedProto &&
    forwardedProto !== 'https' &&
    !isLocalHost(hostHeader)
  ) {
    const secureUrl = request.nextUrl.clone();
    secureUrl.protocol = 'https:';
    return NextResponse.redirect(secureUrl, 308);
  }

  const pathname = request.nextUrl.pathname;

  if ((pathname === WORKBENCH_PATH || pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) && !request.auth) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (request.auth && pathname === '/login') {
    return NextResponse.redirect(new URL(WORKBENCH_PATH, request.url));
  }

  return NextResponse.next();
});

// Redirect www to apex BEFORE NextAuth sees the request — NextAuth rejects hosts
// that don't match AUTH_URL, causing an Internal Server Error for www.ihype.org.
export default function middleware(request: NextRequest) {
  if (request.nextUrl.hostname === 'www.ihype.org') {
    const url = request.nextUrl.clone();
    url.hostname = 'ihype.org';
    return NextResponse.redirect(url, 308);
  }
  return (authMiddleware as (req: NextRequest) => ReturnType<typeof NextResponse.next>)(request);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};
