import { NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

const schema = z.object({
  challengeId: z.string().min(1),
  otp: z.string().length(6)
});

const SESSION_MAX_AGE = 12 * 60 * 60; // 12 hours

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
    if (!challenge.user.emailVerified) {
      await db.user.update({ where: { id: challenge.user.id }, data: { emailVerified: new Date() } });
    }

    const user = challenge.user;
    const isProduction = process.env.NODE_ENV === 'production';

    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
    }

    // next-auth v5 uses __Secure- prefix for session token (not __Host-)
    // salt must match options.cookies.sessionToken.name used by the middleware/auth()
    const cookieName = isProduction ? '__Secure-authjs.session-token' : 'authjs.session-token';

    const now = Math.floor(Date.now() / 1000);
    const token = await encode({
      token: {
        sub: user.id,
        name: user.name,
        email: user.email,
        picture: user.image,
        role: user.role,
        iat: now,
        exp: now + SESSION_MAX_AGE,
        jti: crypto.randomUUID()
      },
      secret,
      salt: cookieName
    });

    const response = NextResponse.json({ redirect: '/auth/landing' });
    response.cookies.set({
      name: cookieName,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: isProduction,
      maxAge: SESSION_MAX_AGE
    });

    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[otp/signin]', msg);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
