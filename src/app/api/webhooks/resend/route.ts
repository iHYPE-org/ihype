import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { db } from '@/lib/db';

function verifyResendSignature(
  payload: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string
): boolean {
  const toSign = `${svixId}.${svixTimestamp}.${payload}`;
  const hmac = createHmac('sha256', secret).update(toSign).digest('base64');
  const expected = `v1,${hmac}`;
  const signatures = svixSignature.split(' ');
  return signatures.some((sig) => sig === expected);
}

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
