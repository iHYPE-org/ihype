import { type NextRequest, NextResponse } from 'next/server';
import { decode } from 'next-auth/jwt';
import { getAuthSessionCookieName, useSecureAuthCookies } from '@/lib/auth-cookie';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { revokeSessionJti } from '@/lib/session-revocation';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Sessions are built by hand (buildAuthSessionCookie) rather than through
// NextAuth's signIn flow, so we clear them by hand too. This dedicated route
// takes precedence over the [...nextauth] catch-all, whose GET only renders a
// confirmation page (it needs a CSRF POST to actually sign out) — which is why
// the plain "Sign out" links did nothing. A GET here reliably clears the
// session cookie and lands the user back on the marketing home.
/**
 * Read the session token the browser is presenting, so the server can mark it
 * dead rather than merely asking the browser to forget it.
 *
 * NextAuth splits an oversized token across `…-token.0`, `…-token.1`, which is
 * why the chunks are joined when the whole cookie is absent — the same set the
 * clearing below covers.
 */
async function readSessionClaims(request: NextRequest, name: string) {
  const secret = readRuntimeEnv('AUTH_SECRET');
  if (!secret) return null;

  const whole = request.cookies.get(name)?.value;
  const chunked = [0, 1, 2]
    .map((index) => request.cookies.get(`${name}.${index}`)?.value)
    .filter(Boolean)
    .join('');
  const raw = whole || chunked;
  if (!raw) return null;

  try {
    return await decode({ token: raw, secret, salt: name });
  } catch (error) {
    // A token we cannot read is a token nobody can use either. Signing out
    // must still clear the cookies, so this is a note rather than a failure.
    log.error('[signout]', error instanceof Error ? error : { error: String(error) }, 'could not decode the session token');
    return null;
  }
}

async function signOut(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', request.url));
  const name = getAuthSessionCookieName();

  /* Expiring the cookie only ends the session in THIS browser. The token is a
     self-contained signed JWT good for twelve hours, so a copy taken before
     the member pressed sign-out kept working — which matters most in exactly
     the situation that makes someone press it. Revoking the token's own `jti`
     ends this one device's session without touching the member's others.
     (Security sweep follow-up, 2026-09-02.) */
  const claims = await readSessionClaims(request, name);
  await revokeSessionJti(
    typeof claims?.jti === 'string' ? claims.jti : null,
    typeof claims?.exp === 'number' ? claims.exp : null,
  );

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

export async function GET(request: NextRequest) {
  /* A GET that clears the session is a cross-site logout: any page can embed
     `<img src="https://ihype.org/api/auth/signout">`. The GET stays because
     plain "Sign out" links depend on it, but a cross-site fetch is refused —
     browsers label every request with `Sec-Fetch-Site`, and a top-level
     navigation from our own page reads `same-origin` (or `none` for a typed
     URL), never `cross-site`. (Security sweep, 2026-09-02.) */
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return signOut(request);
}

export async function POST(request: NextRequest) {
  return signOut(request);
}
