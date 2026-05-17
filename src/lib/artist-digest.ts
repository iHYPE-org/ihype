import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';

export async function sendArtistWeeklyDigest(profileId: string): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      name: true,
      owner: { select: { email: true, name: true } }
    }
  });

  if (!profile?.owner?.email) return;

  const [playCount, hypeCount, followerCount] = await Promise.all([
    db.mediaListen.count({
      where: {
        artistProfileSlug: { not: null },
        createdAt: { gte: sevenDaysAgo }
      }
    }),
    db.profileHypeEvent.count({
      where: { profileId, createdAt: { gte: sevenDaysAgo } }
    }),
    db.follow.count({ where: { followeeProfileId: profileId } })
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
