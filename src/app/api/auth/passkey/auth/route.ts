import { NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { getPasskeyAuthenticationOptions, verifyPasskeyAuthentication } from '@/lib/passkey';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

const SESSION_MAX_AGE = 12 * 60 * 60;

// GET — generate discoverable-credential authentication options
export async function GET(request: Request) {
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
  });
  return resp;
}

// POST — verify assertion and issue a session cookie
export async function POST(request: Request) {
  const clientAddress = readClientAddress(request);
  const rl = await consumeRateLimit(`pk-auth:${clientAddress}`, { limit: 10, windowMs: 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const challenge = jar.get('pk_auth_challenge')?.value;
  if (!challenge) return NextResponse.json({ error: 'Challenge expired. Try again.' }, { status: 400 });

  const body = await request.json();
  const userId = await verifyPasskeyAuthentication(body, challenge);

  const clearChallenge = (resp: NextResponse) => { resp.cookies.delete('pk_auth_challenge'); return resp; };

  if (!userId) return clearChallenge(NextResponse.json({ error: 'Passkey verification failed.' }, { status: 401 }));

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, image: true, role: true, emailVerified: true } });
  if (!user) return clearChallenge(NextResponse.json({ error: 'User not found.' }, { status: 404 }));

  const secret = process.env.AUTH_SECRET;
  if (!secret) return clearChallenge(NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 }));

  const isProduction = process.env.NODE_ENV === 'production';
  const cookieName = isProduction ? '__Secure-authjs.session-token' : 'authjs.session-token';
  const now = Math.floor(Date.now() / 1000);

  const token = await encode({
    token: {
      sub: user.id,
      name: user.name,
      email: user.email,
      picture: user.image,
      role: user.role,
      emailVerified: user.emailVerified?.toISOString() ?? null,
      iat: now,
      exp: now + SESSION_MAX_AGE,
      jti: crypto.randomUUID(),
    },
    secret,
    salt: cookieName,
  });

  const resp = NextResponse.json({ redirect: '/auth/landing' });
  resp.cookies.set({ name: cookieName, value: token, httpOnly: true, sameSite: 'lax', path: '/', secure: isProduction, maxAge: SESSION_MAX_AGE });
  clearChallenge(resp);
  return resp;
}
