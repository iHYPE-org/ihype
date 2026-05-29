import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isEmailDeliveryConfigured } from '@/lib/mailer';
import { createLoginOtpChallenge } from '@/lib/login-otp';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { db } from '@/lib/db';

const schema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().default(''),
  tosAccepted: z.boolean().optional(),
  inviteCode: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const clientAddress = readClientAddress(request);
    const rateLimit = await consumeRateLimit(`otp-request:${clientAddress}`, {
      limit: 5,
      windowMs: 10 * 60 * 1000
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many code requests. Wait a few minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(await request.json());
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    if (!isEmailDeliveryConfigured()) {
      return NextResponse.json(
        { error: 'Email delivery is not configured on this server. Contact support.' },
        { status: 503 }
      );
    }

    // Invite-only gate
    if (process.env.INVITE_ONLY === 'true') {
      const code = body.inviteCode;
      if (!code) return NextResponse.json({ error: 'An invite code is required.' }, { status: 403 });
      const invite = await db.inviteCode.findUnique({ where: { code } });
      if (!invite || invite.usedAt || (invite.expiresAt && invite.expiresAt < new Date())) {
        return NextResponse.json({ error: 'Invalid or expired invite code.' }, { status: 403 });
      }
    }

    // Per-identifier limit prevents targeted inbox flooding independent of IP
    const identifierRl = await consumeRateLimit(
      `otp-request:id:${body.identifier.toLowerCase().trim()}`,
      { limit: 5, windowMs: 10 * 60 * 1000 }
    );
    if (!identifierRl.allowed) {
      return NextResponse.json(
        { error: 'Too many code requests. Wait a few minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(identifierRl.retryAfterSeconds) } }
      );
    }

    const challenge = await createLoginOtpChallenge({
      identifier: body.identifier,
      password: body.password
    });

    if (!challenge) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // Record ToS acceptance if provided
    if (body.tosAccepted) {
      const identifier = body.identifier.toLowerCase().trim();
      const user = await db.user.findFirst({
        where: { OR: [{ email: identifier }, { username: identifier }] },
        select: { id: true, tosAcceptedAt: true },
      });
      if (user && !user.tosAcceptedAt) {
        await db.user.update({ where: { id: user.id }, data: { tosAcceptedAt: new Date() } });
      }
    }

    return NextResponse.json(challenge);
  } catch (err) {
    console.error('[otp/request]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
