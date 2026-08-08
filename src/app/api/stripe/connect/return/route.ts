import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { getProfilePathForType } from '@/lib/profile-paths';
import { log } from '@/lib/logger';

/**
 * GET /api/stripe/connect/return?profileId=<cuid>
 *
 * Stripe redirects here after Connect Express onboarding completes.
 * We check the account's charges_enabled status and mark the profile
 * as onboarded if Stripe has approved it.
 */
export async function GET(request: NextRequest) {
  let fallback = '/app/map';
  try {
    const profileId = request.nextUrl.searchParams.get('profileId');

    if (!profileId || !isStripeConfigured()) {
      redirect(fallback);
    }

    const profile = await db.profile.findUnique({
      where: { id: profileId },
      select: { id: true, stripeConnectAccountId: true, slug: true, type: true }
    });

    if (profile) fallback = getProfilePathForType(profile.type, profile.slug);

    if (profile?.stripeConnectAccountId) {
      const stripe = getStripe();
      const account = await stripe.accounts.retrieve(profile.stripeConnectAccountId);

      if (account.charges_enabled) {
        await db.profile.update({
          where: { id: profile.id },
          data: { stripeConnectOnboarded: true }
        });
      }
    }

    redirect(`${fallback}?payout=connected`);
  } catch (err) {
    // Re-throw redirect errors (Next.js redirect() throws internally)
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
    log.error('[api/stripe/connect/return]', err instanceof Error ? err : { error: String(err) }, 'error');
    redirect(fallback);
  }
}
