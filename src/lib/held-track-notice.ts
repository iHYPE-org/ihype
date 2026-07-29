import { db } from '@/lib/db';
import { sendOperationalEmail } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/utils';
import { recordAuditEvent } from '@/lib/audit';
import { log } from '@/lib/logger';

/**
 * Tells an artist their upload is still being reviewed, once it has been held
 * unusually long.
 *
 * Track uploads that the scan flags are withheld from the artist's page until
 * a human clears them. That is the right default for a platform whose
 * licensing story is the product — but it converts operator response time
 * into someone else's outage, and the person affected is the one with the
 * least information. They uploaded a track, saw "held for review", and then
 * heard nothing.
 *
 * Explicitly NOT an auto-publish. A rule that releases anything unreviewed
 * after N days is a bypass: upload the infringing track, wait, and the queue
 * publishes it for you. The delay is our problem to fix, not a reason to
 * lower the bar. Auto-rejecting is no better — it punishes an artist for our
 * latency and destroys a legitimate upload.
 *
 * So: the artist gets told, the admin already sees the queue go red in the
 * workbench and the digest, and the decision stays with a person.
 */

/** Days a track may sit held before its owner is told it is still in review. */
export const HELD_TRACK_NOTICE_DAYS = 5;

const NOTICE_ACTION = 'media.held.notice_sent';

export async function notifyStaleHeldTracks(): Promise<{
  ok: boolean;
  checked: number;
  notified: number;
}> {
  const cutoff = new Date(Date.now() - HELD_TRACK_NOTICE_DAYS * 24 * 60 * 60 * 1000);

  const stale = await db.contentReport.findMany({
    where: { status: 'OPEN', targetType: 'track', createdAt: { lt: cutoff } },
    select: { id: true, targetId: true, createdAt: true },
    take: 50,
  });

  if (stale.length === 0) return { ok: true, checked: 0, notified: 0 };

  let notified = 0;

  for (const report of stale) {
    // Deduped through the audit log rather than a new column: this fires at
    // most once per track and the audit log is already the record of what the
    // platform did to a piece of media.
    const alreadySent = await db.auditLog.findFirst({
      where: { action: NOTICE_ACTION, entityType: 'ArtistMediaAsset', entityId: report.targetId },
      select: { id: true },
    });
    if (alreadySent) continue;

    const asset = await db.artistMediaAsset.findUnique({
      where: { hexId: report.targetId },
      select: {
        title: true,
        isPublished: true,
        profile: { select: { name: true, slug: true, owner: { select: { email: true } } } },
      },
    });

    // Gone, or cleared and published while this ran — either way there is
    // nothing to apologise for.
    if (!asset || asset.isPublished) continue;

    const email = asset.profile?.owner?.email;
    if (!email) continue;

    const days = Math.floor((Date.now() - report.createdAt.getTime()) / 864e5);
    const sent = await sendOperationalEmail(
      {
        to: email,
        subject: `[iHYPE] "${asset.title}" is still being reviewed`,
        text: `Your upload "${asset.title}" has been waiting on a human review for ${days} days, which is longer than it should be.

Our automated scan flagged it, so it is stored but not showing on your page yet. That is our backlog, not a decision about your track — nothing has been rejected and nothing has been deleted.

We are looking at it. If you think it was flagged in error, reply to this email or write to admin@ihype.org and say so.

${getBaseUrl()}/artists/${asset.profile?.slug ?? ''}`,
        html: `<p>Your upload <strong>${asset.title}</strong> has been waiting on a human review for ${days} days, which is longer than it should be.</p>
<p>Our automated scan flagged it, so it is stored but not showing on your page yet. That is our backlog, not a decision about your track — nothing has been rejected and nothing has been deleted.</p>
<p>We are looking at it. If you think it was flagged in error, reply to this email or write to <a href="mailto:admin@ihype.org">admin@ihype.org</a> and say so.</p>`,
      },
      'held-track-notice',
    );

    if (!sent) continue;

    // Only recorded once the send actually succeeded, so a failed delivery
    // retries tomorrow instead of being marked done and never sent.
    await recordAuditEvent({
      actorUserId: null,
      action: NOTICE_ACTION,
      entityType: 'ArtistMediaAsset',
      entityId: report.targetId,
      metadata: { heldDays: days, reportId: report.id },
    }).catch((error: unknown) => {
      // If this throws, tomorrow's run sends a duplicate. Annoying, not
      // harmful — and far better than silently swallowing it.
      log.error(
        '[held-track-notice]',
        error instanceof Error ? error : { error: String(error) },
        'could not record notice; a duplicate may send tomorrow',
      );
    });

    notified += 1;
  }

  return { ok: true, checked: stale.length, notified };
}
