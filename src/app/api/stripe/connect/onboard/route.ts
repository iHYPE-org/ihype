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
     (for promotion of shows using your HYPE link)"). Until 2026-09-25 the 10%
     promoter share landed on `affiliatePromoterProfileId` — a plain fan's
     LISTENER profile — and the old ARTIST/VENUE gate meant a fan whose link
     sold tickets had earnings with no account to pay them into. The promoter
     share is gone now (a HYPE link only records the referral), but payables
     from orders sold under the old split can still be pending on a fan's
     profile, so the gate stays open. */

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

    /* A LIVE STRIPE ACCOUNT EXISTS THE INSTANT THE CALL ABOVE RETURNS, AND
       THIS WRITE IS THE ONLY THING THAT CONNECTS IT TO ANYTHING HERE.
       Unhandled, the throw became a generic 500 and the id went nowhere —
       not the database, not the response, not the error message — so the
       account was orphaned with nothing in this system naming it, and the
       member's next attempt created a second one.

       Stripe's own copy is findable: `createStripeConnectAccount` stamps
       `metadata: { profileId, profileType }`, so an operator can locate the
       orphan in the dashboard by the profile id this log names.

       WHAT THIS DELIBERATELY DOES NOT DO, both of which read as the obvious
       fix and are worse:

         - Search for an existing account by metadata before creating one.
           `stripe.v2.core.accounts.list()` filters by applied configuration
           and closed state and NOTHING ELSE — there is no metadata filter —
           so adopting an orphan means paging every connected account the
           platform has, on the first-time onboarding path, for a case that
           is rare and gets slower as the platform grows.
         - Close the account we just made. A throw from Prisma does not prove
           the write did not land (a lost response to a committed UPDATE
           throws exactly the same way), and closing is irreversible, so the
           failure mode is destroying a real member's live account to tidy up
           one that may not be orphaned at all.

       So it records and rethrows. Going on to build an onboarding link would
       be worse than failing: the member would complete a flow into an
       account `connect/return` cannot verify, because that route reads
       `stripeConnectAccountId` and it is still null. */
    try {
      await db.profile.update({
        where: { id: profile.id },
        data: { stripeConnectAccountId: connectAccountId }
      });
    } catch (err) {
      log.error(
        `[stripe/connect/onboard] ORPHANED CONNECT ACCOUNT ${connectAccountId} — created at Stripe, not stored on profile ${profile.id}. Find it by metadata.profileId and set stripeConnectAccountId by hand, or the member's next attempt creates a second account.`,
        err instanceof Error ? err : { error: String(err) },
      );
      return NextResponse.json(
        { error: 'Could not finish setting up payouts. Nothing was charged; please try again.' },
        { status: 500 },
      );
    }
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
