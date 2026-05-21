import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAuditEvent } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { readClientAddress } from '@/lib/request-meta';

const schema = z.object({
  status: z.enum(['OPEN', 'REVIEWED', 'RESOLVED', 'DISMISSED', 'HIDDEN']),
  note: z.string().trim().max(500).optional()
});

async function applyModerationSideEffect(report: {
  targetType: string;
  targetId: string;
}, status: string) {
  if (status !== 'HIDDEN') {
    return;
  }

  if (report.targetType === 'profile') {
    await db.profile.updateMany({
      where: { id: report.targetId },
      data: {
        fanShareEnabled: false,
        verified: false,
        verificationStatus: 'UNVERIFIED'
      }
    });
    return;
  }

  if (report.targetType === 'show') {
    await db.show.updateMany({
      where: { id: report.targetId },
      data: { status: 'CANCELED' }
    });
    return;
  }

  if (report.targetType === 'media') {
    await db.artistMediaAsset.updateMany({
      where: { hexId: report.targetId },
      data: { freeUseEnabled: false }
    });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const report = await db.contentReport.findUnique({ where: { id } });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    await applyModerationSideEffect(report, body.status);

    const updatedReport = await db.contentReport.update({
      where: { id },
      data: { status: body.status, ...(body.note !== undefined && { note: body.note }) }
    });

    await recordAuditEvent({
      actorUserId: session?.user?.id,
      action: 'content_report_moderated',
      entityType: 'content-report',
      entityId: id,
      ipAddress: readClientAddress(request),
      metadata: {
        status: body.status,
        targetType: report.targetType,
        targetId: report.targetId,
        note: body.note ?? null
      }
    });

    return NextResponse.json(updatedReport);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid moderation action' }, { status: 400 });
    }

    console.error('Content report moderation failed', error);
    return NextResponse.json({ error: 'Could not update report' }, { status: 500 });
  }
}
