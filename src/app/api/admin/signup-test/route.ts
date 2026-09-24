import { randomBytes } from 'crypto';
import { requireAdminApi } from '@/lib/admin-api';
import { NextResponse, NextRequest } from 'next/server';
import { recordAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';
import { createHexId } from '@/lib/hex-id';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export async function POST(request: NextRequest) {
  const { session, response } = await requireAdminApi(request);
  if (!session) return response;

  const rl = await consumeRateLimit(`admin-signup-test:${session?.user?.id ?? 'unknown'}`, { limit: 3, windowMs: 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many test requests. Please wait.' }, { status: 429 });
  }

  const startedAt = Date.now();
  const stamp = startedAt.toString(36);
  const email = `qa+${stamp}@ihype.test`;
  const username = `qa${stamp}`.slice(0, 30);
  const token = randomBytes(24).toString('hex');

  try {
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          username,
          name: 'QA Signup Test',
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
          // The handle, not a second hex id. Profile.name is the title every
          // surface renders; naming it with a hex was the same defect the
          // register route carried, and a QA account that reproduces the bug
          // is a QA account that hides it.
          name: username,
          headline: 'QA signup test profile',
          bio: 'Disposable account created by the admin signup test.',
          aboutContent: 'Disposable signup QA account.'
        }
      });

      await tx.magicLinkToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        }
      });

      const linkToken = await tx.magicLinkToken.findUnique({
        where: { token },
        select: { userId: true, used: true, expiresAt: true }
      });
      const magicLinkVerified = Boolean(
        linkToken && linkToken.userId === user.id && !linkToken.used && linkToken.expiresAt > new Date()
      );

      await tx.user.delete({ where: { id: user.id } });

      return {
        magicLinkVerified,
        profileCreated: true,
        userCreated: true
      };
    });

    await recordAuditEvent({
      actorUserId: session?.user?.id,
      action: result.magicLinkVerified ? 'admin_signup_test_passed' : 'admin_signup_test_failed',
      entityType: 'signup_test',
      ipAddress: readClientAddress(request),
      metadata: { durationMs: Date.now() - startedAt, ...result }
    });

    return NextResponse.json({
      ok: result.magicLinkVerified,
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
