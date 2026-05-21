import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/utils';

const BASE_URL = getBaseUrl();

export async function sendArtistOnboardingNudges(): Promise<{ sent: number }> {
  const since7 = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  const since7end = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Artists with no shows after 7 days
  const noShowArtists = await db.profile.findMany({
    where: {
      type: { in: ['ARTIST', 'DJ'] },
      createdAt: { gte: since7, lt: since7end },
      headlinerShows: { none: {} },
      owner: { email: { not: null } }
    },
    select: { name: true, slug: true, owner: { select: { email: true } } },
    take: 50
  });

  let sent = 0;
  for (const p of noShowArtists) {
    if (!p.owner.email) continue;
    try {
      await sendGenericEmail({
        to: p.owner.email,
        subject: `${p.name} — add your first show on iHYPE`,
        html: `<p>Hi ${p.name},</p><p>Your iHYPE profile is live! Add your upcoming shows so fans can discover and RSVP.</p><p><a href="${BASE_URL}/workbench">Add a show →</a></p>`,
        text: `Add your first show: ${BASE_URL}/workbench`
      });
      sent++;
    } catch { /* continue */ }
  }

  return { sent };
}
