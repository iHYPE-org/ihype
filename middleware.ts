import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';

const { auth } = NextAuth(authConfig);

function isLocalHost(hostname: string) {
  const normalizedHost = hostname.split(':')[0]?.toLowerCase() ?? hostname.toLowerCase();
  return normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost.endsWith('.localhost');
}

export default auth((request) => {
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

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};
