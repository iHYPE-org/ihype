import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/utils';

type DigestResult = { sent: boolean; reason?: string; showCount?: number };

/**
 * Send a weekly digest email to a single user listing upcoming shows
 * for artists / profiles the user has hyped.
 */
export async function sendWeeklyDigest(userId: string): Promise<DigestResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true }
  });
  if (!user || !user.email) return { sent: false, reason: 'No email on file' };

  const prefs = await db.notificationPreference.findUnique({
    where: { userId: user.id }
  }).catch(() => null);
  if (prefs && prefs.weeklyDigest === false) {
    return { sent: false, reason: 'User opted out of weekly digest' };
  }

  const hypeEvents = await db.profileHypeEvent.findMany({
    where: { userId },
    select: { profileId: true },
    take: 200
  });
  const profileIds = Array.from(new Set(hypeEvents.map((event) => event.profileId)));
  if (profileIds.length === 0) return { sent: false, reason: 'No hyped profiles' };

  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const shows = await db.show.findMany({
    where: {
      status: { not: 'CANCELED' },
      startsAt: { gte: now, lte: horizon },
      OR: [
        { headlinerProfileId: { in: profileIds } },
        { promoterProfileId: { in: profileIds } },
        { venueProfileId: { in: profileIds } }
      ]
    },
    include: {
      venueProfile: { select: { name: true, city: true } },
      headlinerProfile: { select: { name: true, slug: true } }
    },
    orderBy: { startsAt: 'asc' },
    take: 12
  });

  if (shows.length === 0) return { sent: false, reason: 'No upcoming shows in next 14 days' };

  const name = user.name?.trim() || 'there';
  const lines = shows.map((show) => {
    const dateLabel = show.startsAt.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    const venueLabel = show.venueProfile?.name
      ? ` @ ${show.venueProfile.name}${show.venueProfile.city ? `, ${show.venueProfile.city}` : ''}`
      : '';
    const headliner = show.headlinerProfile?.name ? ` — ${show.headlinerProfile.name}` : '';
    return `• ${dateLabel}: ${show.title}${headliner}${venueLabel}`;
  });

  const text = [
    `Hi ${name},`,
    '',
    'Here are upcoming shows from the artists and venues you hype on iHYPE:',
    '',
    ...lines,
    '',
    `See more at ${getBaseUrl()}/shows`,
    '',
    '— iHYPE'
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#10182a;">
      <p>Hi ${name},</p>
      <p>Here are upcoming shows from the artists and venues you hype on iHYPE:</p>
      <ul style="padding-left:18px;line-height:1.6;">
        ${shows
          .map((show) => {
            const dateLabel = show.startsAt.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            });
            const venueLabel = show.venueProfile?.name
              ? ` @ ${show.venueProfile.name}${show.venueProfile.city ? `, ${show.venueProfile.city}` : ''}`
              : '';
            const headliner = show.headlinerProfile?.name ? ` — ${show.headlinerProfile.name}` : '';
            return `<li><strong>${dateLabel}</strong>: ${show.title}${headliner}${venueLabel}</li>`;
          })
          .join('')}
      </ul>
      <p><a href="${getBaseUrl()}/shows">See more shows →</a></p>
      <p style="color:#5b657a;font-size:12px;">— iHYPE</p>
    </div>
  `;

  await sendGenericEmail({
    to: user.email,
    subject: 'Your weekly iHYPE digest',
    text,
    html
  });

  return { sent: true, showCount: shows.length };
}

/**
 * Send digests to all eligible users: users with an email + at least one
 * hype event in the last 30 days. Returns aggregate counts.
 */
export async function sendDigestsToAllEligibleUsers(): Promise<{
  attempted: number;
  sent: number;
  skipped: number;
}> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentHypes = await db.profileHypeEvent.findMany({
    where: { createdAt: { gte: cutoff } },
    select: { userId: true },
    distinct: ['userId'],
    take: 5000
  });

  let sent = 0;
  let skipped = 0;
  for (const event of recentHypes) {
    try {
      const result = await sendWeeklyDigest(event.userId);
      if (result.sent) sent += 1;
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }
  return { attempted: recentHypes.length, sent, skipped };
}
