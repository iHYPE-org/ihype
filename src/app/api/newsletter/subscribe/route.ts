import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { sendGenericEmail } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email().max(254),
  profileId: z.string().cuid(),
});

const CONFIRM_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function buildConfirmEmail(confirmUrl: string, profileName: string) {
  return {
    subject: `Confirm your subscription to ${profileName} on iHYPE`,
    text: [
      `Confirm you'd like updates from ${profileName} on iHYPE.`,
      '',
      confirmUrl,
      '',
      "If you didn't request this, you can ignore this email — you won't be subscribed unless you click the link.",
      '',
      '— iHYPE',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#10182a;">
        <h2 style="margin:0 0 12px;">Confirm your subscription</h2>
        <p>Confirm you'd like updates from <strong>${profileName}</strong> on iHYPE.</p>
        <p><a href="${confirmUrl}" style="display:inline-block;padding:10px 20px;background:#ff5029;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;">Confirm subscription</a></p>
        <p style="color:#5b657a;font-size:12px;">If you didn't request this, you can ignore this email — you won't be subscribed unless you click the link.</p>
      </div>
    `,
  };
}

export async function POST(request: Request) {
  const ip = (request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'anon').split(',')[0].trim();
  const rate = await consumeRateLimit(`newsletter-sub:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  let body: z.infer<typeof schema>;
  try { body = schema.parse(await request.json()); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const profile = await db.profile.findUnique({ where: { id: body.profileId }, select: { id: true, name: true } });
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const existing = await db.newsletterSubscription.findUnique({
    where: { email_profileId: { email: body.email, profileId: body.profileId } },
    select: { confirmedAt: true },
  });
  // Already confirmed: no-op, and don't re-send (avoids a confirm-link spam
  // vector against an address that already opted in).
  if (existing?.confirmedAt) return NextResponse.json({ ok: true, status: 'already-confirmed' });

  const confirmToken = randomBytes(32).toString('base64url');
  await db.newsletterSubscription.upsert({
    where: { email_profileId: { email: body.email, profileId: body.profileId } },
    create: {
      email: body.email,
      profileId: body.profileId,
      confirmToken,
      confirmTokenExpiresAt: new Date(Date.now() + CONFIRM_TOKEN_TTL_MS),
    },
    update: {
      confirmToken,
      confirmTokenExpiresAt: new Date(Date.now() + CONFIRM_TOKEN_TTL_MS),
    },
  });

  const confirmUrl = `${getBaseUrl()}/api/newsletter/confirm?token=${encodeURIComponent(confirmToken)}`;
  await sendGenericEmail({ to: body.email, ...buildConfirmEmail(confirmUrl, profile.name) }).catch((err) => {
    console.error('[newsletter/subscribe] confirm email failed', err);
  });

  return NextResponse.json({ ok: true, status: 'confirmation-sent' });
}
