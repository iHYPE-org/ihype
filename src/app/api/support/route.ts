import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAuditEvent } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { log } from '@/lib/logger';

const supportSchema = z.object({
  type: z.enum(['login', 'verification', 'copyright', 'ticketing', 'safety', 'privacy', 'general']),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  subject: z.string().trim().min(3).max(160),
  details: z.string().trim().min(10).max(2500),
  company: z.string().trim().max(120).optional()
});

function getPriority(type: z.infer<typeof supportSchema>['type']) {
  if (type === 'safety' || type === 'copyright' || type === 'ticketing' || type === 'privacy') {
    return 'HIGH';
  }

  return 'NORMAL';
}

export async function POST(request: Request) {
  const clientAddress = readClientAddress(request);
  const session = await auth();

  const rateLimit = await consumeRateLimit(`support:${clientAddress}`, {
    limit: 8,
    windowMs: 15 * 60 * 1000
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many support requests. Please wait a few minutes and try again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) }
      }
    );
  }

  try {
    const body = supportSchema.parse(await request.json());

    if (body.company) {
      await recordAuditEvent({
        actorUserId: session?.user?.id,
        action: 'bot_trap_triggered',
        entityType: 'support',
        ipAddress: clientAddress,
        metadata: { field: 'company' }
      });
      return NextResponse.json({ error: 'Invalid support request.' }, { status: 400 });
    }

    const supportRequest = await db.supportRequest.create({
      data: {
        requesterUserId: session?.user?.id ?? null,
        type: body.type,
        name: body.name || session?.user?.name || null,
        email: body.email || session?.user?.email || null,
        subject: body.subject,
        details: body.details,
        priority: getPriority(body.type)
      }
    });

    await recordAuditEvent({
      actorUserId: session?.user?.id,
      action: 'support_request_created',
      entityType: 'support',
      entityId: supportRequest.id,
      ipAddress: clientAddress,
      metadata: {
        type: body.type,
        priority: supportRequest.priority
      }
    });

    return NextResponse.json({ id: supportRequest.id, status: supportRequest.status }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid support request.' }, { status: 400 });
    }

    log.error('[api/support]', error instanceof Error ? error : { error: String(error) }, 'support request failed');
    return NextResponse.json({ error: 'Could not send support request.' }, { status: 500 });
  }
}
