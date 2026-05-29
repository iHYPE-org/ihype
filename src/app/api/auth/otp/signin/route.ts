import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { buildAuthSessionCookie } from '@/lib/auth-session';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

const schema = z.object({
  challengeId: z.string().min(1),
  otp: z.string().length(6)
});

export async function POST(request: Request) {
  try {
    const clientAddress = readClientAddress(request);
    const rateLimit = await consumeRateLimit(`otp-verify:${clientAddress}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000
    });

    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many attempts. Please wait.' }, { status: 429 });
    }

    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(await request.json());
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    // Per-challenge brute-force check: look up email via challenge before verifying
    const challengeForEmail = await db.mfaChallenge.findUnique({
      where: { token: body.challengeId },
      select: { user: { select: { email: true } } }
    });
    if (challengeForEmail?.user?.email) {
      const emailRateLimit = await consumeRateLimit(
        `otp-email:${challengeForEmail.user.email}`,
        { limit: 5, windowMs: 15 * 60 * 1000 }
      );
      if (!emailRateLimit.allowed) {
        return NextResponse.json(
          { error: 'Too many failed attempts, try again in 15 minutes' },
          { status: 429 }
        );
      }
    }

    const challenge = await db.mfaChallenge.findUnique({
      where: { token: body.challengeId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true, role: true, emailVerified: true }
        }
      }
    });

    if (!challenge || !challenge.secretCiphertext) {
      return NextResponse.json({ error: 'Invalid or expired code.' }, { status: 401 });
    }

    if (challenge.expiresAt < new Date()) {
      await db.mfaChallenge.delete({ where: { id: challenge.id } });
      return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(body.otp, challenge.secretCiphertext);
    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect code.' }, { status: 401 });
    }

    await db.mfaChallenge.delete({ where: { id: challenge.id } });

    // OTP success proves the user owns this email — mark verified if not already set.
    const emailVerified = challenge.user.emailVerified ?? new Date();
    if (!challenge.user.emailVerified) {
      await db.user.update({ where: { id: challenge.user.id }, data: { emailVerified } });
    }

    const sessionCookie = await buildAuthSessionCookie({ ...challenge.user, emailVerified });
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
    }

    const redirectPath =
      challenge.user.role === 'ADMIN' ? '/admin' : WORKBENCH_PATH;
    const response = NextResponse.json({ redirect: redirectPath });
    response.cookies.set(sessionCookie);

    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[otp/signin]', msg);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
