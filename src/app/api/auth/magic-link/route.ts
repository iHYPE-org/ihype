import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export async function POST(request: Request) {
  const clientAddress = readClientAddress(request);
  const rl = await consumeRateLimit(`magic-link:${clientAddress}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many attempts — wait a minute and try again." }, { status: 429 });

  let email: string;
  try {
    const body = await request.json();
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });

  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    // Don't reveal whether account exists
    return NextResponse.json({ ok: true });
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.magicLinkToken.create({ data: { token, userId: user.id, expiresAt } });

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'https://ihype.org';
  const link = `${baseUrl}/api/auth/magic?token=${token}`;

  await sendGenericEmail({
    to: email,
    subject: 'Your iHYPE sign-in link',
    text: `Click this link to sign in to iHYPE (expires in 15 minutes):\n\n${link}\n\nIf you did not request this, ignore this email.`,
    html: `<p>Click the link below to sign in to iHYPE. It expires in 15 minutes.</p><p><a href="${link}">${link}</a></p><p>If you did not request this, ignore this email.</p>`
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
