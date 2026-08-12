import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE } from '@/lib/referral-attribution';

export const dynamic = 'force-dynamic';

/**
 * Short HYPE Link — `https://ihype.org/h/{code}`, where `{code}` is a member's
 * hexId. Following one is how a promoter earns from the 10% pool.
 *
 * ## What this used to do, and why it lost people money
 *
 * It recorded the click and sent EVERYONE to `/register?ref=`, including
 * members who were already signed in — who then landed on a signup page for an
 * account they already had. And the code went no further than that page: ticket
 * attribution is read at the moment of purchase, so by the time someone had
 * signed up, been redirected, and found the show, there was no `ref` anywhere
 * and the promoter got nothing for the sale they created.
 *
 * ## What it does now
 *
 * The code goes into a cookie first, so it survives signup and any amount of
 * browsing before the purchase. Then:
 *
 *   - **signed out** → `/register?ref=<code>`, because you have to have an
 *     account to hold a ticket, and asking for it here is honest about that.
 *     The query parameter is kept as well as the cookie: registration uses it
 *     for referral attribution on the ACCOUNT, which is a separate credit from
 *     the ticket.
 *   - **signed in** → straight into the app. No signup wall for someone who is
 *     already a member; the cookie carries their friend's credit to whatever
 *     they buy.
 */
export default async function HypeLinkPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const ref = code.trim().slice(0, 80);
  const session = await auth();

  if (ref) {
    await recordAuditEvent({
      action: 'referral_click',
      entityType: 'referral',
      entityId: ref,
    }).catch(() => {});

    const store = await cookies();
    store.set(REFERRAL_COOKIE, ref, {
      maxAge: REFERRAL_COOKIE_MAX_AGE,
      // Server-read only: nothing in the browser needs it, and keeping it out
      // of document.cookie keeps it out of anything that scrapes the page.
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }

  if (!session?.user?.id) redirect(`/register?ref=${encodeURIComponent(ref)}`);
  redirect('/app/map');
}
