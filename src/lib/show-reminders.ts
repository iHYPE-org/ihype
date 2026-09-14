import { db } from '@/lib/db';
import { sendMarketingEmail } from '@/lib/mailer';
import { recordAuditEvent } from '@/lib/audit';
import { getBaseUrl } from '@/lib/utils';

export async function sendShowReminders(): Promise<{ sent: number }> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const shows = await db.show.findMany({
    where: {
      startsAt: { gte: in24h, lte: in48h },
      status: 'SCHEDULED'
    },
    select: {
      id: true,
      slug: true,
      title: true,
      startsAt: true,
      headlinerProfile: {
        select: {
          id: true,
          name: true,
          followers: {
            select: {
              follower: { select: { id: true, email: true, name: true, username: true } }
            }
          }
        }
      }
    }
  });

  // Pre-fetch all already-sent audit logs in one query
  const showIds = shows.map(s => s.id);
  const sentLogs = showIds.length
    ? await db.auditLog.findMany({
        where: { action: 'show_reminder_sent', entityType: 'show', entityId: { in: showIds } },
        select: { actorUserId: true, entityId: true }
      })
    : [];
  const sentSet = new Set(sentLogs.map(l => `${l.actorUserId}:${l.entityId}`));

  let sent = 0;

  for (const show of shows) {
    if (!show.headlinerProfile) continue;

    for (const follow of show.headlinerProfile.followers) {
      const user = follow.follower;
      if (!user.email) continue;

      if (sentSet.has(`${user.id}:${show.id}`)) continue;

      try {
        const name = user.name ?? user.username;
        const text = [
          `Hey ${name},`,
          '',
          `${show.headlinerProfile.name} is performing in "${show.title}" tomorrow.`,
          `Show starts: ${show.startsAt.toUTCString()}`,
          '',
          `View the show: ${getBaseUrl()}/shows/${show.slug}`,
          '',
          'The iHYPE team'
        ].join('\n');
        /* MARKETING, NOT TRANSACTIONAL — this goes to the headliner's
           FOLLOWERS, not to anyone holding a ticket, so it is exactly the mass
           path DESIGN_SYNC row 383 means: `sendMarketingEmail` is where the
           unsubscribe state, `emailBounced`, the footer and the
           `List-Unsubscribe` header live. Called through `sendGenericEmail`
           this reminder carried none of them, so a member who used the
           one-click link kept receiving it and a bounced address was retried
           every night. */
        await sendMarketingEmail(user.id, {
          to: user.email,
          subject: `${show.headlinerProfile.name} is playing tomorrow — don't miss it`,
          text,
          html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${text}</pre>`
        });

        await recordAuditEvent({
          actorUserId: user.id,
          action: 'show_reminder_sent',
          entityType: 'show',
          entityId: show.id,
          metadata: { profileId: show.headlinerProfile.id }
        });

        sent++;
      } catch {
        // continue
      }
    }
  }

  return { sent };
}
