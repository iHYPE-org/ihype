import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { canManageOwnedResource } from '@/lib/permissions';
import { db } from '@/lib/db';
import { isConnectMerchantReady, isConnectPayoutReady, isStripeConfigured } from '@/lib/stripe';
import { getProfilePathForType } from '@/lib/profile-paths';
import { log } from '@/lib/logger';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';

/**
 * GET /api/stripe/connect/return?profileId=<cuid>
 *
 * Stripe redirects here after Connect Express onboarding completes.
 * We check that Stripe will accept a TRANSFER to the account and mark the profile
 * as onboarded if Stripe has approved it.
 */
export async function GET(request: NextRequest) {
  let fallback: string = WORKBENCH_PATH;
  let ready = false;
  try {
    const profileId = request.nextUrl.searchParams.get('profileId');

    if (!profileId || !isStripeConfigured()) {
      redirect(fallback);
    }

    const profile = await db.profile.findUnique({
      where: { id: profileId },
      select: { id: true, stripeConnectAccountId: true, slug: true, type: true, ownerId: true }
    });

    if (profile) fallback = getProfilePathForType(profile.type, profile.slug);

    /* Owner or admin only, like the sibling `refresh` route (security sweep,
       2026-09-02). This was unauthenticated: anyone could name a profileId,
       have the server ask Stripe about its account, and read the answer off
       the redirect — and flip `stripeConnectOnboarded` early. The member is
       signed in when Stripe sends them back here, so nothing legitimate is
       refused; a stranger just gets the profile page. */
    const session = await auth();
    const allowed = profile ? canManageOwnedResource(session, profile.ownerId) : false;

    if (allowed && profile?.stripeConnectAccountId) {
      /* Ask whether Stripe will accept a TRANSFER, not whether the account can
         take card payments. `charges_enabled` was the old test and it is the
         wrong question: iHYPE captures every ticket to its own balance and pays
         the 70/20/10 out as transfers, so a recipient never requests
         `card_payments` and reports `charges_enabled: false` however completely
         it has onboarded. The flag could therefore never become true. */
      const payoutReady = await isConnectPayoutReady(profile.stripeConnectAccountId);
      /* A VENUE has a HIGHER bar and must clear both. It was asked for the
         merchant configuration at signup because it is the merchant on its own
         shows, and `card_payments` is what makes that true. Marking it
         onboarded on the payout capability alone lights up "Verified" for an
         account that cannot take a charge — the same mistake the ticket route
         made when picking a settlement mode, in the place the venue reads. */
      const merchantReady =
        profile.type === 'VENUE'
          ? await isConnectMerchantReady(profile.stripeConnectAccountId)
          : true;
      ready = payoutReady && merchantReady;
      if (ready) {
        await db.profile.update({
          where: { id: profile.id },
          data: { stripeConnectOnboarded: true }
        });
      }
    }

    /* Stripe sends the member back here whenever they LEAVE the flow, not only
       when they finish it — abandoning halfway lands on the same return_url.
       This said "connected" unconditionally, to people who were not, and then
       dropped them on their profile page where nothing shows payout state at
       all. Someone who did not finish is sent to payout settings instead: that
       is where the status pill reads the truth and where PayoutConnectButton
       already renders its "Finish setup" state for exactly this case — an
       account that exists and is not onboarded. */
    if (!ready) redirect('/payouts?tab=settings&payout=incomplete');
    redirect(`${fallback}?payout=connected`);
  } catch (err) {
    // Re-throw redirect errors (Next.js redirect() throws internally)
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
    log.error('[api/stripe/connect/return]', err instanceof Error ? err : { error: String(err) }, 'error');
    redirect(fallback);
  }
}
