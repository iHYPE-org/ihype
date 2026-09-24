import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe';
import { standaloneHtmlPage } from '@/lib/standalone-html-page';

export const dynamic = 'force-dynamic';

/* One-click unsubscribe turns every email column off — `journalPosts`
   included, even though its Settings row is gone and nothing reads it. The
   member said no to all of it; the column should already agree on the day a
   journal exists again, rather than defaulting them back in. */
const OPT_OUT = {
  newShows: false,
  journalPosts: false,
  milestones: false,
  weeklyDigest: false
} as const;

// Must work logged-out: the token alone authorizes the change.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return standaloneHtmlPage('Invalid link', 'This unsubscribe link is invalid. You can manage email preferences from Settings inside iHYPE.', 400);
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    return standaloneHtmlPage('Invalid link', 'This unsubscribe link is no longer valid.', 400);
  }

  await db.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...OPT_OUT },
    update: OPT_OUT
  });

  return standaloneHtmlPage(
    "You're unsubscribed.",
    'You will no longer receive digests, announcements, or marketing email from iHYPE. You can turn individual emails back on anytime from Settings.',
    200
  );
}

// RFC 8058 one-click unsubscribe: mail clients POST to the List-Unsubscribe URL.
export async function POST(request: NextRequest) {
  return GET(request);
}
