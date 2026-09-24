import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyNewsletterUnsubscribeToken } from '@/lib/newsletter-unsubscribe';
import { standaloneHtmlPage } from '@/lib/standalone-html-page';

export const dynamic = 'force-dynamic';

/* The way out for someone with no account. `/api/email/unsubscribe` turns a
   member's toggles off; this deletes the subscription row, because a
   subscription IS the consent and there is no preferences page behind it for
   a person who never signed up. Deliberately idempotent: a second click, or
   a mail client that fetches the link, must read as success rather than
   "invalid", or the reader believes they are still subscribed. */

// Must work logged-out: the token alone authorizes the change.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  const subscriptionId = verifyNewsletterUnsubscribeToken(token);
  if (!subscriptionId) {
    return standaloneHtmlPage('Invalid link', 'This unsubscribe link is invalid or incomplete.', 400);
  }

  await db.newsletterSubscription.deleteMany({ where: { id: subscriptionId } });

  return standaloneHtmlPage(
    "You're unsubscribed.",
    'You will not receive any more updates from this profile. Nothing else about your address is kept for this list.',
    200
  );
}

// RFC 8058 one-click unsubscribe: mail clients POST to the List-Unsubscribe URL.
export async function POST(request: NextRequest) {
  return GET(request);
}
