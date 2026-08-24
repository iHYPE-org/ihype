import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import {
  createConnectOnboardingUrl,
  createStripeConnectAccount,
  isStripeConfigured
} from '@/lib/stripe';

const schema = z.object({
  profileId: z.string().cuid()
});

/**
 * POST /api/stripe/connect/onboard
 *
 * Creates (or resumes) a Stripe Connect Express onboarding session for an
 * artist or venue profile. Returns { onboardingUrl } to redirect
 * the owner to Stripe's hosted onboarding flow.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Payments are not configured on this server.' }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    log.error('[stripe/connect/onboard]', err instanceof Error ? err : { error: String(err) });
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const profile = await db.profile.findUnique({
    where: { id: body.profileId },
    select: {
      id: true,
      type: true,
      stripeConnectAccountId: true,
      stripeConnectOnboarded: true,
      owner: {
        select: { id: true, email: true }
      }
    }
  });

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  if (profile.owner.id !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  /* Any owned profile may connect payouts (owner, 2026-08-24: "payout method
     (for promotion of shows using your HYPE link)"). The 10% promoter share
     lands on `affiliatePromoterProfileId` — a plain fan's LISTENER profile —
     and the old ARTIST/VENUE gate meant a fan whose link sold tickets had
     earnings with no account to pay them into. */

  let connectAccountId = profile.stripeConnectAccountId;

  if (!connectAccountId) {
    connectAccountId = await createStripeConnectAccount({
      email: profile.owner.email ?? '',
      profileId: profile.id,
      profileType: profile.type
    });

    await db.profile.update({
      where: { id: profile.id },
      data: { stripeConnectAccountId: connectAccountId }
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const onboardingUrl = await createConnectOnboardingUrl({
    connectAccountId,
    returnUrl: `${appUrl}/api/stripe/connect/return?profileId=${profile.id}`,
    refreshUrl: `${appUrl}/api/stripe/connect/refresh?profileId=${profile.id}`
  });

  return NextResponse.json({ onboardingUrl });
}
