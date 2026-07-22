import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { isInviteCodeRequiredRuntime, isValidInviteCode } from '@/lib/runtime-flags';
import { resolveReferrer } from '@/lib/registration-post-processing';
import { log } from '@/lib/logger';

const schema = z.object({ code: z.string().trim().min(1).max(80) });

/**
 * Front-door gate for the closed beta: before the signup form is shown, the
 * applicant must enter a HYPE referral code from an existing member (or a beta
 * invite code). This endpoint answers only "would this code satisfy the
 * invite gate?" — it mirrors POST /api/register's acceptance logic exactly
 * (shared BETA_INVITE_CODES code, an unclaimed admin-minted InviteCode, or a
 * real member's own HYPE code / @username) but performs NO account creation
 * and, crucially, never claims/consumes anything — the same code is re-checked
 * for real inside the register transaction, which is where a single-use admin
 * code is actually burned. Rate-limited so it can't be used to brute-force
 * codes or enumerate usernames.
 */
export async function POST(request: Request) {
  try {
    const clientAddress = readClientAddress(request);
    const rateLimit = await consumeRateLimit(`referral-validate:${clientAddress}`, {
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a few minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const { code } = schema.parse(await request.json());
    const trimmed = code.trim();

    const inviteCodeRequired = await isInviteCodeRequiredRuntime();
    // If invite-only signup is off there is nothing to validate — any code
    // (including none) is fine. The gate UI only renders when invite-only is
    // on, but answer honestly regardless.
    if (!inviteCodeRequired) {
      return NextResponse.json({ valid: true });
    }

    // 1) A shared code from BETA_INVITE_CODES.
    if (isValidInviteCode(trimmed, inviteCodeRequired)) {
      return NextResponse.json({ valid: true });
    }

    // 2) An admin-minted single-use InviteCode that's still unclaimed and
    //    unexpired. Not consumed here — register claims it in-transaction.
    const dbCode = await db.inviteCode
      .findUnique({
        where: { code: trimmed.toUpperCase() },
        select: { usedByUserId: true, expiresAt: true },
      })
      .catch(() => null);
    if (dbCode && !dbCode.usedByUserId && (!dbCode.expiresAt || dbCode.expiresAt > new Date())) {
      return NextResponse.json({ valid: true });
    }

    // 3) An existing member's own HYPE code (their profile hexId or @username).
    const referrer = await resolveReferrer(trimmed);
    if (referrer) {
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json(
      { valid: false, error: 'That code isn’t recognized. Ask an existing member for their HYPE code.' },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ valid: false, error: 'Enter a code to continue.' }, { status: 400 });
    }
    log.error('[referral-validate]', error instanceof Error ? error : null, 'Referral validation failed');
    return NextResponse.json({ valid: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
