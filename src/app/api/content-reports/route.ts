import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAuditEvent } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { readClientAddress } from '@/lib/request-meta';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';

const reportSchema = z.object({
  targetType: z.enum(['profile', 'show', 'media', 'ticket']),
  targetId: z.string().min(3).max(120),
  reason: z.string().trim().min(3).max(120),
  details: z.string().trim().max(1200).optional(),
  company: z.string().trim().max(120).optional()
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const clientAddress = readClientAddress(request);

  const rl = await consumeRateLimit(rateLimitKey('content-report', session.user.id, clientAddress), { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  try {
    const body = reportSchema.parse(await request.json());

    if (body.company) {
      await recordAuditEvent({
        actorUserId: session.user.id,
        action: 'bot_trap_triggered',
        entityType: 'content-report',
        ipAddress: clientAddress,
        metadata: { field: 'company' }
      });
      return NextResponse.json({ error: 'Invalid report.' }, { status: 400 });
    }

    const report = await db.contentReport.create({
      data: {
        reporterUserId: session.user.id,
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason,
        details: body.details || null
      }
    });

    await recordAuditEvent({
      actorUserId: session.user.id,
      action: 'content_report_created',
      entityType: 'content-report',
      entityId: report.id,
      ipAddress: clientAddress,
      metadata: {
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason
      }
    });

    return NextResponse.json({ id: report.id, status: report.status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid report.' }, { status: 400 });
    }

    console.error('Content report failed', error);
    return NextResponse.json({ error: 'Could not submit report.' }, { status: 500 });
  }
}
