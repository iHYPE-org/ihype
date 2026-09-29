#!/usr/bin/env node
/**
 * The dispute walk: who eats a chargeback on a ticket.
 *
 * Every ticket is sold `VENUE_KEEPS_ALL` (2026-09-27, DESIGN_SYNC row 528): a
 * charge created ON the venue's own connected account with no application
 * fee. The settlement design says a dispute on such a charge is debited from
 * the VENUE — and under Stripe-managed risk an unrecoverable shortfall is
 * Stripe's — never from iHYPE, which holds no ticket money. Stripe's docs say
 * so (quoted in docs/runbooks/money-path-rehearsal.md); this measures it.
 *
 * It buys with Stripe's dispute test card (`pm_card_createDispute`: the charge
 * succeeds and is then disputed as fraudulent) as a direct charge on the
 * venue, waits for the dispute to exist, and reads WHOSE balance carries the
 * disputed amount and the dispute fee off the dispute's own
 * balance_transactions. The judgement about what the numbers mean stays with
 * a person; the numbers themselves are printed here.
 *
 * Until 2026-09-29 a second leg measured a DESTINATION charge, the mode the
 * 1.5% reserve was priced against; no sale takes it any more and production
 * held no order under it (row 533), so that leg is gone.
 *
 * If the dispute lands on the PLATFORM's balance, the settlement model is
 * wrong and the agreement's 7.2 with it.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_… REHEARSAL_MERCHANT_ACCOUNT=acct_venue \
 *   npm run stripe:disputes
 *
 * Residue: one open test dispute stays in the sandbox (it can be responded to
 * or ignored; test mode only). This script refuses any key that is not
 * `sk_test_`, so it cannot create a live dispute.
 */

import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY ?? '';
if (!KEY) {
  console.error('STRIPE_SECRET_KEY is not set. Export a TEST-mode key (sk_test_...).');
  process.exit(1);
}
if (!KEY.startsWith('sk_test_')) {
  console.error('Refusing to run: STRIPE_SECRET_KEY is not a test-mode key (expected sk_test_...).');
  console.error('This script creates DISPUTED charges. It must never run against live mode.');
  process.exit(1);
}

const stripe = new Stripe(KEY);

const VENUE = (process.env.REHEARSAL_MERCHANT_ACCOUNT ?? process.env.REHEARSAL_VENUE_ACCOUNT ?? '').trim();
if (!VENUE) {
  console.error('Set REHEARSAL_MERCHANT_ACCOUNT to a connected account with card_payments active (a venue).');
  process.exit(1);
}

const AMOUNT = 5000;
let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** The test dispute is created asynchronously after the charge — usually
 *  seconds, occasionally longer. Poll rather than trusting any single read. */
async function waitForDispute(chargeId, scope) {
  for (let i = 0; i < 48; i += 1) {
    const disputes = await stripe.disputes.list({ charge: chargeId, limit: 1 }, scope);
    if (disputes.data[0]) return disputes.data[0];
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  return null;
}

/** A dispute's own balance_transactions say exactly what was debited and
 *  from which balance: the array lives on the dispute object, and the
 *  dispute object lives on the account that ate it. */
function describeImpact(dispute) {
  const txns = dispute.balance_transactions ?? [];
  const amount = txns.reduce((sum, t) => sum + t.amount, 0);
  const fee = txns.reduce((sum, t) => sum + t.fee, 0);
  const net = txns.reduce((sum, t) => sum + t.net, 0);
  return { amount, fee, net, count: txns.length };
}

async function disputeIsVisibleToPlatform(chargeId) {
  const disputes = await stripe.disputes.list({ charge: chargeId, limit: 1 });
  return Boolean(disputes.data[0]);
}

async function legVenueKeepsAll() {
  console.log('\n[1] VENUE_KEEPS_ALL: the dispute is the venue’s, not the platform’s');
  const intent = await stripe.paymentIntents.create(
    {
      amount: AMOUNT,
      currency: 'usd',
      payment_method: 'pm_card_createDispute',
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { rehearsal: 'true', purpose: 'dispute-walk', settlementMode: 'venue_keeps_all' },
    },
    { stripeAccount: VENUE, idempotencyKey: `dispute-walk-venue:${Date.now()}` },
  );
  check('disputed-card charge succeeds on the venue', intent.status === 'succeeded', intent.status);
  check('no application fee was taken', !intent.application_fee_amount, `application_fee_amount=${intent.application_fee_amount ?? 'none'}`);
  const chargeId = String(intent.latest_charge);

  const dispute = await waitForDispute(chargeId, { stripeAccount: VENUE });
  check('a dispute exists on the VENUE’s account', Boolean(dispute), dispute ? `${dispute.id} (${dispute.status})` : 'none after 4 minutes');
  if (!dispute) return;

  const impact = describeImpact(dispute);
  check(
    'the disputed amount AND the dispute fee are debited from the VENUE’s balance',
    impact.amount === -AMOUNT && impact.fee > 0,
    `amount=${impact.amount} fee=${impact.fee} net=${impact.net} across ${impact.count} txn(s)`,
  );
  const onPlatform = await disputeIsVisibleToPlatform(chargeId);
  check('the dispute is INVISIBLE to a platform-scoped lookup', !onPlatform, onPlatform ? 'platform can see it — the model is wrong' : 'not on the platform');
  console.log('        (the act’s share is owed by the venue under the agreement and is untouched by Stripe;');
  console.log('         the settlement statement charges a lost chargeback under 7.2, and a person reads it)');
}

async function main() {
  const account = await stripe.accounts.retrieve();
  console.log(`Stripe test-mode dispute walk — account ${account.id}`);
  console.log('One REAL test dispute is created below; it stays open in the sandbox.');

  await legVenueKeepsAll();

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    console.error('\nA failure here means a real dispute would land on a different balance');
    console.error('than the settlement design assumes.');
    process.exit(1);
  }
  console.log('\nThe dispute model holds: a chargeback on a ticket is the venue’s (and under');
  console.log('Stripe-managed risk, Stripe’s beyond that). iHYPE holds no ticket money to lose.');
}

main().catch((error) => {
  console.error(`\nDispute walk aborted: ${error.message}`);
  process.exit(1);
});
