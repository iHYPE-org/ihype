import { db } from '@/lib/db';
import { settleAdCampaign, isStripeConfigured } from '@/lib/stripe';
import {
  pausedLongEnoughToSettle,
  PAUSED_CAMPAIGN_SETTLE_AFTER_DAYS,
  REFUND_WINDOW_BUSINESS_DAYS,
  settlementFigures,
  type AdSettlementPlan,
} from '@/lib/ad-settlement-plan';
import { notifyAdvertiser } from '@/lib/ad-campaign-notify';
import { log } from '@/lib/logger';
import { deferWork } from '@/lib/defer-work';

/**
 * Settlement for campaigns CHARGED UP FRONT (2026-09-02; see
 * `ad-settlement-plan.ts` for why the pre-auth model was replaced). The whole
 * budget was captured at checkout; this refunds `budget - spent` once the
 * purchased run (`endsAt`) has passed, and tells the advertiser what came
 * back. A hold opened before the change is still closed correctly — the plan
 * captures or releases it. Idempotent through the `settledAt` guard, same
 * pattern as `triggerShowPayouts`.
 *
 * It also settles campaigns PAUSED for more than
 * `PAUSED_CAMPAIGN_SETTLE_AFTER_DAYS`: with the money already in hand, an
 * unbounded pause was the advertiser's budget sitting on iHYPE's balance with
 * no end date. Those are closed as cancelled and refunded the same way.
 */
export async function settleEndedAdCampaigns(): Promise<{ settled: number; skipped: number }> {
  if (!isStripeConfigured()) return { settled: 0, skipped: 0 };

  const now = new Date();
  const select = {
    id: true, title: true, status: true, spentCents: true, budgetCents: true, stripePaymentIntentId: true,
    pausedAt: true, advertiserId: true, advertiser: { select: { email: true } },
  } as const;

  const [ended, paused] = await Promise.all([
    db.ad.findMany({
      where: { status: 'APPROVED', settledAt: null, stripePaymentIntentId: { not: null }, endsAt: { lte: now } },
      select,
      take: 200,
    }),
    db.ad.findMany({
      where: {
        status: 'PAUSED',
        settledAt: null,
        stripePaymentIntentId: { not: null },
        pausedAt: { lte: new Date(now.getTime() - PAUSED_CAMPAIGN_SETTLE_AFTER_DAYS * 24 * 60 * 60 * 1000) },
      },
      select,
      take: 200,
    }),
  ]);

  let settled = 0;
  let skipped = 0;

  for (const ad of [...ended, ...paused.filter((row) => pausedLongEnoughToSettle(row.pausedAt, now))]) {
    try {
      const { plan, refundId } = await settleAdCampaign(ad.stripePaymentIntentId!, ad.spentCents, ad.budgetCents);
      const wasPaused = ad.status === 'PAUSED';
      await db.ad.update({
        where: { id: ad.id },
        data: {
          settledAt: now,
          ...settlementRecord(plan, refundId),
          ...(wasPaused ? { status: 'CANCELLED', pausedAt: null } : {}),
        },
      });
      deferWork(notifyAdvertiser(
        ad.advertiserId,
        ad.advertiser.email,
        ad.title,
        'SETTLED',
        describeSettlement(plan, wasPaused, refundId),
      ), 'ad-settlement-notification');
      settled += 1;
    } catch (error) {
      log.error('[ad-settlement]', error instanceof Error ? error : null, `Settlement failed for ad ${ad.id}`);
      skipped += 1;
    }
  }

  return { settled, skipped };
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * The columns settlement writes so the dashboard can show the advertiser what
 * happened to their money — one place, used by the cron and by cancellation.
 */
export function settlementRecord(plan: AdSettlementPlan, refundId: string | null) {
  const figures = settlementFigures(plan);
  return {
    settledChargedCents: figures.chargedCents,
    refundedCents: figures.refundedCents,
    stripeRefundId: refundId,
  };
}

/** The refund's timing and its reference, appended to every sentence that says one was issued. */
function refundTrail(refundId: string | null): string {
  const timing = ` It goes back to the card you paid with and usually appears on your statement within ${REFUND_WINDOW_BUSINESS_DAYS} business days.`;
  return refundId ? `${timing} Refund reference: ${refundId}.` : timing;
}

/**
 * The sentence the advertiser reads has to match what Stripe did. Four plans,
 * four sentences — "refunded" and "charged" are not interchangeable, and the
 * old copy said "the rest of your authorized budget was released" for a model
 * that no longer exists. A refund also says WHEN and carries its Stripe
 * reference, because "refunded" with no date and no number is a claim the
 * advertiser cannot check against their statement.
 */
export function describeSettlement(plan: AdSettlementPlan, wasPaused: boolean, refundId: string | null = null): string {
  const lead = wasPaused
    ? `This campaign had been paused for ${PAUSED_CAMPAIGN_SETTLE_AFTER_DAYS} days, so it has been closed. `
    : '';
  switch (plan.action) {
    case 'refund':
      return plan.chargedCents > 0
        ? `${lead}You were charged ${dollars(plan.chargedCents)} for the spend actually delivered; the unspent ${dollars(plan.amountCents)} has been refunded.${refundTrail(refundId)}`
        : `${lead}This campaign delivered less than the ${dollars(50)} minimum a card can be charged, so the full ${dollars(plan.amountCents)} has been refunded.${refundTrail(refundId)}`;
    case 'none':
      return plan.chargedCents > 0
        ? `${lead}Your full budget of ${dollars(plan.chargedCents)} was delivered, so there is nothing to refund.`
        : `${lead}No charge was outstanding on this campaign.`;
    case 'capture':
      return `${lead}Charged ${dollars(plan.amountCents)} for actual delivered spend — the rest of your authorized budget was released.`;
    case 'release':
      return `${lead}This campaign delivered less than the ${dollars(50)} minimum a card can be charged, so you were not charged and the authorization has been released in full.`;
  }
}
