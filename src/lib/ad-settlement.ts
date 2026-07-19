import { db } from '@/lib/db';
import { settleAdCampaignAuthorization, isStripeConfigured } from '@/lib/stripe';
import { notifyAdvertiser } from '@/lib/ad-campaign-notify';
import { log } from '@/lib/logger';

/**
 * Pre-auth-then-capture settlement (DESIGN_SYNC row 234) — the other half
 * of the billing model started in POST /api/advertise/campaigns. A
 * campaign's PaymentIntent only ever authorized the full quoted budget;
 * this is what actually captures money, and only ever for the real
 * `spentCents` delivered by the time the campaign's purchased run length
 * (endsAt) has passed — never the full hold. Idempotent via the
 * `settledAt` guard, same pattern as `triggerShowPayouts`.
 */
export async function settleEndedAdCampaigns(): Promise<{ settled: number; skipped: number }> {
  if (!isStripeConfigured()) return { settled: 0, skipped: 0 };

  const ads = await db.ad.findMany({
    where: {
      status: 'APPROVED',
      settledAt: null,
      stripePaymentIntentId: { not: null },
      endsAt: { lte: new Date() },
    },
    select: {
      id: true, title: true, spentCents: true, budgetCents: true, stripePaymentIntentId: true,
      advertiserId: true, advertiser: { select: { email: true } },
    },
    take: 200,
  });

  let settled = 0;
  let skipped = 0;

  for (const ad of ads) {
    try {
      // spentCents can drift slightly over budgetCents (the impression
      // route's check-then-increment isn't atomic against a fixed step) —
      // never capture more than what was actually authorized.
      const captureAmount = Math.min(ad.spentCents, ad.budgetCents);
      await settleAdCampaignAuthorization(ad.stripePaymentIntentId!, captureAmount);
      await db.ad.update({ where: { id: ad.id }, data: { settledAt: new Date() } });
      notifyAdvertiser(
        ad.advertiserId,
        ad.advertiser.email,
        ad.title,
        'SETTLED',
        `Charged $${(captureAmount / 100).toFixed(2)} for actual delivered spend — the rest of your authorized budget was released.`,
      );
      settled += 1;
    } catch (error) {
      log.error('[ad-settlement]', error instanceof Error ? error : null, `Settlement failed for ad ${ad.id}`);
      skipped += 1;
    }
  }

  return { settled, skipped };
}
