import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { buildAuthSessionCookie } from '@/lib/auth-session';
import { getPasskeyRegistrationOptions, verifyPasskeyRegistration } from '@/lib/passkey';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

// Only allow passkey registration for accounts created in the last 10 minutes
const MAX_AGE_MS = 10 * 60 * 1000;
const isProduction = process.env.NODE_ENV === 'production';

// GET — generate registration options for a brand-new user (no session required)
export async function GET(request: Request) {
  const clientAddress = readClientAddress(request);
  const rl = await consumeRateLimit(`pk-reg-first-opt:${clientAddress}`, { limit: 10, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many attempts — wait a minute and try again." }, { status: 429 });

  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const userId = jar.get('pk_reg_first_uid')?.value;
  if (!userId) return NextResponse.json({ error: 'Registration session expired. Please sign up again.' }, { status: 400 });

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, createdAt: true, _count: { select: { passkeys: true } } },
  });
  if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  if (user._count.passkeys > 0) {
    return NextResponse.json({ error: 'Passkey already registered. Please sign in instead.' }, { status: 403 });
  }
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
    secure: isProduction,
  });
  return resp;
}

// POST — verify first passkey and issue a session
export async function POST(request: Request) {
  const clientAddress = readClientAddress(request);
  const rl = await consumeRateLimit(`pk-reg-first:${clientAddress}`, { limit: 5, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many attempts — wait a minute and try again." }, { status: 429 });

  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const raw = jar.get('pk_reg_first_challenge')?.value;
  if (!raw) return NextResponse.json({ error: 'Challenge expired. Try again.' }, { status: 400 });

  const colonIdx = raw.indexOf(':');
  if (colonIdx <= 0) return NextResponse.json({ error: 'Malformed challenge. Try again.' }, { status: 400 });
  const userId = raw.slice(0, colonIdx);
  const challenge = raw.slice(colonIdx + 1);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, role: true, createdAt: true, emailVerified: true, _count: { select: { passkeys: true } } },
  });
  if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  if (user._count.passkeys > 0) {
    return NextResponse.json({ error: 'Passkey already registered. Please sign in instead.' }, { status: 403 });
  }

  if (Date.now() - user.createdAt.getTime() > MAX_AGE_MS) {
    return NextResponse.json({ error: 'Link expired.' }, { status: 403 });
  }

  const body = await request.json();
  let ok: boolean;
  try {
    ok = await verifyPasskeyRegistration(userId, body, challenge);
  } catch (err) {
    console.error('[passkey/register-first] verification threw:', err);
    ok = false;
  }

  const clearCookie = (resp: NextResponse) => { resp.cookies.delete('pk_reg_first_challenge'); return resp; };
  if (!ok) return clearCookie(NextResponse.json({ error: 'Passkey registration failed.' }, { status: 400 }));

  const sessionCookie = await buildAuthSessionCookie(user);
  if (!sessionCookie) return clearCookie(NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 }));

  const resp = NextResponse.json({ redirect: WORKBENCH_PATH });
  resp.cookies.set(sessionCookie);
  clearCookie(resp);
  return resp;
}
