import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { buildAuthSessionCookie } from '@/lib/auth-session';
import {
  getPasskeyRegistrationOptions,
  verifyPasskeyRegistrationResponse,
} from '@/lib/passkey';
import {
  getPasskeyBootstrapCookieName,
  hashPasskeyBootstrapToken,
} from '@/lib/passkey-bootstrap';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

class PasskeyAlreadyRegisteredError extends Error {}

function clearBootstrapCookies(response: NextResponse) {
  response.cookies.delete(getPasskeyBootstrapCookieName());
  response.cookies.delete('pk_reg_first_uid');
  response.cookies.delete('pk_reg_first_challenge');
  return response;
}

async function readBootstrapRecord() {
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const token = jar.get(getPasskeyBootstrapCookieName())?.value;
  if (!token) return null;

  return db.passkeyBootstrapToken.findUnique({
    where: { tokenHash: hashPasskeyBootstrapToken(token) },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          image: true,
          role: true,
          emailVerified: true,
          userSecurityVersion: true,
          _count: { select: { passkeys: true } },
        },
      },
    },
  });
}

// Generate registration options for a brand-new user. The browser carries a
// random capability; the user ID and challenge remain server-side.
export async function GET(request: Request) {
  const clientAddress = readClientAddress(request);
  const rl = await consumeRateLimit(`pk-reg-first-opt:${clientAddress}`, {
    limit: 10,
    windowMs: 5 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Wait a minute and try again.' }, { status: 429 });
  }

  const record = await readBootstrapRecord();
  const now = new Date();
  if (!record || record.usedAt || record.expiresAt <= now) {
    return clearBootstrapCookies(
      NextResponse.json({ error: 'Registration session expired. Please sign up again.' }, { status: 400 }),
    );
  }
  if (record.user._count.passkeys > 0) {
    return clearBootstrapCookies(
      NextResponse.json({ error: 'Passkey already registered. Please sign in instead.' }, { status: 403 }),
    );
  }

  const options = await getPasskeyRegistrationOptions(record.user.id, record.user.username);
  const stored = await db.passkeyBootstrapToken.updateMany({
    where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
    data: { challenge: options.challenge },
  });
  if (stored.count !== 1) {
    return clearBootstrapCookies(
      NextResponse.json({ error: 'Registration session expired. Please sign up again.' }, { status: 400 }),
    );
  }

  return NextResponse.json(options);
}

// Verify the first passkey, atomically consume the capability, and issue a
// session. A forged user ID cookie is useless because no user ID is trusted
// from the browser.
export async function POST(request: Request) {
  const clientAddress = readClientAddress(request);
  const rl = await consumeRateLimit(`pk-reg-first:${clientAddress}`, {
    limit: 5,
    windowMs: 5 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Wait a minute and try again.' }, { status: 429 });
  }

  const record = await readBootstrapRecord();
  const now = new Date();
  if (!record || record.usedAt || record.expiresAt <= now || !record.challenge) {
    return clearBootstrapCookies(
      NextResponse.json({ error: 'Challenge expired. Start registration again.' }, { status: 400 }),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid passkey response.' }, { status: 400 });
  }

  let verified;
  try {
    verified = await verifyPasskeyRegistrationResponse(
      body as Parameters<typeof verifyPasskeyRegistrationResponse>[0],
      record.challenge,
    );
  } catch (error) {
    console.error('[passkey/register-first] verification threw:', error);
    verified = null;
  }
  if (!verified) {
    return NextResponse.json({ error: 'Passkey registration failed.' }, { status: 400 });
  }

  try {
    const registered = await db.$transaction(async (tx) => {
      const claimed = await tx.passkeyBootstrapToken.updateMany({
        where: {
          id: record.id,
          tokenHash: record.tokenHash,
          challenge: record.challenge,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now, challenge: null },
      });
      if (claimed.count !== 1) return false;

      const existingPasskeys = await tx.passkey.count({ where: { userId: record.user.id } });
      if (existingPasskeys > 0) throw new PasskeyAlreadyRegisteredError();

      await tx.passkey.create({
        data: {
          userId: record.user.id,
          ...verified,
          name: null,
        },
      });
      return true;
    });

    if (!registered) {
      return clearBootstrapCookies(
        NextResponse.json({ error: 'Registration session was already used.' }, { status: 409 }),
      );
    }
  } catch (error) {
    if (error instanceof PasskeyAlreadyRegisteredError) {
      return clearBootstrapCookies(
        NextResponse.json({ error: 'Passkey already registered. Please sign in instead.' }, { status: 403 }),
      );
    }
    console.error('[passkey/register-first] persistence failed:', error);
    return NextResponse.json({ error: 'Could not save this passkey.' }, { status: 500 });
  }

  const sessionCookie = await buildAuthSessionCookie(record.user);
  if (!sessionCookie) {
    return clearBootstrapCookies(
      NextResponse.json({ error: 'Passkey saved, but the session could not be created. Please sign in.' }, { status: 500 }),
    );
  }

  const response = NextResponse.json({ redirect: WORKBENCH_PATH });
  response.cookies.set(sessionCookie);
  return clearBootstrapCookies(response);
}
