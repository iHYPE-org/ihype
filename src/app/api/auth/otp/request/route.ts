import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSmtpEmailConfigured } from '@/lib/mailer';
import { createLoginOtpChallenge } from '@/lib/login-otp';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

const schema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1)
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

    if (!isSmtpEmailConfigured()) {
      return NextResponse.json(
        { error: 'Email delivery is not configured on this server. Contact support.' },
        { status: 503 }
      );
    }

    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(await request.json());
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
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

    return NextResponse.json(challenge);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[otp/request]', msg);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
