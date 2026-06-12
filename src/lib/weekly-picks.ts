import { db } from '@/lib/db';
import { sendMarketingEmail } from '@/lib/mailer';
import { runAI } from '@/lib/ai';
import { getBaseUrl } from '@/lib/utils';

export async function sendWeeklyPicksEmails(): Promise<{ sent: number; skipped: number }> {
  const topProfiles = await db.profile.findMany({
    where: { type: { in: ['ARTIST', 'DJ'] } },
    select: { id: true, name: true, slug: true, bio: true, genres: true, hypeCount: true },
    orderBy: { hypeCount: 'desc' },
    take: 5
  });

  if (topProfiles.length === 0) return { sent: 0, skipped: 0 };

  const aiBlurb = await runAI([
    {
      role: 'user',
      content: `Write a short, enthusiastic 2-sentence intro for a weekly music picks email. Artists this week: ${topProfiles.map(p => p.name).join(', ')}. Keep it hype, casual, music-focused. No hashtags.`
    }
  ], 200) ?? '';

  const baseUrl = getBaseUrl();
  const picksHtml = topProfiles.map((p, i) =>
    `<p><strong>${i + 1}. <a href="${baseUrl}/artists/${p.slug}">${p.name}</a></strong> — ${(p.genres as string[] | null ?? []).join(', ')}</p>`
  ).join('');

  const users = await db.user.findMany({
    where: { notificationPreference: { weeklyDigest: true }, email: { not: null } },
    select: { id: true, email: true }
  });

  let sent = 0, skipped = 0;
  for (const user of users) {
    if (!user.email) { skipped++; continue; }
    try {
      await sendMarketingEmail(user.id, {
        to: user.email,
        subject: '🎵 iHYPE Weekly Picks',
        html: `<p>${aiBlurb}</p><h2>This week's top picks</h2>${picksHtml}<p><a href="${baseUrl}/discover">Discover more on iHYPE</a></p>`,
        text: `${aiBlurb}\n\nThis week's top picks:\n${topProfiles.map((p, i) => `${i + 1}. ${p.name} — ${baseUrl}/artists/${p.slug}`).join('\n')}`
      });
      sent++;
    } catch { skipped++; }
  }
  return { sent, skipped };
}
