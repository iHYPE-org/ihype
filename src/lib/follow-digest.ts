import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ihype.org';

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

  // New journal posts in last 24h
  const newJournalPosts = await db.artistJournalPost.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, title: true, profile: { select: { id: true, name: true, slug: true } } },
    take: 50
  });

  // Group by profile
  const profileUpdates = new Map<string, { name: string; slug: string; shows: string[]; posts: string[] }>();
  for (const s of newShows) {
    if (!s.headlinerProfile) continue;
    const p = profileUpdates.get(s.headlinerProfile.id) ?? { name: s.headlinerProfile.name, slug: s.headlinerProfile.slug, shows: [], posts: [] };
    p.shows.push(`<a href="${BASE}/shows/${escHtml(s.slug)}">${escHtml(s.title)}</a>`);
    profileUpdates.set(s.headlinerProfile.id, p);
  }
  for (const j of newJournalPosts) {
    const p = profileUpdates.get(j.profile.id) ?? { name: j.profile.name, slug: j.profile.slug, shows: [], posts: [] };
    p.posts.push(`<a href="${BASE}/artists/${escHtml(j.profile.slug)}/journal/${j.id}">${escHtml(j.title)}</a>`);
    profileUpdates.set(j.profile.id, p);
  }

  if (profileUpdates.size === 0) return { sent: 0 };

  let sent = 0;
  for (const [profileId, update] of profileUpdates) {
    const followers = await db.follow.findMany({
      where: { followeeProfileId: profileId },
      select: { follower: { select: { email: true } } }
    });
    const lines = [...update.shows.map(s => `New show: ${s}`), ...update.posts.map(p => `New post: ${p}`)].join('<br/>');
    for (const f of followers) {
      if (!f.follower.email) continue;
      try {
        await sendGenericEmail({ to: f.follower.email, subject: `${update.name} has new activity on iHYPE`, html: `<p><strong><a href="${BASE}/artists/${escHtml(update.slug)}">${escHtml(update.name)}</a></strong> posted:</p><p>${lines}</p>`, text: lines.replace(/<[^>]+>/g, '') });
        sent++;
      } catch { /* continue */ }
    }
  }
  return { sent };
}
