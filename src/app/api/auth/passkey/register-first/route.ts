import { NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { getPasskeyRegistrationOptions, verifyPasskeyRegistration } from '@/lib/passkey';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

const SESSION_MAX_AGE = 12 * 60 * 60;
// Only allow passkey registration for accounts created in the last 10 minutes
const MAX_AGE_MS = 10 * 60 * 1000;

// GET — generate registration options for a brand-new user (no session required)
export async function GET(request: Request) {
  const clientAddress = readClientAddress(request);
  const rl = await consumeRateLimit(`pk-reg-first-opt:${clientAddress}`, { limit: 10, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Missing userId.' }, { status: 400 });

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, createdAt: true, _count: { select: { passkeys: true } } },
  });
  if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  // Only allow for very recently created accounts with no passkeys yet
  if (Date.now() - user.createdAt.getTime() > MAX_AGE_MS) {
    return NextResponse.json({ error: 'Link expired. Please sign in instead.' }, { status: 403 });
  }

  const options = await getPasskeyRegistrationOptions(user.id, user.username);

  const resp = NextResponse.json(options);
  resp.cookies.set('pk_reg_first_challenge', `${userId}:${options.challenge}`, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 300,
    path: '/',
  });
  return resp;
}

// POST — verify first passkey and issue a session
export async function POST(request: Request) {
  const clientAddress = readClientAddress(request);
  const rl = await consumeRateLimit(`pk-reg-first:${clientAddress}`, { limit: 5, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const raw = jar.get('pk_reg_first_challenge')?.value;
  if (!raw) return NextResponse.json({ error: 'Challenge expired. Try again.' }, { status: 400 });

  const colonIdx = raw.indexOf(':');
  const userId = raw.slice(0, colonIdx);
  const challenge = raw.slice(colonIdx + 1);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, role: true, createdAt: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  if (Date.now() - user.createdAt.getTime() > MAX_AGE_MS) {
    return NextResponse.json({ error: 'Link expired.' }, { status: 403 });
  }

  const body = await request.json();
  const ok = await verifyPasskeyRegistration(userId, body, challenge);

  const clearCookie = (resp: NextResponse) => { resp.cookies.delete('pk_reg_first_challenge'); return resp; };
  if (!ok) return clearCookie(NextResponse.json({ error: 'Passkey registration failed.' }, { status: 400 }));

  const secret = process.env.AUTH_SECRET;
  if (!secret) return clearCookie(NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 }));

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
      iat: now,
      exp: now + SESSION_MAX_AGE,
      jti: crypto.randomUUID(),
    },
    secret,
    salt: cookieName,
  });

  const resp = NextResponse.json({ redirect: '/auth/landing' });
  resp.cookies.set({ name: cookieName, value: token, httpOnly: true, sameSite: 'lax', path: '/', secure: isProduction, maxAge: SESSION_MAX_AGE });
  clearCookie(resp);
  return resp;
}
