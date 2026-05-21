import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/utils';

export async function sendNewToSceneEmail(): Promise<{ sent: number }> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newProfiles = await db.profile.findMany({
    where: { type: { in: ['ARTIST', 'DJ'] }, createdAt: { gte: since } },
    orderBy: { hypeCount: 'desc' },
    take: 5,
    select: { name: true, slug: true, genres: true, bio: true, hypeCount: true }
  });

  if (newProfiles.length === 0) return { sent: 0 };

  const baseUrl = getBaseUrl();
  const items = newProfiles.map(p =>
    `<p><strong><a href="${baseUrl}/artists/${p.slug}">${p.name}</a></strong> — ${(p.genres as string[]).slice(0, 2).join(', ')} · ${p.hypeCount} hypes<br/><small>${p.bio?.slice(0, 120) ?? ''}…</small></p>`
  ).join('');

  const users = await db.user.findMany({
    where: { notificationPreference: { weeklyDigest: true }, email: { not: null } },
    select: { email: true }
  });

  let sent = 0;
  for (const user of users) {
    if (!user.email) continue;
    try {
      await sendGenericEmail({ to: user.email, subject: 'New to the iHYPE scene this week', html: `<h2>Fresh artists on iHYPE</h2>${items}<p><a href="${baseUrl}/discover">Discover more</a></p>`, text: newProfiles.map(p => `${p.name} — ${baseUrl}/artists/${p.slug}`).join('\n') });
      sent++;
    } catch { /* continue */ }
  }
  return { sent };
}
