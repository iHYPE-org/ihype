import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createConnectOnboardingUrl, isStripeConfigured } from '@/lib/stripe';

const SETTINGS_URL = '/home?view=settings';

/**
 * GET /api/stripe/connect/refresh?profileId=<id>
 *
 * Stripe redirects here when an account-link session expires mid-onboarding.
 * Generates a fresh account link and redirects the user back into onboarding.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const profileId = searchParams.get('profileId');
  const fallback = NextResponse.redirect(new URL(SETTINGS_URL, origin));

  if (!isStripeConfigured() || !profileId) return fallback;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login', origin));
  }

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      stripeConnectAccountId: true,
      owner: { select: { id: true } },
    },
  });

  if (
    !profile?.stripeConnectAccountId ||
    (profile.owner.id !== session.user.id && session.user.role !== 'ADMIN')
  ) {
    return fallback;
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin;
    const onboardingUrl = await createConnectOnboardingUrl({
      connectAccountId: profile.stripeConnectAccountId,
      returnUrl: `${appUrl}/api/stripe/connect/return?profileId=${profile.id}`,
      refreshUrl: `${appUrl}/api/stripe/connect/refresh?profileId=${profile.id}`,
    });
    return NextResponse.redirect(onboardingUrl);
  } catch {
    return fallback;
  }
}
