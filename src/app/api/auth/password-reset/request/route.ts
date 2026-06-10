import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAuditEvent } from '@/lib/audit';
import { db, withDbRetry } from '@/lib/db';
import { isEmailDeliveryConfigured, sendPasswordResetPasscodeEmail } from '@/lib/mailer';
import {
  createPasswordResetCode,
  createPasswordResetExpiry,
  normalizeEmailAddress,
  PASSWORD_RESET_CODE_TTL_MINUTES,
  hashPasswordResetCode
} from '@/lib/password-reset';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { verifyTurnstileToken } from '@/lib/turnstile';

const requestSchema = z.object({
  email: z.string().email(),
  company: z.string().trim().max(120).optional(),
  turnstileToken: z.string().optional(),
});

const GENERIC_SUCCESS_MESSAGE =
  'If that email is registered, we sent a temporary passcode with a 5 minute reset window.';

export async function POST(request: Request) {
  try {
    const clientAddress = readClientAddress(request);
    const ipRateLimit = await consumeRateLimit(`password-reset-request:${clientAddress}`, {
      limit: 5,
      windowMs: 15 * 60 * 1000
    });

    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many reset requests. Please wait a few minutes and try again.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(ipRateLimit.retryAfterSeconds)
          }
        }
      );
    }

    const body = requestSchema.parse(await request.json());

    const turnstileOk = await verifyTurnstileToken(body.turnstileToken, clientAddress);
    if (!turnstileOk) {
      return NextResponse.json({ error: 'Bot check failed. Please try again.' }, { status: 400 });
    }

    if (body.company) {
      await recordAuditEvent({
        action: 'bot_trap_triggered',
        entityType: 'password-reset',
        ipAddress: clientAddress,
        metadata: { field: 'company' }
      });
      return NextResponse.json({ error: 'Invalid password reset request.' }, { status: 400 });
    }

    const email = normalizeEmailAddress(body.email);
    const emailRateLimit = await consumeRateLimit(`password-reset-request:${email}`, {
      limit: 3,
      windowMs: 15 * 60 * 1000
    });

    if (!emailRateLimit.allowed) {
      return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE });
    }

    if (process.env.NODE_ENV === 'production' && !isEmailDeliveryConfigured()) {
      return NextResponse.json(
        { error: 'Password reset email delivery is not configured yet.' },
        { status: 503 }
      );
    }

    const user = await withDbRetry(() =>
      db.user.findUnique({
        where: { email }
      })
    );

    if (!user?.passwordHash) {
      return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE });
    }

    const code = createPasswordResetCode();
    const expiresAt = createPasswordResetExpiry();
    const codeHash = await hashPasswordResetCode(code);

    await withDbRetry(() =>
      db.passwordResetCode.deleteMany({
        where: {
          email
        }
      })
    );

    const resetCode = await withDbRetry(() =>
      db.passwordResetCode.create({
        data: {
          email,
          codeHash,
          expiresAt,
          userId: user.id
        }
      })
    );

    try {
      const delivery = await sendPasswordResetPasscodeEmail({
        email,
        code,
        name: user.name,
        expiresInMinutes: PASSWORD_RESET_CODE_TTL_MINUTES
      });

      return NextResponse.json({
        message:
          delivery.mode === 'log'
            ? `${GENERIC_SUCCESS_MESSAGE} Development mode is logging the code to the server console.`
            : GENERIC_SUCCESS_MESSAGE
      });
    } catch (error) {
      console.error('Password reset email delivery failed', error);

      await withDbRetry(() =>
        db.passwordResetCode.delete({
          where: {
            id: resetCode.id
          }
        })
      );

      return NextResponse.json(
        { error: 'Unable to send a reset passcode right now. Please try again in a moment.' },
        { status: 503 }
      );
    }
  } catch (err) {
    console.error('[auth/password-reset/request]', err);
    return NextResponse.json({ error: 'Invalid password reset request.' }, { status: 400 });
  }
}
