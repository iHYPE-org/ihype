import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildUnsubscribeUrl, sendGenericEmail } from '@/lib/mailer';
import { newsletterUnsubscribeUrl } from '@/lib/newsletter-unsubscribe';
import { escapeHtml } from '@/lib/html-escape';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { slug } = await params;

  // Verify profile ownership
  const profile = await db.profile.findUnique({
    where: { id: slug, ownerId: session.user.id },
    select: { id: true, name: true, fanMailLastSentAt: true },
  });
  if (!profile) return NextResponse.json({ error: 'Profile not found or not yours.' }, { status: 403 });

  // Rate limit: 1 per 7 days
  if (profile.fanMailLastSentAt) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (profile.fanMailLastSentAt > sevenDaysAgo) {
      const nextAllowed = new Date(profile.fanMailLastSentAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      return NextResponse.json({ error: `You can send fan mail again after ${nextAllowed.toLocaleDateString()}.` }, { status: 429 });
    }
  }

  let body: { subject?: unknown; content?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const subject = typeof body.subject === 'string' ? body.subject.slice(0, 100).trim() : '';
  const content = typeof body.content === 'string' ? body.content.slice(0, 2000).trim() : '';
  if (!subject || !content) {
    return NextResponse.json({ error: 'subject and content are required.' }, { status: 400 });
  }

  /* Two ways to be on this list, and both are an explicit opt-in.
     
     A FOLLOWER with `notifyShows` ticked has an account and said yes inside the
     app. A NEWSLETTER SUBSCRIBER came in from a public page, has no account,
     and completed a double opt-in — the row only counts once `confirmedAt` is
     set by the emailed link, so an address nobody confirmed is never written
     to. Until now only the first group was read: `NewsletterSubscription` was
     collected, confirmed, and sent NOTHING, ever, by anything. A confirmation
     email that leads to no email is a promise the product was not keeping. */
  const [follows, subscribers] = await Promise.all([
    db.follow.findMany({
      where: { followeeProfileId: slug, notifyShows: true },
      include: { follower: { select: { id: true, email: true, emailBounced: true, notificationPreference: { select: { newShows: true, journalPosts: true, milestones: true, weeklyDigest: true } } } } },
    }),
    db.newsletterSubscription.findMany({
      where: { profileId: slug, confirmedAt: { not: null } },
      select: { id: true, email: true },
    }),
  ]);

  type Recipient = { email: string; because: 'follow' | 'newsletter'; unsubscribeUrl: string };
  const byAddress = new Map<string, Recipient>();
  for (const follow of follows) {
    const email = follow.follower.email;
    if (!email || follow.follower.emailBounced) continue;
    /* THE ONE-CLICK UNSUBSCRIBE WAS NOT HONOURED HERE (2026-09-10). This
       route reaches an artist's whole audience through `sendGenericEmail`,
       which sends whatever it is given; the preference check lives in
       `sendMarketingEmail`, which this never called. So a member who pressed
       Unsubscribe in Gmail — the RFC 8058 link, which turns all four toggles
       off and answers "you will no longer receive marketing email from
       iHYPE" — kept receiving artist broadcasts. The same rule as
       `sendMarketingEmail`: all four off means out. */
    const prefs = follow.follower.notificationPreference;
    if (prefs && !prefs.newShows && !prefs.journalPosts && !prefs.milestones && !prefs.weeklyDigest) continue;
    byAddress.set(email.toLowerCase(), { email, because: 'follow', unsubscribeUrl: buildUnsubscribeUrl(follow.follower.id) });
  }
  for (const subscriber of subscribers) {
    // Keyed by address so someone who both follows and subscribed gets ONE
    // email, and the follower wording wins because it is the closer relationship.
    const key = subscriber.email.toLowerCase();
    if (byAddress.has(key)) continue;
    byAddress.set(key, { email: subscriber.email, because: 'newsletter', unsubscribeUrl: newsletterUnsubscribeUrl(subscriber.id) });
  }

  let sent = 0;
  for (const recipient of byAddress.values()) {
    // The reason line has to match how they actually got here, or the
    // unsubscribe instruction points at a control they do not have.
    const because = recipient.because === 'follow'
      ? `You received this because you follow ${escapeHtml(profile.name)} on iHYPE.`
      : `You received this because you confirmed email updates from ${escapeHtml(profile.name)} on iHYPE.`;
    try {
      await sendGenericEmail({
        to: recipient.email,
        subject: `${profile.name}: ${subject}`,
        text: `${content}\n\n—\n${recipient.because === 'follow' ? `You follow ${profile.name} on iHYPE.` : `You confirmed email updates from ${profile.name}.`}\nUnsubscribe: ${recipient.unsubscribeUrl}`,
        html: `<p style="white-space:pre-wrap">${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p><hr><p><small>${because} <a href="${recipient.unsubscribeUrl}">Unsubscribe</a></small></p>`,
        /* Every recipient can now leave from inside the message, which is
           what the header promises mail clients — and for a newsletter
           subscriber it is the ONLY control that exists. */
        headers: {
          'List-Unsubscribe': `<${recipient.unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
        deliveryType: 'fan-mail',
      });
      sent++;
    } catch { /* continue */ }
  }

  await db.profile.update({
    where: { id: slug },
    data: { fanMailLastSentAt: new Date() },
  });

  /* Both numbers. `sent` counts deliveries the provider accepted; `recipients`
     is how many the list resolved to. They differ whenever mail is degraded —
     and reporting only `sent` made that indistinguishable from an empty list,
     which is exactly what an owner needs to tell apart after pressing send. */
  return NextResponse.json({ ok: true, sent, recipients: byAddress.size });
}
