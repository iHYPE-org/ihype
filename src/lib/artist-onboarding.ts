import { db } from '@/lib/db';
import { sendMarketingEmail } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/utils';

const BASE_URL = getBaseUrl();

export async function sendArtistOnboardingNudges(): Promise<{ sent: number }> {
  const since7 = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  const since7end = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Artists with no shows after 7 days
  const noShowArtists = await db.profile.findMany({
    where: {
      type: 'ARTIST',
      createdAt: { gte: since7, lt: since7end },
      headlinerShows: { none: {} },
      owner: { email: { not: null } }
    },
    select: { name: true, slug: true, owner: { select: { id: true, email: true } } },
    take: 50
  });

  let sent = 0;
  for (const p of noShowArtists) {
    if (!p.owner.email) continue;
    try {
      /* MARKETING, NOT TRANSACTIONAL — an unsolicited batch nudge to every
         artist who has not added a show, so it belongs on the wrapper that
         carries the unsubscribe footer, the `List-Unsubscribe` header and the
         `emailBounced` check (DESIGN_SYNC row 383). `owner.id` is selected
         above for this: reaching for a field the query never asked for is the
         shape of the publish-scheduled bug in row 385. */
      await sendMarketingEmail(p.owner.id, {
        to: p.owner.email,
        subject: `${p.name} — add your first show on iHYPE`,
        html: `<p>Hi ${p.name},</p><p>Your iHYPE profile is live! Add your upcoming shows so fans can discover and RSVP.</p><p><a href="${BASE_URL}/app/me/events/new">Add a show →</a></p>`,
        text: `Add your first show: ${BASE_URL}/app/me/events/new`
      });
      sent++;
    } catch { /* continue */ }
  }

  return { sent };
}
