import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { isConnectPayoutReady, isStripeConfigured } from '@/lib/stripe';
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
      /* Ask whether Stripe will accept a TRANSFER, not whether the account can
         take card payments. `charges_enabled` was the old test and it is the
         wrong question: iHYPE captures every ticket to its own balance and pays
         the 70/20/10 out as transfers, so a recipient never requests
         `card_payments` and reports `charges_enabled: false` however completely
         it has onboarded. The flag could therefore never become true. */
      const ready = await isConnectPayoutReady(profile.stripeConnectAccountId);
      if (ready) {
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
