import { type NextRequest, NextResponse } from 'next/server';
import { getAuthSessionCookieName, useSecureAuthCookies } from '@/lib/auth-cookie';

export const dynamic = 'force-dynamic';

// Sessions are built by hand (buildAuthSessionCookie) rather than through
// NextAuth's signIn flow, so we clear them by hand too. This dedicated route
// takes precedence over the [...nextauth] catch-all, whose GET only renders a
// confirmation page (it needs a CSRF POST to actually sign out) — which is why
// the plain "Sign out" links did nothing. A GET here reliably clears the
// session cookie and lands the user back on the marketing home.
function signOut(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', request.url));
  const name = getAuthSessionCookieName();
  const options = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: useSecureAuthCookies(),
    maxAge: 0,
  };
  // Expire the session cookie and any chunked variants NextAuth may have
  // written for an oversized token (…-token.0, …-token.1).
  response.cookies.set(name, '', options);
  response.cookies.set(`${name}.0`, '', options);
  response.cookies.set(`${name}.1`, '', options);
  return response;
}

export function GET(request: NextRequest) {
  return signOut(request);
}

export function POST(request: NextRequest) {
  return signOut(request);
}
