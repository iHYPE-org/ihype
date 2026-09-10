import type Stripe from 'stripe';
import { db } from '@/lib/db';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { kvPut } from '@/lib/kv';
import { log } from '@/lib/logger';
import {
  LIVE_AD_STATUSES,
  reconcileStripe,
  summarizeReconciliation,
  type ReconcileAccountCoverage,
  type ReconcileIntent,
  type ReconcileSummary,
} from '@/lib/stripe-reconcile';

/**
 * The reads behind `reconcileStripe()`: the database's recent orders and
 * campaigns, and every PaymentIntent Stripe created in the same window — on
 * the platform account AND on each connected account a VENUE_DIRECT order
 * settled to, because a direct charge's intent lives on the venue's account
 * and a platform-scoped list never sees it (the same fact that made the
 * cancel route unable to refund one, row 316).
 *
 * Split from the pure module for the usual reason: the comparison stays
 * loadable by the unit suite with no Stripe and no database.
 *
 * The window is a week. Longer buys nothing — a disagreement a week old has
 * already been reported six times — and each night's list is bounded: intents
 * are paged 100 at a time, capped, so a busy account cannot turn the cron into
 * an unbounded walk of its history.
 */

export const RECONCILE_WINDOW_DAYS = 7;
const MAX_INTENTS_PER_ACCOUNT = 2000;
export const RECONCILE_LAST_KEY = 'stripe-reconcile:last';

function toIntent(pi: Stripe.PaymentIntent, account: string | null): ReconcileIntent {
  const metadata = pi.metadata ?? {};
  return {
    id: pi.id,
    status: pi.status,
    amount: pi.amount,
    amountReceived: pi.amount_received ?? 0,
    created: new Date(pi.created * 1000),
    account,
    metadata: {
      confirmationCode: typeof metadata.confirmationCode === 'string' ? metadata.confirmationCode : undefined,
      adId: typeof metadata.adId === 'string' ? metadata.adId : undefined,
    },
  };
}

async function listIntents(
  stripe: Stripe,
  sinceSeconds: number,
  account: string | null,
): Promise<{ intents: ReconcileIntent[]; truncated: boolean }> {
  const out: ReconcileIntent[] = [];
  const params: Stripe.PaymentIntentListParams = { created: { gte: sinceSeconds }, limit: 100 };
  const options: Stripe.RequestOptions = account ? { stripeAccount: account } : {};
  let truncated = false;
  for await (const pi of stripe.paymentIntents.list(params, options)) {
    out.push(toIntent(pi, account));
    /* Stripe lists newest first, so hitting the cap drops the OLDEST of the
       window — exactly the intents past the settle grace and therefore the
       ones judged. The caller must know, or an absent intent reads as a
       missing payment. */
    if (out.length >= MAX_INTENTS_PER_ACCOUNT) { truncated = true; break; }
  }
  return { intents: out, truncated };
}

export async function runStripeReconciliation(now = new Date()): Promise<ReconcileSummary | { skipped: string }> {
  if (!isStripeConfigured()) return { skipped: 'Stripe is not configured' };
  const since = new Date(now.getTime() - RECONCILE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [orders, ads] = await Promise.all([
    db.ticketOrder.findMany({
      where: { OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }] },
      select: {
        confirmationCode: true,
        status: true,
        stripePaymentIntentId: true,
        settlementAccountId: true,
        refundedAt: true,
        totalChargeCents: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.ad.findMany({
      where: { OR: [{ createdAt: { gte: since } }, { status: { in: [...LIVE_AD_STATUSES] } }] },
      select: { id: true, status: true, stripePaymentIntentId: true, budgetCents: true, createdAt: true },
    }),
  ]);

  const accounts = [...new Set(orders.map((o) => o.settlementAccountId).filter((id): id is string => Boolean(id)))];
  const stripe = getStripe();
  const sinceSeconds = Math.floor(since.getTime() / 1000);
  const intents: ReconcileIntent[] = [];
  /* Each account independently caught: a venue whose account was closed must
     not cost the platform's own comparison. What the comparison then needs to
     know is WHICH accounts it could not read, because an order whose intent
     was never listed is indistinguishable from an order whose payment never
     happened — and reporting the second when it is the first pages someone
     about missing money that is not missing. */
  const coverage: ReconcileAccountCoverage[] = [];
  for (const account of [null, ...accounts]) {
    try {
      const { intents: listed, truncated } = await listIntents(stripe, sinceSeconds, account);
      intents.push(...listed);
      coverage.push({ account, truncated, failed: false });
    } catch (error) {
      log.error('[stripe-reconcile]', error instanceof Error ? error : { error: String(error) }, `could not list PaymentIntents for ${account ?? 'the platform account'}`);
      coverage.push({ account, truncated: false, failed: true });
    }
  }

  const findings = reconcileStripe({
    orders: orders.map((o) => ({ ...o, status: o.status as 'RESERVED' | 'CAPTURED' | 'VOID' })),
    ads,
    intents,
    accounts: coverage,
    since,
    now,
  });
  const summary = summarizeReconciliation(findings, { orders: orders.length, ads: ads.length, intents: intents.length, accounts: accounts.length }, since, now);

  /* The last result, for the admin console and /api/health. Three days, so a
     board reading it after two missed nights knows the figure is old. */
  try {
    await kvPut(RECONCILE_LAST_KEY, JSON.stringify(summary), { ex: 3 * 24 * 60 * 60 });
  } catch {
    // KV unavailable: the email and the log still carry the result.
  }
  return summary;
}
