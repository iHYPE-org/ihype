import { db } from '@/lib/db';

/**
 * THE ONE PLACE A CONTENT REPORT'S "REMOVE" IS ENFORCED (DESIGN_SYNC row 458).
 *
 * Until 2026-09-14 three console surfaces decided the same report with three
 * vocabularies: /admin/moderation called this (as a private function of its
 * route) and marked the report ACTIONED; the Overview's report row PATCHed
 * /api/admin/content-reports/[id] with REVIEWED / RESOLVED / DISMISSED /
 * HIDDEN, where only HIDDEN did anything and its table disagreed with this
 * one (a show with paid orders CANCELED with no refund, a track "hidden" by
 * turning off free-use consent — which hides nothing, row 351); and
 * /admin/review's "Resolve" plus the bulk "Resolve all on page" flipped a
 * report to RESOLVED and touched nothing. A report leaving the queue now
 * means one of two things, on every surface: the content was removed by
 * this function (ACTIONED), or an operator looked and dismissed it.
 *
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

export type EnforcementOutcome = { ok: true } | { ok: false; error: string };

export async function enforceRemoval(targetType: string, targetId: string, reason: string): Promise<EnforcementOutcome> {
  switch (targetType) {
    case 'track':
    case 'media': {
      /* Two names for one thing. The scan pipeline files `track` with the
         asset's hexId; POST /api/content-reports lets a MEMBER file `media`,
         and until 2026-09-05 this switch had no arm for it — approving such a
         report marked it ACTIONED and unpublished nothing, found by the walk's
         moderation item on its first run. A member may hold either public id. */
      await db.artistMediaAsset.updateMany({
        where: { OR: [{ hexId: targetId }, { id: targetId }] },
        data: { isPublished: false, freeUseEnabled: false },
      });
      break;
    }
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

