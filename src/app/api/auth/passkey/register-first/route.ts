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
import { log } from '@/lib/logger';

class PasskeyAlreadyRegisteredError extends Error {}

function clearBootstrapCookies(response: NextResponse) {
  response.cookies.delete(getPasskeyBootstrapCookieName());
  response.cookies.delete('pk_reg_first_uid');
  response.cookies.delete('pk_reg_first_challenge');
  return response;
}

/**
 * The POST's read of the challenge, issued as a WRITE — on purpose.
 *
 * Hyperdrive caches eligible read queries for 60 seconds by default and
 * **does not invalidate that cache when the application writes**. The passkey
 * ceremony is a read-after-write inside that window, which is precisely the
 * case Cloudflare's own docs tell you not to serve from cache:
 *
 *   1. POST /api/admin/setup (or /api/register) INSERTs the token —
 *      `challenge` is NULL.
 *   2. GET below SELECTs that row through `readBootstrapRecord()`. The result,
 *      challenge and all, enters the cache as NULL.
 *   3. The same handler UPDATEs the row to store the challenge.
 *   4. POST re-runs the byte-identical SELECT, hits the cache, and sees the
 *      pre-update NULL — so `!record.challenge` is true and the user is told
 *      "Challenge expired. Start registration again."
 *
 * This was not theoretical. `PasskeyBootstrapToken` held three rows, from
 * 2026-07-11, 2026-07-17 and 2026-08-10, every one with `usedAt` NULL: first
 * passkey registration had never once completed in production, and two real
 * users hit it and gave up. The platform's own administrator account could not
 * be created until Hyperdrive caching was turned off account-wide.
 *
 * Turning caching off fixed it, and a setting is not a guarantee — anyone may
 * re-enable it, and the failure is silent, blames the user's timing, and
 * leaves no error anywhere. So the fix belongs in the query. Hyperdrive never
 * caches a mutating statement, and `SET "challenge" = "challenge"` is a
 * deliberate no-op write whose only job is to make this read uncacheable while
 * leaving the row's meaning untouched.
 *
 * It does NOT consume the token. Claiming here would burn the capability on a
 * cancelled or mistyped ceremony and force the whole bootstrap to be redone;
 * the atomic single-use claim stays where it was, in the transaction below,
 * guarded on `usedAt IS NULL`.
 *
 * The `usedAt`/`expiresAt` guards live in the WHERE clause so a spent or
 * expired token returns no row at all, rather than being re-checked in JS
 * against values that could themselves be stale.
 */
async function readBootstrapRecordFresh(tokenHash: string, now: Date) {
  const rows = await db.$queryRaw<Array<{ id: string; userId: string; challenge: string | null }>>`
    UPDATE "PasskeyBootstrapToken"
       SET "challenge" = "challenge"
     WHERE "tokenHash" = ${tokenHash}
       AND "usedAt" IS NULL
       AND "expiresAt" > ${now}
    RETURNING "id", "userId", "challenge"
  `;
  return rows[0] ?? null;
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
    // See the note in passkey/auth: a per-IP key on a rarely-hit endpoint
    // means an almost always cold Durable Object, and the 750ms default
    // turns that into a halved limit on the sign-up path.
    timeoutMs: 2500,
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
    // Halved by a fallback this would be 2 attempts in five minutes on the
    // very first passkey a new account ever registers.
    timeoutMs: 2500,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Wait a minute and try again.' }, { status: 429 });
  }

  const now = new Date();
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const bootstrapToken = jar.get(getPasskeyBootstrapCookieName())?.value;
  if (!bootstrapToken) {
    return clearBootstrapCookies(
      NextResponse.json({ error: 'Challenge expired. Start registration again.' }, { status: 400 }),
    );
  }
  const tokenHash = hashPasskeyBootstrapToken(bootstrapToken);
  // Read through the write above, never the cacheable SELECT — see its header.
  const record = await readBootstrapRecordFresh(tokenHash, now);
  if (!record || !record.challenge) {
    return clearBootstrapCookies(
      NextResponse.json({ error: 'Challenge expired. Start registration again.' }, { status: 400 }),
    );
  }

  const user = await db.user.findUnique({
    where: { id: record.userId },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      image: true,
      role: true,
      emailVerified: true,
      userSecurityVersion: true,
    },
  });
  if (!user) {
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
    log.error('[passkey/register-first]', error instanceof Error ? error : { error: String(error) }, 'verification threw');
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
          tokenHash,
          challenge: record.challenge,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now, challenge: null },
      });
      if (claimed.count !== 1) return false;

      const existingPasskeys = await tx.passkey.count({ where: { userId: user.id } });
      if (existingPasskeys > 0) throw new PasskeyAlreadyRegisteredError();

      await tx.passkey.create({
        data: {
          userId: user.id,
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
    log.error('[passkey/register-first]', error instanceof Error ? error : { error: String(error) }, 'persistence failed');
    return NextResponse.json({ error: 'Could not save this passkey.' }, { status: 500 });
  }

  const sessionCookie = await buildAuthSessionCookie(user);
  if (!sessionCookie) {
    return clearBootstrapCookies(
      NextResponse.json({ error: 'Passkey saved, but the session could not be created. Please sign in.' }, { status: 500 }),
    );
  }

  const response = NextResponse.json({ redirect: WORKBENCH_PATH });
  response.cookies.set(sessionCookie);
  return clearBootstrapCookies(response);
}
