#!/usr/bin/env node
/**
 * Stripe test-mode rehearsal of the money a sale actually moves.
 *
 * Why this exists
 * ---------------
 * Every ticket is sold `VENUE_KEEPS_ALL` (2026-09-27, DESIGN_SYNC row 528):
 * the charge is created ON the venue's own connected account with NO
 * application fee, the venue keeps the whole face value, Stripe's card fee is
 * the venue's cost (Show Revenue Split Agreement 4.4), and the venue pays each
 * act its signed percentage outside Stripe. iHYPE never holds ticket money. A
 * refund is issued on the venue's account too, and Stripe keeps its fee (7.3).
 *
 * The other money iHYPE takes is a station SPONSORSHIP: charged in full on the
 * platform account when the sponsor pays, and the unused days refunded
 * pro-rata on cancellation (`ad-settlement-plan.ts`).
 *
 * Until 2026-09-29 this script rehearsed three settlement modes no sale takes
 * any more — capture to the platform balance, 70/20/10 transfers out of it,
 * destination charges — and a manual-capture ad hold the product stopped
 * using on 2026-09-02. Production held zero orders under any of them (row
 * 533), so those steps are gone rather than kept beside the live one.
 *
 * What it rehearses, with the same call shapes `src/lib/stripe.ts` uses
 * ---------------------------------------------------------------------
 *   1. A sale: a PaymentIntent on the venue's account with no application fee
 *      captures the whole amount THERE, is invisible to a platform-scoped
 *      lookup, and the venue's balance transaction carries Stripe's fee.
 *   2. Its refund: issued on the venue's account for the full face value; the
 *      fee is not returned to the venue.
 *   3. A sponsorship: charged in full on the platform, then the unused part of
 *      the term refunded pro-rata, and a replayed refund not issued twice.
 *
 * What it does NOT prove
 * ----------------------
 * The application's own rows — the order, the agreement, the settlement
 * statement — which the nightly acceptance walk drives against a built worker
 * (items 15, 16 + 31, 17, 29, R1). This verifies the Stripe operations those
 * paths issue behave as assumed.
 *
 * Usage
 * -----
 *   STRIPE_SECRET_KEY=sk_test_... REHEARSAL_MERCHANT_ACCOUNT=acct_venue \
 *     npm run stripe:rehearsal
 *
 * The merchant is a connected account with an ACTIVE `card_payments`
 * capability (a venue that finished hosted onboarding). It is auto-detected
 * when unset; with none available the sale steps cannot run and the script
 * exits 2 — not a pass.
 */

import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY ?? '';

// Refuse to touch live money. This script creates charges and refunds; against
// a live key they would be real transactions on real cards.
if (!KEY) {
  console.error('STRIPE_SECRET_KEY is not set. Export a TEST-mode key (sk_test_...).');
  process.exit(1);
}
if (!KEY.startsWith('sk_test_')) {
  console.error('Refusing to run: STRIPE_SECRET_KEY is not a test-mode key (expected sk_test_...).');
  console.error('This script creates charges and refunds. It must never run against live mode.');
  process.exit(1);
}

/* Egress through an HTTPS proxy when the environment names one. The sandboxes
   this is rehearsed from reach Stripe only that way, and Stripe's default Node
   client ignores HTTPS_PROXY — every request failed as "An error occurred with
   our connection to Stripe" (2026-09-01). `https-proxy-agent` is the agent
   Stripe's own docs name for this; it is a transitive dependency here, so it is
   loaded dynamically and its absence just means a direct connection, which is
   the right behaviour on a machine with plain egress. */
async function buildStripe() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxy) return new Stripe(KEY);
  try {
    const { HttpsProxyAgent } = await import('https-proxy-agent');
    return new Stripe(KEY, { httpAgent: new HttpsProxyAgent(proxy) });
  } catch {
    console.warn('HTTPS_PROXY is set but https-proxy-agent is not installed; connecting directly.');
    return new Stripe(KEY);
  }
}
const stripe = await buildStripe();

const TICKET_AMOUNT_CENTS = 5000;
/* One LOCAL month (`SPONSORSHIP_MONTHLY_USD`), a 30-day term, cancelled with
   20 days unused: the refund is paid × unused / term, rounded to the cent —
   the sentence the sponsor can check. */
const SPONSORSHIP_CENTS = 2500;
const TERM_DAYS = 30;
const UNUSED_DAYS = 20;

let passed = 0;
let failed = 0;
/* A skipped sale step is not a failure — nobody can conjure an onboarded venue
   out of a script — but a silent skip that exits 0 is how this codebase twice
   trusted a green tick that measured nothing. A run that could not rehearse a
   sale exits 2. */
let skippedSale = false;

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function resolveMerchantAccount() {
  const fromEnv = (process.env.REHEARSAL_MERCHANT_ACCOUNT ?? process.env.REHEARSAL_VENUE_ACCOUNT ?? '').trim();
  if (fromEnv) return fromEnv;
  const existing = await stripe.accounts.list({ limit: 100 });
  // card_payments, not transfers: an account can be payable and still unable
  // to be the merchant on a charge. `Restricted` in the dashboard means
  // requirements are outstanding and the capability is not active — finish the
  // requirements on an account that exists rather than creating another.
  const merchant = existing.data.find((a) => a.capabilities?.card_payments === 'active');
  if (!merchant) {
    const restricted = existing.data.filter((a) => (a.requirements?.currently_due ?? []).length > 0).length;
    console.log(`  ${existing.data.length} connected account(s) exist; none has an active card_payments capability (${restricted} with outstanding requirements).`);
  }
  return merchant?.id ?? null;
}

async function step1Sale(merchant) {
  console.log('\n[1] A sale is a charge on the venue with no application fee');
  const code = `rehearsal-sale-${Date.now()}`;
  const intent = await stripe.paymentIntents.create(
    {
      amount: TICKET_AMOUNT_CENTS,
      currency: 'usd',
      payment_method: 'pm_card_visa',
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { confirmationCode: code, settlementMode: 'venue_keeps_all', rehearsal: 'true' },
    },
    {
      // The header is the whole difference: without it iHYPE is silently the
      // merchant, which looks normal until a chargeback.
      stripeAccount: merchant,
      idempotencyKey: `ticket-keeps-all:${merchant}:${code}`,
    },
  );
  check('the charge succeeds on the venue', intent.status === 'succeeded', intent.status);
  check('the whole face value is received', intent.amount_received === TICKET_AMOUNT_CENTS, `amount_received=${intent.amount_received}`);
  check('no application fee is taken', !intent.application_fee_amount, `application_fee_amount=${intent.application_fee_amount ?? 'none'}`);
  check('nothing is routed onward', !intent.transfer_data, intent.transfer_data ? JSON.stringify(intent.transfer_data) : 'no transfer_data');

  // The merchant role really moved: a platform-scoped lookup must fail, and
  // that failure is the pass.
  let visibleToPlatform = true;
  try {
    await stripe.paymentIntents.retrieve(intent.id);
  } catch {
    visibleToPlatform = false;
  }
  check('the charge lives on the venue, not the platform', !visibleToPlatform, visibleToPlatform ? 'platform can read it — the stripeAccount header did not apply' : `${intent.id} is invisible to the platform`);

  // Options are the THIRD argument on retrieve(); passed second, stripeAccount
  // is sent as a request parameter and rejected (measured 2026-08-30).
  const charge = await stripe.charges.retrieve(String(intent.latest_charge), { expand: ['balance_transaction'] }, { stripeAccount: merchant });
  const txn = typeof charge.balance_transaction === 'object' ? charge.balance_transaction : null;
  check('Stripe’s fee is debited from the venue (Agreement 4.4)', Boolean(txn && txn.fee > 0 && txn.net === TICKET_AMOUNT_CENTS - txn.fee),
    txn ? `fee=${txn.fee} net=${txn.net}` : 'no balance transaction on the charge');
  return intent;
}

async function step2Refund(merchant, intent) {
  console.log('\n[2] The refund is issued on the venue, in full, and the fee stays with Stripe (7.3)');
  const refund = await stripe.refunds.create(
    { payment_intent: intent.id },
    { stripeAccount: merchant, idempotencyKey: `refund:${intent.id}` },
  );
  check('refund succeeds', refund.status === 'succeeded' || refund.status === 'pending', `status=${refund.status}`);
  check('refund covers the full face value', refund.amount === TICKET_AMOUNT_CENTS, `amount=${refund.amount}`);
  const again = await stripe.refunds.retrieve(refund.id, { expand: ['balance_transaction'] }, { stripeAccount: merchant });
  const txn = typeof again.balance_transaction === 'object' ? again.balance_transaction : null;
  check('the fee is not returned to the venue', Boolean(txn && txn.amount === -TICKET_AMOUNT_CENTS && txn.fee === 0),
    txn ? `refund txn amount=${txn.amount} fee=${txn.fee}` : 'no balance transaction on the refund');
  const platformCanSee = await stripe.refunds.retrieve(refund.id).then(() => true).catch(() => false);
  check('the refund, like the charge, is the venue’s', !platformCanSee, platformCanSee ? 'visible to the platform' : 'invisible to the platform');
}

async function step3Sponsorship() {
  console.log('\n[3] A sponsorship is charged in full, and the unused days come back pro-rata');
  const adId = `rehearsal-ad-${Date.now()}`;
  const intent = await stripe.paymentIntents.create(
    {
      amount: SPONSORSHIP_CENTS,
      currency: 'usd',
      payment_method: 'pm_card_visa',
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { adId, rehearsal: 'true' },
    },
    { idempotencyKey: `ad-campaign:${adId}` },
  );
  check('the whole term is captured on the platform when the sponsor pays', intent.status === 'succeeded' && intent.amount_received === SPONSORSHIP_CENTS,
    `status=${intent.status} amount_received=${intent.amount_received}`);

  const refundCents = Math.round((SPONSORSHIP_CENTS * UNUSED_DAYS) / TERM_DAYS);
  const refund = await stripe.refunds.create(
    { payment_intent: intent.id, amount: refundCents },
    { idempotencyKey: `ad-settlement:${adId}` },
  );
  check('the unused days are refunded, paid × unused / term', refund.amount === refundCents, `refund=${refund.amount} of ${SPONSORSHIP_CENTS} (${UNUSED_DAYS}/${TERM_DAYS} unused)`);

  // The settlement cron runs daily; a second run must not refund twice.
  const replay = await stripe.refunds.create(
    { payment_intent: intent.id, amount: refundCents },
    { idempotencyKey: `ad-settlement:${adId}` },
  );
  check('a replayed settlement returns the same refund, not a second one', replay.id === refund.id, `${replay.id} vs ${refund.id}`);
  await sleep(500);
  const after = await stripe.paymentIntents.retrieve(intent.id, { expand: ['latest_charge'] });
  const charge = typeof after.latest_charge === 'object' ? after.latest_charge : null;
  check('the charge shows exactly one refund', charge?.amount_refunded === refundCents, `amount_refunded=${charge?.amount_refunded}`);
}

async function main() {
  const account = await stripe.accounts.retrieve();
  console.log(`Stripe test-mode rehearsal — account ${account.id}`);
  console.log('No live-mode key can reach this point; every object below is test data.');

  const merchant = await resolveMerchantAccount();
  if (merchant) {
    const intent = await step1Sale(merchant);
    await step2Refund(merchant, intent);
  } else {
    console.log('\n[1-2] SKIP  no connected account has an active `card_payments` capability, so no sale');
    console.log('           can be rehearsed. Complete hosted onboarding for a venue with the merchant');
    console.log('           configuration, then re-run with REHEARSAL_MERCHANT_ACCOUNT=acct_venue.');
    skippedSale = true;
  }
  await step3Sponsorship();

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    console.error('\nA failure here means the application would behave the same way against live money.');
    process.exit(1);
  }
  if (skippedSale) {
    console.error('\nINCOMPLETE — the sale and its refund were not rehearsed; only the sponsorship ran.');
    console.error('Exiting 2 rather than 0 so this cannot be mistaken for a pass by anything reading the exit code.');
    process.exit(2);
  }
  console.log('\nStripe-side semantics hold for the one settlement mode a sale takes (VENUE_KEEPS_ALL) and for a sponsorship.');
  console.log('The application’s own rows are proven by the nightly acceptance walk.');
}

main().catch((error) => {
  console.error('\nRehearsal aborted:', error?.message ?? error);
  process.exit(1);
});
