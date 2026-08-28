import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { getProfilePathForType } from '@/lib/profile-paths';
import {
  createConnectOnboardingUrl,
  createStripeConnectAccount,
  isStripeConfigured
} from '@/lib/stripe';

const schema = z.object({
  /* NOT `.cuid()`, and that changed after it broke in production (Sentry
     JAVASCRIPT-NEXTJS-E, 2026-08-28). The schema defaults new ids to cuid,
     but rows seeded outside Prisma's default carry other shapes, and the
     admin's own preview profiles failed the pattern — so the Connect button
     answered "Invalid request." for exactly the person testing it. Id shape
     is not a security boundary here: the findUnique below misses unknown ids
     and the ownership check is what actually gates the action. Validate that
     it is a sane opaque id, no more. */
  profileId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/)
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
      name: true,
      slug: true,
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
      profileType: profile.type,
      profileName: profile.name,
      /* The member's public page doubles as their merchant business URL —
         one of the prefills that keeps merchant onboarding down to what a
         bare payee would owe anyway. */
      profileUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://ihype.org'}${getProfilePathForType(profile.type, profile.slug)}`,
    });

    await db.profile.update({
      where: { id: profile.id },
      data: { stripeConnectAccountId: connectAccountId }
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const onboardingUrl = await createConnectOnboardingUrl({
    connectAccountId,
    /* A venue is the MERCHANT on its own shows — the ticket charge is created
       on its account — so its onboarding has to collect the `merchant`
       requirements too. Naming the wrong set here is silent: the member
       completes a flow that looks finished and `card_payments` never
       activates, so every sale quietly falls back to platform settlement and
       iHYPE carries disputes it thought the venue had taken. */
    merchantOnboarding: profile.type === 'VENUE',
    returnUrl: `${appUrl}/api/stripe/connect/return?profileId=${profile.id}`,
    refreshUrl: `${appUrl}/api/stripe/connect/refresh?profileId=${profile.id}`
  });

  return NextResponse.json({ onboardingUrl });
}
