import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createLoginOtpChallenge } from '@/lib/login-otp';
import { isEmailDeliveryConfigured } from '@/lib/mailer';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

const schema = z.object({
  channel: z.enum(['email', 'sms']).default('email'),
  identifier: z.string().trim().min(1).optional(),
  email: z.string().trim().min(1).optional(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const clientAddress = readClientAddress(request);
  const rateLimit = await consumeRateLimit(`mfa-start:${clientAddress}`, {
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
  } catch (err) {
    console.error('[auth/mfa/start]', err);
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  if (body.channel === 'sms') {
    return NextResponse.json(
      { error: 'Text message MFA needs an SMS provider and verified phone numbers before it can be enabled.' },
      { status: 501 }
    );
  }

  if (!isEmailDeliveryConfigured()) {
    return NextResponse.json(
      { error: 'Email delivery is not configured on this server. Contact support.' },
      { status: 503 }
    );
  }

  const challenge = await createLoginOtpChallenge({
    identifier: body.identifier ?? body.email ?? '',
    password: body.password
  });

  if (!challenge) {
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  }

  return NextResponse.json(challenge);
}
