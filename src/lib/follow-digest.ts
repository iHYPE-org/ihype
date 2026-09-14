import { db } from '@/lib/db';
import { sendMarketingEmail } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/utils';

const BASE = getBaseUrl();

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function sendFollowDigest(): Promise<{ sent: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // New shows announced in last 24h
  const newShows = await db.show.findMany({
    where: { createdAt: { gte: since }, status: 'SCHEDULED' },
    select: { title: true, slug: true, startsAt: true, headlinerProfile: { select: { id: true, name: true, slug: true } } },
    take: 50
  });

  // Group by profile
  const profileUpdates = new Map<string, { name: string; slug: string; shows: string[] }>();
  for (const s of newShows) {
    if (!s.headlinerProfile) continue;
    const p = profileUpdates.get(s.headlinerProfile.id) ?? { name: s.headlinerProfile.name, slug: s.headlinerProfile.slug, shows: [] };
    p.shows.push(`<a href="${BASE}/shows/${escHtml(s.slug)}">${escHtml(s.title)}</a>`);
    profileUpdates.set(s.headlinerProfile.id, p);
  }
  if (profileUpdates.size === 0) return { sent: 0 };

  const allFollows = await db.follow.findMany({
    where: { followeeProfileId: { in: [...profileUpdates.keys()] }, notifyShows: true },
    select: {
      followeeProfileId: true,
      follower: {
        select: {
          id: true,
          email: true,
          notificationPreference: { select: { newShows: true } }
        }
      }
    }
  });
  const followersByProfile = new Map<string, typeof allFollows>();
  for (const f of allFollows) {
    const list = followersByProfile.get(f.followeeProfileId) ?? [];
    list.push(f);
    followersByProfile.set(f.followeeProfileId, list);
  }

  let sent = 0;
  for (const [profileId, update] of profileUpdates) {
    const followers = followersByProfile.get(profileId) ?? [];
    for (const f of followers) {
      if (!f.follower.email) continue;
      // Respect per-category email preferences before sending.
      const prefs = f.follower.notificationPreference;
      /* The digest used to carry a second section, "New post: …", read from
         `ArtistJournalPost` — a table whose only writer (`/api/journal`) was
         deleted on 2026-09-05 with nothing ever having called it, so the
         section was empty by construction and the model went with it
         (2026-09-14). */
      const showLines = prefs?.newShows === false ? [] : update.shows.map(s => `New show: ${s}`);
      if (showLines.length === 0) continue;
      // Titles are user-generated: escape them for the HTML body and use the
      // raw strings for the plaintext body (never regex-strip tags from HTML).
      const allLines = showLines;
      const htmlLines = allLines.map(escHtml).join('<br/>');
      try {
        const result = await sendMarketingEmail(f.follower.id, { to: f.follower.email, subject: `${update.name} has new activity on iHYPE`, html: `<p><strong><a href="${BASE}/artists/${escHtml(update.slug)}">${escHtml(update.name)}</a></strong> posted:</p><p>${htmlLines}</p>`, text: allLines.join('\n') });
        if (!result.skipped) sent++;
      } catch { /* continue */ }
    }
  }
  return { sent };
}
