import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
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
    const duplicate = await db.$transaction(async (tx) => {
      const existing = await tx.processedWebhookEvent.findUnique({
        where: { source_eventId: { source: 'resend', eventId: svixId } },
        select: { id: true },
      });
      if (existing) return true;

      if (event.type === 'email.bounced' || event.type === 'email.complained') {
        const emails = [...new Set(event.data?.to ?? [])];
        for (const email of emails) {
          await tx.user.updateMany({
            where: { email: email.trim().toLowerCase() },
            data: { emailBounced: true },
          });
        }
      }

      await tx.processedWebhookEvent.create({
        data: { source: 'resend', eventId: svixId },
      });
      return false;
    });

    return NextResponse.json({ ok: true, duplicate });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    log.error('[resend/webhook]', error instanceof Error ? error : null, `Processing failed for ${svixId}`);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
