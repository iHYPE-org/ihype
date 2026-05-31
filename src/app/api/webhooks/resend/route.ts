import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyResendSignature } from '@/lib/resend-webhook';

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const svixId = request.headers.get('svix-id') ?? '';
  const svixTimestamp = request.headers.get('svix-timestamp') ?? '';
  const svixSignature = request.headers.get('svix-signature') ?? '';

  const body = await request.text();

  if (!verifyResendSignature(body, svixId, svixTimestamp, svixSignature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: { type: string; data: { to?: string[] } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    await db.processedWebhookEvent.create({
      data: { source: 'resend', eventId: svixId }
    });
  } catch {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (event.type === 'email.bounced' || event.type === 'email.complained') {
    const emails = event.data?.to ?? [];
    for (const email of emails) {
      await db.user.updateMany({
        where: { email },
        data: { emailBounced: true },
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
