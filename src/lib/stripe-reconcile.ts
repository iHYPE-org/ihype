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
 * THE OUTBOUND HALF IS COMPARED TOO, and it was not until 2026-09-15: orders
 * and campaigns against PaymentIntents is the money coming IN, and the money
 * going OUT — `AccountsPayableEntry` rows against Stripe transfers — had
 * nothing looking at it at all. It is the pair with the loudest failure mode:
 * `triggerShowPayouts()` creates the transfer and then writes RELEASED, and
 * its own docstring records that the write can fail after the money has
 * moved. From inside, that row simply reads PENDING and the next run heals it;
 * from outside, an act was paid and the ledger says they were not. The reverse
 * — RELEASED with no transfer Stripe knows about — is an act told they were
 * paid when nothing moved.
 *
 * WHAT IS DELIBERATELY NOT HERE: whether a payee can be paid at all. A payable
 * owed to a profile that never finished Connect onboarding is skipped by every
 * payout run, for ever — a real and expensive condition, and NOT a
 * reconciliation finding, because it is a fact about ONE ledger rather than a
 * disagreement between two. The payout run names it itself, once per run, with
 * the two reasons apart. Reporting it here as well would be a second opinion
 * about the same fact, arriving from a job whose whole discipline is that it
 * only ever says "these two lists differ".
 *
 * Every finding names a Stripe object id or a confirmation code, never an
 * amount to charge or refund. Findings are `money` when a member has paid and
 * holds nothing, or holds something nobody paid for; `info` otherwise.
 */

export type ReconcileOrder = {
  confirmationCode: string;
  status: 'RESERVED' | 'CAPTURED' | 'VOID';
  /** Set when the order was refunded. A refund voids the order and leaves the
   *  intent `succeeded` — Stripe keeps refunds on the charge — so without this
   *  every refunded ticket reads as money paid and not fulfilled. */
  refundedAt: Date | null;
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

export type ReconcilePayable = {
  id: string;
  status: 'PENDING' | 'RELEASED' | 'VOID';
  /** Written in the same statement that sets RELEASED, so RELEASED without it
   *  is a state no code path here can produce. */
  stripeTransferId: string | null;
  amountCents: number;
  payeeLabel: string;
  /** When the payout run recorded the transfer. Null unless RELEASED. */
  paidAt: Date | null;
  updatedAt: Date;
};

export type ReconcileTransfer = {
  id: string;
  amount: number;
  /** Stripe keeps a reversal ON the transfer rather than removing it, so a
   *  transfer that was sent and clawed back still lists, with its full
   *  `amount`, and only this field says so. */
  amountReversed: number;
  created: Date;
  destination: string | null;
  metadata: { payableEntryId?: string; showId?: string };
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
  | 'live-ad-without-intent'
  /* The outbound half: what the ledger says left, against what Stripe says
     left. `released-*` is the database making a claim about a transfer;
     `transfer-*` is Stripe holding a transfer the database does not account
     for. */
  | 'released-without-transfer'
  | 'released-transfer-unknown'
  | 'released-transfer-amount'
  | 'released-transfer-reversed'
  | 'transfer-without-payable'
  | 'transfer-payable-not-released'
  | 'transfers-not-compared'
  /* Not a disagreement: a note that one account could not be compared at all,
     so the silence about it means nothing. Carried as `info` so the headline
     count stays "money", and reported so a quiet night is not read as a clean
     one. */
  | 'account-not-compared';

export type ReconcileFinding = {
  kind: ReconcileFindingKind;
  severity: 'money' | 'info';
  /** The database side: a confirmation code or an ad id. */
  ref: string | null;
  /** The Stripe side: a PaymentIntent or a Transfer id, with its account when
   *  the intent was listed from a connected one. */
  intent: string | null;
  detail: string;
};

/** Whether each account's intent list is complete enough to compare against. */
export type ReconcileAccountCoverage = {
  /** null for the platform account. */
  account: string | null;
  /** The list hit the per-account cap, so the OLDEST intents are missing. */
  truncated: boolean;
  /** Stripe refused the list; nothing was read for this account. */
  failed: boolean;
};

/** Whether the transfer list is complete enough to judge a payable against.
 *  Separate from the per-account intent coverage above, because every payout
 *  transfer is created on the PLATFORM account — `createPayoutTransfer` passes
 *  no `stripeAccount` — so there is one list, not one per venue. */
export type ReconcileTransferCoverage = {
  /** The list hit its cap, so the OLDEST transfers of the window are missing. */
  truncated: boolean;
  /** Stripe refused the list; no transfer was read at all. */
  failed: boolean;
};

/** Stands in for the platform account in the coverage set, which is keyed by string. */
export const PLATFORM_ACCOUNT = 'platform';

export type ReconcileInput = {
  orders: ReconcileOrder[];
  accounts?: ReconcileAccountCoverage[];
  ads: ReconcileAd[];
  intents: ReconcileIntent[];
  /**
   * Payables in the window, PLUS every payable named by a listed transfer.
   *
   * THE SECOND HALF IS A CONTRACT THE DATA SIDE OWES AND THIS MODULE CANNOT
   * CHECK. The case worth catching most is a transfer whose RELEASED write
   * failed — and that row's `updatedAt` never moved, so it can sit weeks
   * outside a window its own transfer is inside. Fetched by window alone, the
   * single most important finding here would report as `transfer-without-
   * payable`: "money left and nothing here accounts for it", about a payable
   * sitting in the table.
   */
  payables?: ReconcilePayable[];
  transfers?: ReconcileTransfer[];
  transferCoverage?: ReconcileTransferCoverage;
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

  /* An account whose list came back short or not at all cannot be compared:
     an intent absent from a truncated page looks exactly like an intent that
     does not exist. Judging those orders anyway turns a transient Stripe
     failure into "a fan paid and holds nothing". */
  const unusableAccounts = new Set(
    (input.accounts ?? []).filter((a) => a.truncated || a.failed).map((a) => a.account ?? PLATFORM_ACCOUNT),
  );
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
      if (unusableAccounts.has(order.settlementAccountId ?? PLATFORM_ACCOUNT)) continue;
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

  for (const coverage of input.accounts ?? []) {
    if (!coverage.truncated && !coverage.failed) continue;
    const who = coverage.account ?? 'the platform account';
    findings.push({
      kind: 'account-not-compared',
      severity: 'info',
      ref: coverage.account,
      intent: null,
      detail: coverage.failed
        ? `Stripe would not list PaymentIntents for ${who}, so its orders were not compared this run`
        : `the intent list for ${who} hit its cap, so the oldest of the window is missing and its orders were not compared this run`,
    });
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
      } else if (order.status !== 'CAPTURED' && !order.refundedAt) {
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

  /* THE OUTBOUND HALF: the ledger's claims about money it sent, against
     Stripe's list of what left. */
  const payables = input.payables ?? [];
  const transfers = input.transfers ?? [];
  const coverage = input.transferCoverage;
  /* Same rule as an account whose intents could not be listed: a transfer
     absent from a truncated or failed list looks exactly like a transfer that
     was never made, and judging a payable against it turns a Stripe outage
     into "an act was told they were paid and nothing moved". Truncation
     invalidates only the ABSENCE of a transfer — every transfer that WAS read
     is still a real one, so the Stripe-side loop below runs regardless. */
  const transfersComplete = Boolean(coverage) && !coverage!.failed && !coverage!.truncated;
  const transfersById = new Map(transfers.map((transfer) => [transfer.id, transfer]));
  const payablesById = new Map(payables.map((payable) => [payable.id, payable]));

  for (const payable of payables) {
    if (payable.status !== 'RELEASED') continue;

    if (!payable.stripeTransferId) {
      /* `triggerShowPayouts()` is the only code that writes RELEASED and it
         writes the transfer id in the same statement, so this state cannot be
         reached by running the product — which is exactly why it is worth
         reporting: it means a hand-edited row or a restore. */
      if (settled(payable.updatedAt)) {
        findings.push({
          kind: 'released-without-transfer',
          severity: 'money',
          ref: payable.id,
          intent: null,
          detail: `payable ${payable.id} (${payable.payeeLabel}, ${payable.amountCents}c) is RELEASED with no transfer id — the only code that releases one records the transfer in the same write, so nothing proves this money ever moved`,
        });
      }
      continue;
    }

    const transfer = transfersById.get(payable.stripeTransferId);
    if (!transfer) {
      if (!transfersComplete) continue;
      /* Judged on `paidAt`, not `createdAt`: the payable is created when the
         order is captured and can predate the window by weeks while the
         transfer it names is inside it. */
      if (payable.paidAt && inWindow(payable.paidAt) && settled(payable.updatedAt)) {
        findings.push({
          kind: 'released-transfer-unknown',
          severity: 'money',
          ref: payable.id,
          intent: payable.stripeTransferId,
          detail: `payable ${payable.id} (${payable.payeeLabel}) names transfer ${payable.stripeTransferId}, which Stripe did not list for the window — ${payable.payeeLabel} is recorded as paid and Stripe has no record of sending it`,
        });
      }
      continue;
    }

    if (transfer.amount !== payable.amountCents) {
      findings.push({
        kind: 'released-transfer-amount',
        severity: 'money',
        ref: payable.id,
        intent: transfer.id,
        detail: `payable ${payable.id} (${payable.payeeLabel}) records ${payable.amountCents}c and transfer ${transfer.id} moved ${transfer.amount}c`,
      });
    }
    if (transfer.amountReversed > 0) {
      findings.push({
        kind: 'released-transfer-reversed',
        severity: 'money',
        ref: payable.id,
        intent: transfer.id,
        detail: `transfer ${transfer.id} for payable ${payable.id} has ${transfer.amountReversed}c reversed and the payable still reads RELEASED — ${payable.payeeLabel} was told they were paid and the money came back`,
      });
    }
  }

  for (const transfer of transfers) {
    const payableId = transfer.metadata.payableEntryId;
    /* A transfer this product did not create. Nothing here can say anything
       about it, and saying something anyway is how a reconciler starts
       reporting the operator's own dashboard actions as drift. */
    if (!payableId) continue;
    if (!settled(transfer.created)) continue;

    const payable = payablesById.get(payableId);
    if (!payable) {
      findings.push({
        kind: 'transfer-without-payable',
        severity: 'money',
        ref: payableId,
        intent: transfer.id,
        detail: `transfer ${transfer.id} moved ${transfer.amount}c naming payable ${payableId}, and no such payable exists — money left the platform balance and nothing here accounts for it`,
      });
      continue;
    }
    if (payable.status === 'RELEASED') continue;

    findings.push({
      kind: 'transfer-payable-not-released',
      severity: 'money',
      ref: payableId,
      intent: transfer.id,
      detail:
        payable.status === 'VOID'
          ? `transfer ${transfer.id} moved ${transfer.amount}c to ${payable.payeeLabel} and payable ${payableId} is VOID — the order behind it was refunded and the payout went out anyway`
          : `transfer ${transfer.id} moved ${transfer.amount}c to ${payable.payeeLabel} and payable ${payableId} is still PENDING — the transfer succeeded and the write recording it did not. The next payout run asks Stripe before paying and records this transfer rather than sending a second one, so if this is still here tomorrow, it did not`,
    });
  }

  if (coverage && (coverage.failed || coverage.truncated)) {
    findings.push({
      kind: 'transfers-not-compared',
      severity: 'info',
      ref: null,
      intent: null,
      detail: coverage.failed
        ? 'Stripe would not list transfers, so no released payable was compared against one this run'
        : 'the transfer list hit its cap, so the oldest of the window is missing and a released payable naming one of those is not reported this run',
    });
  }

  return findings;
}

export type ReconcileSummary = {
  at: string;
  since: string;
  counts: { orders: number; ads: number; intents: number; accounts: number; payables: number; transfers: number };
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
    /* THE SCOPE LINE IS PART OF THE FINDING. "No disagreement" is only worth
       anything beside a statement of what was compared, and this line is what
       stopped the outbound half being unreconciled in silence: it named
       orders, campaigns and intents, and an operator reading it could see
       that payables were not in it. Add a comparison, add it here. */
    `Compared ${summary.counts.orders} orders and ${summary.counts.ads} campaigns against ${summary.counts.intents} PaymentIntents (platform + ${summary.counts.accounts} connected accounts), and ${summary.counts.payables} payables against ${summary.counts.transfers} transfers, since ${summary.since}.`,
    '',
  ];
  if (summary.findings.length === 0) {
    lines.push('No disagreement. Every captured order and live campaign has a succeeded intent, every succeeded intent has its row, and every released payable has a transfer Stripe agrees it sent.');
    return lines.join('\n');
  }
  lines.push(`${summary.money} finding(s) about money, ${summary.info} informational:`);
  for (const finding of [...summary.findings].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'money' ? -1 : 1))) {
    lines.push(`- [${finding.severity}] ${finding.kind}: ${finding.detail}`);
  }
  lines.push('', 'Nothing was changed. Read each against the Stripe dashboard before acting; a refund or a re-issue is a decision.');
  return lines.join('\n');
}
