import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';
import { createHexId } from '@/lib/hex-id';
import { isAdminSession } from '@/lib/permissions';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export async function POST(request: Request) {
  const session = await auth();

  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const rl = await consumeRateLimit(`admin-signup-test:${session?.user?.id ?? 'unknown'}`, { limit: 3, windowMs: 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many test requests. Please wait.' }, { status: 429 });
  }

  const startedAt = Date.now();
  const stamp = startedAt.toString(36);
  const email = `qa+${stamp}@ihype.test`;
  const username = `qa${stamp}`.slice(0, 30);
  const passwordHash = await bcrypt.hash(`Qa-${stamp}-123`, 8);
  const otp = '123456';
  const otpHash = await bcrypt.hash(otp, 8);
  const token = randomBytes(24).toString('hex');

  try {
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          username,
          name: 'QA Signup Test',
          passwordHash,
          isThirteenOrOlder: true,
          role: 'FAN'
        },
        select: { id: true }
      });

      await tx.profile.create({
        data: {
          ownerId: user.id,
          type: 'LISTENER',
          slug: username,
          hexId: createHexId(),
          name: createHexId(),
          headline: 'QA signup test profile',
          bio: 'Disposable account created by the admin signup test.',
          aboutContent: 'Disposable signup QA account.'
        }
      });

      await tx.mfaChallenge.create({
        data: {
          userId: user.id,
          token,
          secretCiphertext: otpHash,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        }
      });

      const challenge = await tx.mfaChallenge.findUnique({
        where: { token },
        select: { secretCiphertext: true }
      });
      const emailCodeVerified = Boolean(
        challenge?.secretCiphertext && (await bcrypt.compare(otp, challenge.secretCiphertext))
      );

      await tx.user.delete({ where: { id: user.id } });

      return {
        emailCodeVerified,
        profileCreated: true,
        userCreated: true
      };
    });

    await recordAuditEvent({
      actorUserId: session?.user?.id,
      action: result.emailCodeVerified ? 'admin_signup_test_passed' : 'admin_signup_test_failed',
      entityType: 'signup_test',
      ipAddress: readClientAddress(request),
      metadata: { durationMs: Date.now() - startedAt, ...result }
    });

    return NextResponse.json({
      ok: result.emailCodeVerified,
      durationMs: Date.now() - startedAt,
      ...result
    });
  } catch (error) {
    await recordAuditEvent({
      actorUserId: session?.user?.id,
      action: 'admin_signup_test_failed',
      entityType: 'signup_test',
      ipAddress: readClientAddress(request),
      metadata: { durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : 'Unknown error' }
    });

    return NextResponse.json({ error: 'Signup QA test failed.' }, { status: 500 });
  }
}
