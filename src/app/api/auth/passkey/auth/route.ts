import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isSafeLocalRedirect, resolvePostAuthRedirect } from '@/lib/auth-redirects';
import { buildAuthSessionCookie } from '@/lib/auth-session';
import { getPasskeyAuthenticationOptions, verifyPasskeyAuthentication } from '@/lib/passkey';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

const isProduction = process.env.NODE_ENV === 'production';

// GET — generate discoverable-credential authentication options
export async function GET(request: Request) {
  const requestedRedirect = new URL(request.url).searchParams.get('callbackUrl');
  const safeRedirect = isSafeLocalRedirect(requestedRedirect) ? requestedRedirect : null;

  try {
    const clientAddress = readClientAddress(request);
    const rl = await consumeRateLimit(`pk-auth-options:${clientAddress}`, { limit: 20, windowMs: 60 * 1000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

    const options = await getPasskeyAuthenticationOptions();

    const resp = NextResponse.json(options);
    resp.cookies.set('pk_auth_challenge', options.challenge, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 300,
      path: '/',
      secure: isProduction,
    });
    if (safeRedirect) {
      resp.cookies.set('pk_auth_callback', safeRedirect, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 300,
        path: '/',
        secure: isProduction,
      });
    } else {
      resp.cookies.delete('pk_auth_callback');
    }

    return resp;
  } catch (err) {
    console.error('[passkey/auth] GET error:', err);
    return NextResponse.json({ error: 'Could not start passkey sign-in.' }, { status: 500 });
  }
}

// POST — verify assertion and issue a session cookie
export async function POST(request: Request) {
  const clearChallenge = (resp: NextResponse) => {
    resp.cookies.delete('pk_auth_challenge');
    resp.cookies.delete('pk_auth_callback');
    return resp;
  };

  try {
    const clientAddress = readClientAddress(request);
    const rl = await consumeRateLimit(`pk-auth:${clientAddress}`, { limit: 10, windowMs: 60 * 1000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

    const { cookies } = await import('next/headers');
    const jar = await cookies();
    const challenge = jar.get('pk_auth_challenge')?.value;
    const callbackRedirect = jar.get('pk_auth_callback')?.value;
    if (!challenge) return NextResponse.json({ error: 'Challenge expired. Try again.' }, { status: 400 });

    const body = await request.json();

    let userId: string | null;
    try {
      userId = await verifyPasskeyAuthentication(body, challenge);
    } catch (err) {
      console.error('[passkey/auth] verification threw:', err);
      return clearChallenge(NextResponse.json({ error: 'Passkey verification failed.' }, { status: 401 }));
    }

    if (!userId) return clearChallenge(NextResponse.json({ error: 'Passkey verification failed.' }, { status: 401 }));

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, image: true, role: true, emailVerified: true } });
    if (!user) return clearChallenge(NextResponse.json({ error: 'User not found.' }, { status: 404 }));

    const sessionCookie = await buildAuthSessionCookie(user);
    if (!sessionCookie) return clearChallenge(NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 }));

    const resp = NextResponse.json({ redirect: resolvePostAuthRedirect(callbackRedirect) });
    resp.cookies.set(sessionCookie);
    clearChallenge(resp);
    return resp;
  } catch (err) {
    console.error('[passkey/auth] unhandled error:', err);
    return NextResponse.json({ error: 'Sign-in failed. Please try again.' }, { status: 500 });
  }
}
