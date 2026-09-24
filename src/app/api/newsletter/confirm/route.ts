import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { standaloneHtmlPage } from '@/lib/standalone-html-page';

export const dynamic = 'force-dynamic';

/* The page carries `Profile.name` — member-supplied text — and this route
   sits outside the CSP middleware; `standaloneHtmlPage` escapes it. Before
   2026-09-02 a name containing markup ran as script for anyone who clicked a
   real confirmation link. */

// Double opt-in confirm link. Token alone authorizes — must work logged-out.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return standaloneHtmlPage('Invalid link', 'This confirmation link is missing its token.', 400);

  const subscription = await db.newsletterSubscription.findUnique({
    where: { confirmToken: token },
    select: { id: true, confirmedAt: true, confirmTokenExpiresAt: true, profile: { select: { name: true } } },
  });

  if (!subscription) return standaloneHtmlPage('Link not found', 'This confirmation link is invalid or has already been used.', 404);

  if (subscription.confirmedAt) {
    return standaloneHtmlPage('Already confirmed', `You're already subscribed to updates from ${subscription.profile.name}.`, 200);
  }

  if (!subscription.confirmTokenExpiresAt || subscription.confirmTokenExpiresAt < new Date()) {
    return standaloneHtmlPage('Link expired', 'This confirmation link has expired. Subscribe again to get a fresh one.', 410);
  }

  await db.newsletterSubscription.update({
    where: { id: subscription.id },
    data: { confirmedAt: new Date(), confirmToken: null, confirmTokenExpiresAt: null },
  });

  return standaloneHtmlPage('Subscribed!', `You're confirmed for updates from ${subscription.profile.name}.`, 200);
}
