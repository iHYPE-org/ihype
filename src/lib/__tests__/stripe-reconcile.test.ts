import { describe, expect, it } from 'vitest';
import {
  SETTLE_GRACE_MS,
  reconcileStripe,
  renderReconciliationText,
  summarizeReconciliation,
  type ReconcileAd,
  type ReconcileIntent,
  type ReconcileOrder,
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

function run(input: { orders?: ReconcileOrder[]; ads?: ReconcileAd[]; intents?: ReconcileIntent[] }) {
  return reconcileStripe({ orders: input.orders ?? [], ads: input.ads ?? [], intents: input.intents ?? [], since, now });
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
  const counts = { orders: 3, ads: 1, intents: 4, accounts: 1 };

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
