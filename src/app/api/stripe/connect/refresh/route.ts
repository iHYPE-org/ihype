import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { createConnectOnboardingUrl, isStripeConfigured } from '@/lib/stripe';
import { getProfilePathForType } from '@/lib/profile-paths';

/**
 * GET /api/stripe/connect/refresh?profileId=<id>
 *
 * Stripe redirects here when an account-link session expires mid-onboarding.
 * Generates a fresh account link and redirects the user back into onboarding.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const profileId = searchParams.get('profileId');
  const fallback = NextResponse.redirect(new URL(WORKBENCH_PATH, origin));

  if (!isStripeConfigured() || !profileId) return fallback;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login', origin));
  }

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      slug: true,
      type: true,
      stripeConnectAccountId: true,
      owner: { select: { id: true } },
    },
  });

  if (
    !profile?.stripeConnectAccountId ||
    (profile.owner.id !== session.user.id && session.user.role !== 'ADMIN')
  ) {
    return profile
      ? NextResponse.redirect(new URL(getProfilePathForType(profile.type, profile.slug), origin))
      : fallback;
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin;
    const onboardingUrl = await createConnectOnboardingUrl({
      connectAccountId: profile.stripeConnectAccountId,
      returnUrl: `${appUrl}/api/stripe/connect/return?profileId=${profile.id}`,
      refreshUrl: `${appUrl}/api/stripe/connect/refresh?profileId=${profile.id}`,
      /* MUST MATCH THE ONBOARD ROUTE, and did not until 2026-08-28.
       *
       * This route is where Stripe sends a venue whose onboarding link expired
       * part-way through — so it is reached by exactly the people who did not
       * finish in one sitting, which is most of them. Omitting this defaulted
       * the link to `['recipient']`, and a link naming fewer configurations
       * than the account has collects only those requirements: the venue would
       * complete a flow, be told it was done, become payout-ready, and never
       * activate `card_payments`.
       *
       * Nothing would have reported that. `isConnectPayoutReady()` reads the
       * recipient capability and would say yes; the payout settings page would
       * light up "Verified"; and the ticket route, finding no merchant
       * account, would quietly settle the sale as DESTINATION instead — moving
       * the dispute liability back onto a platform with no reserve, which is
       * the single thing this whole settlement design exists to prevent.
       *
       * Derived from the profile type here rather than passed through a query
       * parameter, because the caller of this route is Stripe, not us. */
      merchantOnboarding: profile.type === 'VENUE',
    });
    return NextResponse.redirect(onboardingUrl);
  } catch {
    return fallback;
  }
}
