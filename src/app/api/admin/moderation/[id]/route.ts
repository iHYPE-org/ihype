import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { requireRecentAdminReauth } from '@/lib/admin-confirmation';
import { log } from '@/lib/logger';

/**
 * Takes real enforcement action against the flagged content, keyed by
 * ContentReport.targetType. Best-effort: a missing/already-gone target
 * (deleted since the report was filed) is not an error — the report still
 * gets marked ACTIONED. Types with no safe automated action ('profile' —
 * no way to know which field/text was the problem) fall through with no
 * side effect beyond the status flip. 'ad-creative' (the retired AdSubmission
 * pipeline's image-flag category) falls through the same way now that the
 * table is gone — any pre-existing report of that type can still be
 * dismissed/actioned in the queue, it just has no target left to act on.
 */
const PROFILE_IMAGE_FIELDS = new Set(['heroImage', 'avatarImage', 'logoImage', 'galleryImage']);

type EnforcementOutcome = { ok: true } | { ok: false; error: string };

async function enforceRemoval(targetType: string, targetId: string, reason: string): Promise<EnforcementOutcome> {
  switch (targetType) {
    case 'track':
      await db.artistMediaAsset.updateMany({ where: { hexId: targetId }, data: { isPublished: false, freeUseEnabled: false } });
      break;
    case 'comment':
      await db.showComment.updateMany({ where: { id: targetId }, data: { deletedAt: new Date() } });
      break;
    case 'show': {
      /* A status flip is not a cancellation once money has moved. Buyers of a
         show set CANCELED here kept their charge and lost their event: the
         refund loop lives in POST /api/shows/[showId]/cancel (organizer or
         admin), which refunds every CAPTURED order, skips scanned tickets and
         tells the holders. So a show with paid orders is refused here and the
         admin is pointed at that flow; one with none is cancelled outright.
         (Second security scan, 2026-09-02.) */
      const paidOrders = await db.ticketOrder.count({ where: { showId: targetId, status: 'CAPTURED' } });
      if (paidOrders > 0) {
        return {
          ok: false,
          error: `This show has ${paidOrders} paid order${paidOrders === 1 ? '' : 's'}. Cancel it through the show's cancel flow (/shows/<slug>/cancel), which refunds buyers; approving here would only flip the status.`,
        };
      }
      await db.show.updateMany({ where: { id: targetId }, data: { status: 'CANCELED', canceledAt: new Date(), cancellationReason: 'Removed after a content report' } });
      break;
    }
    case 'ad-audio':
      await db.ad.updateMany({ where: { id: targetId }, data: { status: 'REJECTED' } });
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
  return { ok: true };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!isAdminSession(session) || !session?.user?.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Step-up auth: `approve` takes real, largely irreversible enforcement
    // action (cancels a show, unpublishes a track, soft-deletes a comment,
    // rejects an ad, clears a profile image). Gate it the same way the
    // sibling content-reports route already gates its own moderation
    // decisions — a stolen admin session shouldn't be able to tear down
    // content without a fresh passkey check.
    const reauthed = await requireRecentAdminReauth(session.user.id);
    if (!reauthed) {
      return NextResponse.json({ requiresReauth: true }, { status: 401 });
    }

    const { id } = await params;
    const { action } = await request.json() as { action?: unknown };
    if (action !== 'approve' && action !== 'dismiss') {
      // Previously any unrecognised value silently fell through to DISMISSED,
      // quietly closing a report nobody had actually decided on.
      return NextResponse.json({ error: 'action must be "approve" or "dismiss".' }, { status: 400 });
    }

    const report = await db.contentReport.findUnique({ where: { id }, select: { targetType: true, targetId: true, reason: true } });
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (action === 'approve') {
      const outcome = await enforceRemoval(report.targetType, report.targetId, report.reason);
      if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: 409 });
    }

    await db.contentReport.update({ where: { id }, data: { status: action === 'approve' ? 'ACTIONED' : 'DISMISSED' } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error('[api/admin/moderation]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
