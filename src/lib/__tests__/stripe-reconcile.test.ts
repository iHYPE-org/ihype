import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';
import {
  SETTLE_GRACE_MS,
  reconcileStripe,
  renderReconciliationText,
  summarizeReconciliation,
  type ReconcileAd,
  type ReconcileIntent,
  type ReconcileOrder,
  type ReconcilePayable,
  type ReconcileTransfer,
  type ReconcileTransferCoverage,
} from '@/lib/stripe-reconcile';

const now = new Date('2026-09-11T05:00:00.000Z');
const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
const old = new Date(now.getTime() - 2 * SETTLE_GRACE_MS);
const fresh = new Date(now.getTime() - 60_000);

const order = (over: Partial<ReconcileOrder> = {}): ReconcileOrder => ({
  confirmationCode: 'ABCD1234',
  status: 'CAPTURED',
  stripePaymentIntentId: 'pi_1',
  settlementAccountId: null,
  refundedAt: null,
  totalChargeCents: 2000,
  createdAt: old,
  updatedAt: old,
  ...over,
});
const intent = (over: Partial<ReconcileIntent> = {}): ReconcileIntent => ({
  id: 'pi_1',
  status: 'succeeded',
  amount: 2000,
  amountReceived: 2000,
  created: old,
  account: null,
  metadata: { confirmationCode: 'ABCD1234' },
  ...over,
});
const ad = (over: Partial<ReconcileAd> = {}): ReconcileAd => ({
  id: 'ad_1',
  status: 'APPROVED',
  stripePaymentIntentId: 'pi_ad',
  budgetCents: 5000,
  createdAt: old,
  ...over,
});

const payable = (over: Partial<ReconcilePayable> = {}): ReconcilePayable => ({
  id: 'pay_1',
  status: 'RELEASED',
  stripeTransferId: 'tr_1',
  amountCents: 3500,
  payeeLabel: 'Artist share',
  paidAt: old,
  updatedAt: old,
  ...over,
});
const transfer = (over: Partial<ReconcileTransfer> = {}): ReconcileTransfer => ({
  id: 'tr_1',
  amount: 3500,
  amountReversed: 0,
  created: old,
  destination: 'acct_artist',
  metadata: { payableEntryId: 'pay_1', showId: 'show_1' },
  ...over,
});
/** Read in full, so an absent transfer really means Stripe does not have it. */
const readFully: ReconcileTransferCoverage = { truncated: false, failed: false };

function run(input: {
  orders?: ReconcileOrder[];
  ads?: ReconcileAd[];
  intents?: ReconcileIntent[];
  payables?: ReconcilePayable[];
  transfers?: ReconcileTransfer[];
  transferCoverage?: ReconcileTransferCoverage;
}) {
  return reconcileStripe({
    orders: input.orders ?? [],
    ads: input.ads ?? [],
    intents: input.intents ?? [],
    payables: input.payables,
    transfers: input.transfers,
    transferCoverage: input.transferCoverage,
    since,
    now,
  });
}

describe('the false alarms that would have paged an operator about nothing', () => {
  it('says nothing about a refunded order, whose intent Stripe leaves succeeded', () => {
    /* A refund voids the order and lives on the CHARGE, so the PaymentIntent
       stays `succeeded` with amount_received intact. Before this, cancelling
       a show with 40 sold tickets sent 40 "paid, not fulfilled" money
       findings and a Sentry error on the night it was cancelled. */
    const findings = reconcileStripe({
      orders: [order({ status: 'VOID', refundedAt: old })],
      ads: [],
      intents: [intent({ metadata: { confirmationCode: 'ABCD1234' } })],
      since,
      now,
    });
    expect(findings).toEqual([]);
  });

  it('still reports a VOID order that was never refunded', () => {
    const findings = reconcileStripe({
      orders: [order({ status: 'VOID', refundedAt: null })],
      ads: [],
      intents: [intent({ metadata: { confirmationCode: 'ABCD1234' } })],
      since,
      now,
    });
    expect(findings.map((f) => f.kind)).toEqual(['paid-order-not-captured']);
  });

  it('does not call an order unpaid because its account could not be listed', () => {
    const orders = [order({ settlementAccountId: 'acct_venue', stripePaymentIntentId: 'pi_missing' })];
    const judged = reconcileStripe({ orders, ads: [], intents: [], since, now });
    expect(judged.map((f) => f.kind)).toEqual(['captured-intent-unknown']);

    const withCoverage = reconcileStripe({
      orders,
      ads: [],
      intents: [],
      accounts: [{ account: 'acct_venue', truncated: false, failed: true }],
      since,
      now,
    });
    expect(withCoverage.map((f) => f.kind)).toEqual(['account-not-compared']);
    expect(withCoverage[0].severity).toBe('info');
  });

  it('treats a truncated list the same way, because the oldest are the ones judged', () => {
    const findings = reconcileStripe({
      orders: [order({ stripePaymentIntentId: 'pi_missing' })],
      ads: [],
      intents: [],
      accounts: [{ account: null, truncated: true, failed: false }],
      since,
      now,
    });
    expect(findings.map((f) => f.kind)).toEqual(['account-not-compared']);
  });
});

describe('reconcileStripe — the two ledgers side by side', () => {
  it('reports nothing when they agree', () => {
    expect(run({ orders: [order()], intents: [intent()], ads: [ad()] })).toEqual([]);
  });

  it('a paid intent whose order never captured is money the fan paid and does not hold', () => {
    const findings = run({ orders: [order({ status: 'RESERVED' })], intents: [intent()] });
    expect(findings.map((f) => f.kind)).toEqual(['paid-order-not-captured']);
    expect(findings[0].severity).toBe('money');
  });

  it('a paid intent naming an order that does not exist is a finding, not a skip', () => {
    expect(run({ intents: [intent()] }).map((f) => f.kind)).toEqual(['paid-order-missing']);
  });

  it('a captured order whose intent is not succeeded issued tickets for money Stripe does not hold', () => {
    expect(run({ orders: [order()], intents: [intent({ status: 'requires_payment_method' })] }).map((f) => f.kind))
      .toEqual(['captured-intent-not-succeeded']);
  });

  it('a captured order with no intent at all cannot be refunded and cannot be proven paid', () => {
    expect(run({ orders: [order({ stripePaymentIntentId: null })] }).map((f) => f.kind)).toEqual(['captured-without-intent']);
  });

  it('a captured order naming an intent Stripe did not list is judged only inside the window', () => {
    expect(run({ orders: [order({ stripePaymentIntentId: 'pi_gone' })] }).map((f) => f.kind)).toEqual(['captured-intent-unknown']);
    const beforeWindow = new Date(since.getTime() - 60_000);
    expect(run({ orders: [order({ stripePaymentIntentId: 'pi_gone', createdAt: beforeWindow })] })).toEqual([]);
  });

  it('a live campaign with no intent can air and cannot be settled; a paid campaign still awaiting payment aired nothing', () => {
    expect(run({ ads: [ad({ stripePaymentIntentId: null })] }).map((f) => f.kind)).toEqual(['live-ad-without-intent']);
    const paid = intent({ id: 'pi_ad', metadata: { adId: 'ad_1' } });
    expect(run({ ads: [ad({ status: 'AWAITING_PAYMENT' })], intents: [paid] }).map((f) => f.kind)).toEqual(['paid-ad-not-live']);
    expect(run({ intents: [paid] }).map((f) => f.kind)).toEqual(['paid-ad-missing']);
    // Cancelled and rejected campaigns owe nothing and are not findings.
    expect(run({ ads: [ad({ status: 'CANCELLED', stripePaymentIntentId: null })] })).toEqual([]);
  });

  it('gives a webhook time to arrive: nothing younger than the grace period is drift', () => {
    expect(run({ orders: [order({ status: 'RESERVED', createdAt: fresh, updatedAt: fresh })], intents: [intent({ created: fresh })] })).toEqual([]);
    expect(run({ orders: [order({ stripePaymentIntentId: null, updatedAt: fresh })] })).toEqual([]);
    expect(run({ ads: [ad({ stripePaymentIntentId: null, createdAt: fresh })] })).toEqual([]);
  });

  it('names the connected account an intent was listed from, because that is where the money is', () => {
    const venueIntent = intent({ id: 'pi_v', account: 'acct_venue', metadata: { confirmationCode: 'ZZZZ9999' } });
    const findings = run({ intents: [venueIntent] });
    expect(findings[0].intent).toBe('pi_v on acct_venue');
  });
});

describe('the operator’s text', () => {
  const counts = { orders: 3, ads: 1, intents: 4, accounts: 1, payables: 2, transfers: 2 };

  it('says so plainly when nothing disagrees', () => {
    const text = renderReconciliationText(summarizeReconciliation([], counts, since, now));
    expect(text).toContain('No disagreement');
  });

  it('puts money first and never proposes a change', () => {
    const findings = run({ orders: [order({ status: 'RESERVED' })], intents: [intent()] });
    const summary = summarizeReconciliation(findings, counts, since, now);
    expect(summary.money).toBe(1);
    const text = renderReconciliationText(summary);
    expect(text).toContain('[money] paid-order-not-captured');
    expect(text).toContain('Nothing was changed');
  });
});

describe('the outbound half: what the ledger says it sent, against what Stripe sent', () => {
  it('says nothing when a released payable and its transfer agree', () => {
    expect(run({ payables: [payable()], transfers: [transfer()], transferCoverage: readFully })).toEqual([]);
  });

  it('reports a RELEASED payable with no transfer id — a state no code path here can write', () => {
    /* `triggerShowPayouts()` is the only writer of RELEASED and it records the
       transfer in the same statement, so this means a hand-edited row or a
       restore: an act reads "paid" and nothing proves the money moved. */
    const findings = run({ payables: [payable({ stripeTransferId: null })] });
    expect(findings.map((f) => f.kind)).toEqual(['released-without-transfer']);
    expect(findings[0].severity).toBe('money');
  });

  it('reports a released payable whose transfer Stripe did not list', () => {
    const findings = run({ payables: [payable()], transfers: [], transferCoverage: readFully });
    expect(findings.map((f) => f.kind)).toEqual(['released-transfer-unknown']);
    expect(findings[0].intent).toBe('tr_1');
  });

  it('reports a transfer whose payable is still PENDING — the payout run’s own documented failure', () => {
    /* The transfer succeeded and the RELEASED write did not. The next run asks
       Stripe before paying, so this heals itself; the detail says so, because
       an operator acting on it would issue a second payout. */
    const findings = run({ payables: [payable({ status: 'PENDING', stripeTransferId: null, paidAt: null })], transfers: [transfer()], transferCoverage: readFully });
    expect(findings.map((f) => f.kind)).toEqual(['transfer-payable-not-released']);
    expect(findings[0].detail).toContain('still PENDING');
    expect(findings[0].detail).toContain('rather than sending a second one');
  });

  it('reports a transfer whose payable was VOIDED, which nothing heals', () => {
    const findings = run({ payables: [payable({ status: 'VOID', stripeTransferId: null, paidAt: null })], transfers: [transfer()], transferCoverage: readFully });
    expect(findings.map((f) => f.kind)).toEqual(['transfer-payable-not-released']);
    expect(findings[0].detail).toContain('refunded and the payout went out anyway');
  });

  it('reports a transfer naming a payable that does not exist', () => {
    const findings = run({ payables: [], transfers: [transfer()], transferCoverage: readFully });
    expect(findings.map((f) => f.kind)).toEqual(['transfer-without-payable']);
  });

  it('reports a reversed transfer the ledger still calls paid', () => {
    const findings = run({ payables: [payable()], transfers: [transfer({ amountReversed: 3500 })], transferCoverage: readFully });
    expect(findings.map((f) => f.kind)).toEqual(['released-transfer-reversed']);
  });

  it('reports a transfer that moved a different amount than the payable records', () => {
    const findings = run({ payables: [payable()], transfers: [transfer({ amount: 3400 })], transferCoverage: readFully });
    expect(findings.map((f) => f.kind)).toEqual(['released-transfer-amount']);
  });
});

describe('the outbound half’s false alarms', () => {
  it('judges no absent transfer when the list failed, and says the comparison did not happen', () => {
    /* A Stripe outage must not read as "every act was told they were paid and
       nothing moved" — the same rule as an account whose intents would not
       list. Silence about payables would read as a clean night. */
    const findings = run({ payables: [payable()], transfers: [], transferCoverage: { truncated: false, failed: true } });
    expect(findings.map((f) => f.kind)).toEqual(['transfers-not-compared']);
    expect(findings[0].severity).toBe('info');
  });

  it('judges no absent transfer when the list was truncated, but still judges the transfers it read', () => {
    /* Truncation invalidates only the ABSENCE of a transfer. One that was read
       is a real transfer, and a payable it names that is still PENDING is
       still money that left. */
    const findings = run({
      payables: [payable({ id: 'pay_2', stripeTransferId: 'tr_gone' }), payable({ status: 'PENDING', stripeTransferId: null, paidAt: null })],
      transfers: [transfer()],
      transferCoverage: { truncated: true, failed: false },
    });
    expect(findings.map((f) => f.kind).sort()).toEqual(['transfer-payable-not-released', 'transfers-not-compared']);
  });

  it('says nothing about a transfer this product did not create', () => {
    expect(run({ payables: [], transfers: [transfer({ metadata: {} })], transferCoverage: readFully })).toEqual([]);
  });

  it('says nothing about a transfer inside the settle grace', () => {
    expect(run({ payables: [], transfers: [transfer({ created: fresh })], transferCoverage: readFully })).toEqual([]);
  });

  it('says nothing about a payable released before the window, whose transfer is legitimately absent', () => {
    /* `paidAt`, not `createdAt`: the payable is created when the order is
       captured and can predate the window by weeks while its transfer is
       inside it. Judged on the wrong date, every older payout reads as money
       Stripe has no record of. */
    const beforeWindow = new Date(since.getTime() - 24 * 60 * 60 * 1000);
    expect(run({ payables: [payable({ paidAt: beforeWindow })], transfers: [], transferCoverage: readFully })).toEqual([]);
  });

  it('says nothing about a PENDING payable with no transfer, which is simply not paid yet', () => {
    expect(run({ payables: [payable({ status: 'PENDING', stripeTransferId: null, paidAt: null })], transfers: [], transferCoverage: readFully })).toEqual([]);
  });
});

describe('the scope line is part of the finding', () => {
  it('names payables and transfers among what was compared', () => {
    const counts = { orders: 3, ads: 1, intents: 4, accounts: 1, payables: 2, transfers: 2 };
    const text = renderReconciliationText(summarizeReconciliation([], counts, since, now));
    expect(text).toContain('2 payables against 2 transfers');
    /* "No disagreement" is a claim about everything the run looked at, so it
       has to name the outbound half too — the sentence that would otherwise
       still describe only the inbound comparison. */
    expect(text).toContain('every released payable has a transfer Stripe agrees it sent');
  });
});

describe('the contract the comparison cannot check itself', () => {
  /* `ReconcileInput.payables` asks the data half for the payables in the
     window PLUS every payable a listed transfer names, and a pure module has
     no way to tell whether it got them. Fetched by window alone, the single
     case this comparison most exists to catch — a transfer whose RELEASED
     write failed, on a row whose `updatedAt` therefore never moved — reports
     as `transfer-without-payable`: "money left and nothing accounts for it",
     about a payable sitting in the table. So the guard is on the SOURCE.

     Masked, because the comment above the query in that file names the query
     it is explaining, and an assertion satisfied by prose is the trap this
     repository has now recorded four times. */
  const source = maskComments(
    fs.readFileSync(path.join(process.cwd(), 'src/lib/stripe-reconcile-data.ts'), 'utf8'),
  );

  it('fetches payables by window AND by the ids listed transfers name', () => {
    expect(source).toMatch(/accountsPayableEntry\.findMany\(\{\s*where:\s*\{\s*updatedAt:\s*\{\s*gte:\s*since\s*\}/);
    expect(source).toMatch(/accountsPayableEntry[\s\S]{0,200}where:\s*\{\s*id:\s*\{\s*in:\s*namedByTransfer\s*\}/);
    const named = source.slice(source.indexOf('const namedByTransfer'), source.indexOf('const namedByTransfer') + 400);
    expect(named).toContain('metadata.payableEntryId');
  });

  it('lets that second read throw rather than answering with an empty list', () => {
    /* An empty answer here is indistinguishable from "these payables do not
       exist", which IS the money finding — so catching it to [] would invent
       drift rather than degrade. The run fails loudly instead. */
    const at = source.indexOf('namedByTransfer.length');
    expect(at).toBeGreaterThan(-1);
    const block = source.slice(at, at + 700);
    expect(block).toContain('throw error');
    expect(block).not.toMatch(/catch\s*\([^)]*\)\s*=>\s*\[\]/);
  });

  it('lists transfers platform-scoped, because that is where a payout is created', () => {
    /* `createPayoutTransfer` passes no `stripeAccount`, so a per-account list
       would find nothing and read as a clean comparison. */
    expect(source).toMatch(/stripe\.transfers\.list\(\{\s*created:/);
    expect(source).not.toMatch(/transfers\.list\([^)]*stripeAccount/);
  });
});
