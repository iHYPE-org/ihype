import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { log } from '@/lib/logger';
import {
  createEmailVerificationCode,
  sendVerificationEmail,
  verifyEmailCode,
} from '@/lib/email-verification';

/**
 * Attach a recovery email to an account that has none.
 *
 * WHY THIS EXISTS. Signup stopped asking fans for an email, and the passkey
 * path asks for nothing at all — correct, but it means an account can exist
 * whose only credential is one device. Settings could *display* an address and
 * there was no endpoint anywhere to set one, so losing that passkey meant
 * losing the account permanently, with no recovery path and nothing support
 * could do.
 *
 * WHY IT ONLY ADDS, NEVER CHANGES. A signed-in session can add an address here
 * but cannot replace one. Change-email is a different and considerably more
 * dangerous feature: whoever holds a session could point recovery at their own
 * inbox and take the account, so it needs re-authentication and a notice to
 * the displaced address to be safe. Neither is built, so this returns 409
 * rather than half-building it. The gap this closes is "no recovery path at
 * all"; changing an address you already control is not that gap.
 *
 * The address is only written once a code sent TO IT has been confirmed, so a
 * typo cannot strand recovery on an inbox the user does not own. Until then
 * the account is exactly as it was.
 */

const sendSchema = z.object({ action: z.literal('send'), email: z.string().trim().email().max(254) });
const confirmSchema = z.object({
  action: z.literal('confirm'),
  email: z.string().trim().email().max(254),
  code: z.string().trim().length(6),
});
const schema = z.discriminatedUnion('action', [sendSchema, confirmSchema]);

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  }
  const userId = session.user.id;

  // Per-IP and per-account, so neither a single account nor a spread of
  // addresses can be used to brute-force a 6-digit code or to use this as a
  // mail relay.
  const [ipLimit, userLimit] = await Promise.all([
    consumeRateLimit(`me-email:${readClientAddress(request)}`, { limit: 10, windowMs: 15 * 60 * 1000 }),
    consumeRateLimit(`me-email:user:${userId}`, { limit: 10, windowMs: 15 * 60 * 1000 }),
  ]);
  if (!ipLimit.allowed || !userLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Try again in a few minutes.' }, { status: 429 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const email = body.email.toLowerCase();

  const current = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!current) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }
  if (current.email) {
    return NextResponse.json(
      { error: 'This account already has an email address. Changing it is not supported yet.' },
      { status: 409 },
    );
  }

  // Same reservation the signup route enforces.
  if (email.endsWith('@ihype.org')) {
    return NextResponse.json(
      { error: 'Use an email address you control. @ihype.org addresses are reserved.' },
      { status: 400 },
    );
  }

  if (body.action === 'send') {
    // Deliberately NOT reporting whether the address is already on another
    // account. A signed-in caller could otherwise walk a list of addresses and
    // learn which have accounts. The collision surfaces on confirm instead,
    // as a generic failure, by which point a code has had to reach that inbox.
    const code = await createEmailVerificationCode(userId, email);
    await sendVerificationEmail(email, code);
    return NextResponse.json({ sent: true });
  }

  const valid = await verifyEmailCode(userId, email, body.code);
  if (!valid) {
    return NextResponse.json({ error: 'That code is invalid or has expired.' }, { status: 400 });
  }

  try {
    await db.user.update({
      where: { id: userId },
      // Verified by the code that just arrived at this address, so emailVerified
      // is set in the same write rather than leaving a confirmed address
      // sitting in an unverified state.
      data: { email, emailVerified: new Date() },
    });
  } catch (err) {
    // Unique constraint on User.email — another account already holds it.
    // Generic message on purpose; see the note above.
    log.error('[me/email]', err instanceof Error ? err : { error: String(err) }, 'could not attach email');
    return NextResponse.json(
      { error: 'That address could not be added to this account.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ email, verified: true });
}
