/**
 * Stripe and the database can disagree, and nothing used to say so.
 *
 * Every write path is guarded — the webhook checks account and amount before
 * it finalises an order, the settlement plan is pure and tested, the payout is
 * idempotent — but every one of them handles an event that ARRIVED. A delivery
 * that never comes leaves an order RESERVED forever with a paid intent behind
 * it; a webhook subscription missing an event type (which happened: row 320)
 * leaves a paid campaign AWAITING_PAYMENT; a database restore from before a
 * sale leaves a succeeded intent with no order at all. None of that is an
 * error anywhere. It is two systems each internally consistent and disagreeing
 * with each other, and the only way to see it is to put the two lists side by
 * side.
 *
 * This module is that comparison, PURE: it takes the rows and the intents and
 * returns findings. `stripe-reconcile-data.ts` fetches; the cron reports. It
 * never mutates anything — a reconciliation that "fixes" drift by itself is a
 * second writer with its own opinion, and the drift it would fix most
 * confidently is the drift it would be wrong about (a refund in flight, a
 * dispute, a webhook two seconds away). It says WHAT disagrees and WHICH side
 * holds the money; a person decides.
 *
 * Every finding names a Stripe object id or a confirmation code, never an
 * amount to charge or refund. Findings are `money` when a member has paid and
 * holds nothing, or holds something nobody paid for; `info` otherwise.
 */

export type ReconcileOrder = {
  confirmationCode: string;
  status: 'RESERVED' | 'CAPTURED' | 'VOID';
  stripePaymentIntentId: string | null;
  settlementAccountId: string | null;
  totalChargeCents: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ReconcileAd = {
  id: string;
  status: string;
  stripePaymentIntentId: string | null;
  budgetCents: number;
  createdAt: Date;
};

export type ReconcileIntent = {
  id: string;
  status: string;
  amount: number;
  amountReceived: number;
  created: Date;
  /** The connected account the intent was listed from; null for the platform. */
  account: string | null;
  metadata: { confirmationCode?: string; adId?: string };
};

export type ReconcileFindingKind =
  | 'captured-without-intent'
  | 'captured-intent-unknown'
  | 'captured-intent-not-succeeded'
  | 'paid-order-not-captured'
  | 'paid-order-missing'
  | 'paid-ad-not-live'
  | 'paid-ad-missing'
  | 'live-ad-without-intent';

export type ReconcileFinding = {
  kind: ReconcileFindingKind;
  severity: 'money' | 'info';
  /** The database side: a confirmation code or an ad id. */
  ref: string | null;
  /** The Stripe side: a PaymentIntent id, with its account when not the platform. */
  intent: string | null;
  detail: string;
};

export type ReconcileInput = {
  orders: ReconcileOrder[];
  ads: ReconcileAd[];
  intents: ReconcileIntent[];
  /** Intents were listed from this instant on. An order or campaign older than
   *  it can hold an intent legitimately absent from the list, and is judged
   *  only on what the database itself says. */
  since: Date;
  now: Date;
};

/** Younger than this, a disagreement is a webhook in flight, not drift. */
export const SETTLE_GRACE_MS = 30 * 60 * 1000;

/** Campaign statuses that mean "this spot can air", so it must be paid for. */
export const LIVE_AD_STATUSES = new Set(['APPROVED', 'PAUSED']);

/** Campaign statuses a paid intent must have moved a campaign past. */
const UNPAID_AD_STATUSES = new Set(['PENDING', 'AWAITING_PAYMENT']);

function describeIntent(intent: ReconcileIntent): string {
  return intent.account ? `${intent.id} on ${intent.account}` : intent.id;
}

export function reconcileStripe(input: ReconcileInput): ReconcileFinding[] {
  const findings: ReconcileFinding[] = [];
  const settled = (at: Date) => input.now.getTime() - at.getTime() > SETTLE_GRACE_MS;
  const inWindow = (at: Date) => at.getTime() >= input.since.getTime();

  const intentsById = new Map(input.intents.map((intent) => [intent.id, intent]));
  const ordersByCode = new Map(input.orders.map((order) => [order.confirmationCode, order]));
  const adsById = new Map(input.ads.map((ad) => [ad.id, ad]));

  /* The database's claims about money it holds. */
  for (const order of input.orders) {
    if (order.status !== 'CAPTURED') continue;
    if (!order.stripePaymentIntentId) {
      if (settled(order.updatedAt)) {
        findings.push({
          kind: 'captured-without-intent',
          severity: 'money',
          ref: order.confirmationCode,
          intent: null,
          detail: `order ${order.confirmationCode} is CAPTURED for ${order.totalChargeCents}c with no PaymentIntent — it cannot be refunded and nothing proves it was paid`,
        });
      }
      continue;
    }
    const intent = intentsById.get(order.stripePaymentIntentId);
    if (!intent) {
      /* Only a finding when the list should have held it: an order older than
         the window has an intent older than the window, legitimately absent. */
      if (inWindow(order.createdAt) && settled(order.updatedAt)) {
        findings.push({
          kind: 'captured-intent-unknown',
          severity: 'money',
          ref: order.confirmationCode,
          intent: order.stripePaymentIntentId,
          detail: `order ${order.confirmationCode} names ${order.stripePaymentIntentId}, which Stripe did not list for the window — wrong account, wrong mode, or a database restored from before the sale`,
        });
      }
      continue;
    }
    if (intent.status !== 'succeeded' && settled(order.updatedAt)) {
      findings.push({
        kind: 'captured-intent-not-succeeded',
        severity: 'money',
        ref: order.confirmationCode,
        intent: describeIntent(intent),
        detail: `order ${order.confirmationCode} is CAPTURED but its intent is ${intent.status} — tickets were issued for money Stripe does not hold`,
      });
    }
  }

  for (const ad of input.ads) {
    if (!LIVE_AD_STATUSES.has(ad.status)) continue;
    if (!ad.stripePaymentIntentId && settled(ad.createdAt)) {
      findings.push({
        kind: 'live-ad-without-intent',
        severity: 'money',
        ref: ad.id,
        intent: null,
        detail: `campaign ${ad.id} is ${ad.status} with a ${ad.budgetCents}c budget and no PaymentIntent — it can air and cannot be settled`,
      });
    }
  }

  /* Stripe's claims about money it holds. */
  for (const intent of input.intents) {
    if (intent.status !== 'succeeded') continue;
    if (!settled(intent.created)) continue;

    const code = intent.metadata.confirmationCode;
    if (code) {
      const order = ordersByCode.get(code);
      if (!order) {
        findings.push({
          kind: 'paid-order-missing',
          severity: 'money',
          ref: code,
          intent: describeIntent(intent),
          detail: `${describeIntent(intent)} succeeded for ${intent.amountReceived}c naming order ${code}, and no such order exists — a fan paid and holds nothing`,
        });
      } else if (order.status !== 'CAPTURED') {
        findings.push({
          kind: 'paid-order-not-captured',
          severity: 'money',
          ref: code,
          intent: describeIntent(intent),
          detail: `${describeIntent(intent)} succeeded for ${intent.amountReceived}c and order ${code} is ${order.status} — paid, not fulfilled`,
        });
      }
      continue;
    }

    const adId = intent.metadata.adId;
    if (adId) {
      const ad = adsById.get(adId);
      if (!ad) {
        findings.push({
          kind: 'paid-ad-missing',
          severity: 'money',
          ref: adId,
          intent: describeIntent(intent),
          detail: `${describeIntent(intent)} succeeded for ${intent.amountReceived}c naming campaign ${adId}, which does not exist`,
        });
      } else if (UNPAID_AD_STATUSES.has(ad.status)) {
        findings.push({
          kind: 'paid-ad-not-live',
          severity: 'money',
          ref: adId,
          intent: describeIntent(intent),
          detail: `${describeIntent(intent)} succeeded for ${intent.amountReceived}c and campaign ${adId} is still ${ad.status} — the advertiser paid and nothing airs`,
        });
      }
    }
  }

  return findings;
}

export type ReconcileSummary = {
  at: string;
  since: string;
  counts: { orders: number; ads: number; intents: number; accounts: number };
  money: number;
  info: number;
  findings: ReconcileFinding[];
};

export function summarizeReconciliation(
  findings: ReconcileFinding[],
  counts: ReconcileSummary['counts'],
  since: Date,
  now: Date,
): ReconcileSummary {
  return {
    at: now.toISOString(),
    since: since.toISOString(),
    counts,
    money: findings.filter((f) => f.severity === 'money').length,
    info: findings.filter((f) => f.severity === 'info').length,
    findings,
  };
}

/** The operator's email, one line per finding, money first. */
export function renderReconciliationText(summary: ReconcileSummary): string {
  const lines = [
    `Stripe reconciliation · ${summary.at}`,
    `Compared ${summary.counts.orders} orders and ${summary.counts.ads} campaigns against ${summary.counts.intents} PaymentIntents (platform + ${summary.counts.accounts} connected accounts) since ${summary.since}.`,
    '',
  ];
  if (summary.findings.length === 0) {
    lines.push('No disagreement. Every captured order and live campaign has a succeeded intent, and every succeeded intent has its row.');
    return lines.join('\n');
  }
  lines.push(`${summary.money} finding(s) about money, ${summary.info} informational:`);
  for (const finding of [...summary.findings].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'money' ? -1 : 1))) {
    lines.push(`- [${finding.severity}] ${finding.kind}: ${finding.detail}`);
  }
  lines.push('', 'Nothing was changed. Read each against the Stripe dashboard before acting; a refund or a re-issue is a decision.');
  return lines.join('\n');
}
