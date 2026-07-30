import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { readClientAddress } from '@/lib/request-meta';

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!isAdminSession(session) || !session?.user?.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { jobId } = await context.params;
  const updated = await db.notificationJob.updateMany({
    where: { id: jobId, status: 'FAILED' },
    data: {
      status: 'PENDING',
      attempts: 0,
      nextAttemptAt: new Date(),
      lockedAt: null,
      lastError: null,
      completedAt: null,
    },
  });
  if (updated.count !== 1) {
    return NextResponse.json({ error: 'Failed notification job not found.' }, { status: 404 });
  }

  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'notification_job_requeued',
    entityType: 'NotificationJob',
    entityId: jobId,
    ipAddress: readClientAddress(request),
  });

  return NextResponse.json({ ok: true, jobId });
}
