import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';

type ProfileStub = { id: string; name: string; owner: { email: string | null; name: string | null } | null };

async function sendDigestForProfile(profile: ProfileStub): Promise<void> {
  if (!profile.owner?.email) return;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [playCount, hypeCount, followerCount] = await Promise.all([
    db.mediaListen.count({
      where: { artistProfileSlug: { not: null }, createdAt: { gte: sevenDaysAgo } }
    }),
    db.profileHypeEvent.count({
      where: { profileId: profile.id, createdAt: { gte: sevenDaysAgo } }
    }),
    db.follow.count({ where: { followeeProfileId: profile.id } })
  ]);

  const subject = `Your iHYPE weekly digest — ${profile.name}`;
  const text = [
    `Hi ${profile.owner.name ?? profile.name},`,
    '',
    `Here's your iHYPE artist digest for the past 7 days:`,
    '',
    `  - Plays: ${playCount}`,
    `  - New hypes: ${hypeCount}`,
    `  - Total followers: ${followerCount}`,
    '',
    `Keep it up — see you on stage.`,
    '',
    `The iHYPE team`
  ].join('\n');

  await sendGenericEmail({ to: profile.owner.email, subject, text, html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${text}</pre>` });
}

// Legacy single-profile entry point (used by direct API calls)
export async function sendArtistWeeklyDigest(profileId: string): Promise<void> {
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, name: true, owner: { select: { email: true, name: true } } }
  });
  if (!profile) return;
  await sendDigestForProfile(profile);
}

// Batch entry point used by the cron job — avoids N+1 profile lookups
export async function sendArtistWeeklyDigestBatch(profiles: ProfileStub[]): Promise<{ sent: number }> {
  let sent = 0;
  for (const profile of profiles) {
    try {
      await sendDigestForProfile(profile);
      sent++;
    } catch {
      // continue to next profile
    }
  }
  return { sent };
}
