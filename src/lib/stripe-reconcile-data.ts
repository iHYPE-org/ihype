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
  type ReconcilePayable,
  type ReconcileSummary,
  type ReconcileTransfer,
  type ReconcileTransferCoverage,
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
const MAX_TRANSFERS = 2000;
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

function toTransfer(transfer: Stripe.Transfer): ReconcileTransfer {
  const metadata = transfer.metadata ?? {};
  return {
    id: transfer.id,
    amount: transfer.amount,
    amountReversed: transfer.amount_reversed ?? 0,
    created: new Date(transfer.created * 1000),
    /* `destination` expands to an Account object when asked for; we never ask,
       so it is the id string. Narrowed rather than cast, because an expanded
       object silently stringifying to "[object Object]" is the kind of thing
       that reads fine in a finding and names nothing. */
    destination: typeof transfer.destination === 'string' ? transfer.destination : transfer.destination?.id ?? null,
    metadata: {
      payableEntryId: typeof metadata.payableEntryId === 'string' ? metadata.payableEntryId : undefined,
      showId: typeof metadata.showId === 'string' ? metadata.showId : undefined,
    },
  };
}

/**
 * Every payout transfer, platform-scoped.
 *
 * ONE LIST, NOT ONE PER ACCOUNT, unlike the intents above: `createPayoutTransfer`
 * passes no `stripeAccount`, so a payout is always created on the platform and
 * only its `destination` names the venue or the act. Listing per connected
 * account here would find nothing and read as a clean comparison.
 */
async function listTransfers(stripe: Stripe, sinceSeconds: number): Promise<{ transfers: ReconcileTransfer[]; truncated: boolean }> {
  const out: ReconcileTransfer[] = [];
  let truncated = false;
  for await (const transfer of stripe.transfers.list({ created: { gte: sinceSeconds }, limit: 100 })) {
    out.push(toTransfer(transfer));
    if (out.length >= MAX_TRANSFERS) { truncated = true; break; }
  }
  return { transfers: out, truncated };
}

export async function runStripeReconciliation(now = new Date()): Promise<ReconcileSummary | { skipped: string }> {
  if (!isStripeConfigured()) return { skipped: 'Stripe is not configured' };
  const since = new Date(now.getTime() - RECONCILE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const payableSelect = {
    id: true,
    status: true,
    stripeTransferId: true,
    amountCents: true,
    payeeLabel: true,
    paidAt: true,
    updatedAt: true,
  } as const;

  const [orders, ads, windowPayables] = await Promise.all([
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
    db.accountsPayableEntry.findMany({ where: { updatedAt: { gte: since } }, select: payableSelect }),
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

  /* The outbound list, independently caught like each account's above: a
     transfer read that fails must cost the run its payable comparison and
     nothing else. */
  let transfers: ReconcileTransfer[] = [];
  const transferCoverage: ReconcileTransferCoverage = { truncated: false, failed: false };
  try {
    const listed = await listTransfers(stripe, sinceSeconds);
    transfers = listed.transfers;
    transferCoverage.truncated = listed.truncated;
  } catch (error) {
    log.error('[stripe-reconcile]', error instanceof Error ? error : { error: String(error) }, 'could not list transfers');
    transferCoverage.failed = true;
  }

  /* THE SECOND PAYABLE QUERY IS WHAT MAKES THE COMPARISON HONEST, and the
     comparison cannot check that it happened — `ReconcileInput.payables` says
     so. A transfer whose RELEASED write failed belongs to a row whose
     `updatedAt` never moved, so it can sit weeks outside the window its own
     transfer is inside; on the window query alone the single case this whole
     comparison exists to catch would report as "money left the platform
     balance and nothing here accounts for it", about a payable sitting in the
     table. Fetched by id, so the extra read is bounded by what Stripe listed. */
  const seen = new Set(windowPayables.map((entry) => entry.id));
  const namedByTransfer = [
    ...new Set(
      transfers
        .map((transfer) => transfer.metadata.payableEntryId)
        .filter((id): id is string => Boolean(id) && !seen.has(id as string)),
    ),
  ];
  const extraPayables = namedByTransfer.length
    ? await db.accountsPayableEntry
        .findMany({ where: { id: { in: namedByTransfer } }, select: payableSelect })
        .catch((error: unknown) => {
          /* Not caught to [] and carried on: an empty answer here reads as
             "these payables do not exist", which is the money finding. Rethrow
             so the run fails loudly rather than reporting invented drift. */
          log.error('[stripe-reconcile]', error instanceof Error ? error : { error: String(error) }, 'could not read the payables named by listed transfers');
          throw error;
        })
    : [];
  const payables: ReconcilePayable[] = [...windowPayables, ...extraPayables].map((entry) => ({
    ...entry,
    status: entry.status as ReconcilePayable['status'],
  }));

  const findings = reconcileStripe({
    orders: orders.map((o) => ({ ...o, status: o.status as 'RESERVED' | 'CAPTURED' | 'VOID' })),
    ads,
    intents,
    accounts: coverage,
    payables,
    transfers,
    transferCoverage,
    since,
    now,
  });
  const summary = summarizeReconciliation(
    findings,
    { orders: orders.length, ads: ads.length, intents: intents.length, accounts: accounts.length, payables: payables.length, transfers: transfers.length },
    since,
    now,
  );

  /* The last result, for the admin console and /api/health. Three days, so a
     board reading it after two missed nights knows the figure is old. */
  try {
    await kvPut(RECONCILE_LAST_KEY, JSON.stringify(summary), { ex: 3 * 24 * 60 * 60 });
  } catch {
    // KV unavailable: the email and the log still carry the result.
  }
  return summary;
}
