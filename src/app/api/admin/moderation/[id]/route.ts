import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

/**
 * Takes real enforcement action against the flagged content, keyed by
 * ContentReport.targetType. Best-effort: a missing/already-gone target
 * (deleted since the report was filed) is not an error — the report still
 * gets marked ACTIONED. Types with no safe automated action ('profile' —
 * no way to know which field/text was the problem) fall through with no
 * side effect beyond the status flip.
 */
const PROFILE_IMAGE_FIELDS = new Set(['heroImage', 'avatarImage', 'logoImage', 'galleryImage']);

async function enforceRemoval(targetType: string, targetId: string, reason: string): Promise<void> {
  switch (targetType) {
    case 'track':
      await db.artistMediaAsset.updateMany({ where: { hexId: targetId }, data: { isPublished: false, freeUseEnabled: false } });
      break;
    case 'comment':
      await db.showComment.updateMany({ where: { id: targetId }, data: { deletedAt: new Date() } });
      break;
    case 'show':
      await db.show.updateMany({ where: { id: targetId }, data: { status: 'CANCELED' } });
      break;
    case 'ad-creative':
      await db.adSubmission.updateMany({ where: { id: targetId }, data: { status: 'rejected' } });
      break;
    case 'profile-image': {
      // Field name is encoded as "auto_flag_image:<field>" by upload-graphic's
      // report creation — only clear it when it's a known, safe column.
      const field = reason.split(':')[1];
      if (field && PROFILE_IMAGE_FIELDS.has(field)) {
        await db.profile.updateMany({ where: { id: targetId }, data: { [field]: null } });
      }
      break;
    }
    default:
      break;
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const { action } = await request.json() as { action: 'approve' | 'dismiss' };

    const report = await db.contentReport.findUnique({ where: { id }, select: { targetType: true, targetId: true, reason: true } });
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (action === 'approve') {
      await enforceRemoval(report.targetType, report.targetId, report.reason);
    }

    await db.contentReport.update({ where: { id }, data: { status: action === 'approve' ? 'ACTIONED' : 'DISMISSED' } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/admin/moderation] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
