import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createMagicLinkToken } from '@/lib/magic-link-token';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { recordAuditEvent } from '@/lib/audit';
import { log } from '@/lib/logger';
import { WEB_HANDOFF_PATHS, isNativeAppUserAgent } from '@/lib/native-app';

export const dynamic = 'force-dynamic';

/** Five minutes: long enough to open a browser tab, short enough to be useless later. */
const WEB_HANDOFF_TTL_MS = 5 * 60 * 1000;

/**
 * Signs the browser tab the app opens in as the member who opened it
 * (DESIGN_SYNC row 514).
 *
 * WHY. Inside the iOS and Android apps a campaign is built and paid for on
 * the web, so the app opens the builder in a browser tab (SFSafariViewController
 * / a Custom Tab). That tab keeps its own cookies and starts signed OUT, and
 * the obvious way in is a dead end on the same phone: the emailed sign-in link
 * is a universal link / App Link, so tapping it in Mail opens the APP, not the
 * tab. Every advertiser created by /advertise/register signs in only that way.
 *
 * WHAT. A single-use sign-in link for the member who is ALREADY signed in, on
 * the existing magic-link machinery — the same `MagicLinkToken` row, the same
 * `/auth/confirm` page, the same atomic single-use POST — so there is no new way
 * into an account, only a new way to hand an existing session to a browser the
 * member is holding. It grants nothing the caller's session does not already
 * have.
 *
 * GUARDS, each for a reason:
 *   - A session, and the app's user-agent token: this exists for the app. A
 *     browser is already on the web and has no tab to sign in.
 *   - `Sec-Fetch-Site` must not be cross-site, the rule `/api/auth/magic` uses.
 *   - The destination is one of `WEB_HANDOFF_PATHS`, never caller-chosen.
 *   - Only for a member whose email is already verified: redeeming a magic
 *     link marks the email verified, which must never be the side effect of a
 *     link nobody read in an inbox. Anyone else gets the plain page and signs
 *     in there (a passkey works in the tab).
 *   - Five-minute expiry, single use, rate limited, audited — and the
 *     redemption itself goes through `checkAndRecordLogin`, so a sign-in from a
 *     new place is announced to the member as any other would be.
 *
 * The token is returned to the caller and never logged.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!isNativeAppUserAgent(request.headers.get('user-agent'))) {
    return NextResponse.json({ error: 'Only the iHYPE app needs this.' }, { status: 403 });
  }

  let next: unknown;
  try {
    ({ next } = (await request.json()) as { next?: unknown });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  if (typeof next !== 'string' || !(WEB_HANDOFF_PATHS as readonly string[]).includes(next)) {
    return NextResponse.json({ error: 'Unknown destination.' }, { status: 400 });
  }

  const limit = await consumeRateLimit(rateLimitKey('web-handoff', userId, null), { limit: 5, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { emailVerified: true } });
  if (!user?.emailVerified) {
    // Not an error: the caller opens the plain page and the member signs in there.
    return NextResponse.json({ url: next, signedIn: false }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  const { token, tokenHash } = createMagicLinkToken();
  try {
    await db.magicLinkToken.create({
      data: { token: tokenHash, userId, expiresAt: new Date(Date.now() + WEB_HANDOFF_TTL_MS) },
    });
  } catch (error) {
    log.error('[web-handoff]', error instanceof Error ? error : { error: String(error) }, 'token write failed');
    return NextResponse.json({ url: next, signedIn: false }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  recordAuditEvent({
    actorUserId: userId,
    action: 'auth.web_handoff',
    entityType: 'User',
    entityId: userId,
    metadata: { next },
  }).catch(() => {});

  const url = `/auth/confirm?${new URLSearchParams({ token, callbackUrl: next })}`;
  return NextResponse.json({ url, signedIn: true }, { headers: { 'Cache-Control': 'private, no-store' } });
}
