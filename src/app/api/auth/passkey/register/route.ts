import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getPasskeyRegistrationOptions, verifyPasskeyRegistration } from '@/lib/passkey';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

const isProduction = process.env.NODE_ENV === 'production';

// GET — generate registration options for the current logged-in user
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clientAddress = readClientAddress(request);
  const rlGet = await consumeRateLimit(`pk-reg-opts:${clientAddress}`, { limit: 10, windowMs: 5 * 60 * 1000 });
  if (!rlGet.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { username: true } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const options = await getPasskeyRegistrationOptions(session.user.id, user.username);

  const resp = NextResponse.json(options);
  resp.cookies.set('pk_reg_challenge', options.challenge, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 300,
    path: '/',
    secure: isProduction,
  });
  return resp;
}

// POST — verify registration response and save credential
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clientAddress = readClientAddress(request);
  const rl = await consumeRateLimit(`pk-register:${clientAddress}`, { limit: 5, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const challenge = jar.get('pk_reg_challenge')?.value;
  if (!challenge) return NextResponse.json({ error: 'Challenge expired. Try again.' }, { status: 400 });

  const raw = await request.json() as Record<string, unknown>;
  const name = typeof raw._name === 'string' ? raw._name : undefined;
  if (name) delete raw._name;
  let ok: boolean;
  try {
    ok = await verifyPasskeyRegistration(session.user.id, raw as unknown as import('@simplewebauthn/types').RegistrationResponseJSON, challenge, name);
  } catch (err) {
    console.error('[passkey/register] verification threw:', err);
    const resp = NextResponse.json({ error: 'Passkey registration failed.' }, { status: 400 });
    resp.cookies.delete('pk_reg_challenge');
    return resp;
  }

  const resp = NextResponse.json({ ok });
  resp.cookies.delete('pk_reg_challenge');
  return resp;
}
