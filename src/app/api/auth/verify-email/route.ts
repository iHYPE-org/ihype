import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import {
  createEmailVerificationCode,
  sendVerificationEmail,
  verifyEmailCode
} from '@/lib/email-verification';

const sendSchema = z.object({ action: z.literal('send') });
const confirmSchema = z.object({ action: z.literal('confirm'), code: z.string().trim().length(6) });
const schema = z.discriminatedUnion('action', [sendSchema, confirmSchema]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  }

  const rl = await consumeRateLimit(
    `email-verify:${readClientAddress(request)}`,
    { limit: 10, windowMs: 15 * 60 * 1000 }
  );
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const userId = session.user.id;
  const email = session.user.email;

  if (body.action === 'send') {
    const code = await createEmailVerificationCode(userId, email);
    await sendVerificationEmail(email, code);
    return NextResponse.json({ sent: true });
  }

  const valid = await verifyEmailCode(userId, email, body.code);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid or expired code.' }, { status: 400 });
  }

  await db.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() }
  });

  return NextResponse.json({ verified: true });
}
