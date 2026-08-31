#!/usr/bin/env node
/**
 * The dispute walk — the last unchecked box before runbook step 3.
 *
 * Everything about the settlement design is an argument about who eats a
 * chargeback: VENUE_DIRECT exists because a dispute on a direct charge is
 * debited from the VENUE (and under Stripe-managed risk an unrecoverable
 * shortfall is Stripe's), while DESTINATION and PLATFORM leave it with iHYPE
 * — which is what the 1.5% reserve is priced against. Stripe's docs say so
 * (quoted in docs/runbooks/money-path-rehearsal.md), a support conversation
 * said so, and until this script ran nothing had ever MEASURED it.
 *
 * This automates the measurement half of the runbook's by-hand dashboard
 * walk: it buys with Stripe's dispute test card (4000 0000 0000 0259 —
 * `pm_card_createDispute`: the charge succeeds and is then disputed as
 * fraudulent) once as a direct charge on the venue and once as a destination
 * charge on the platform, waits for each dispute to exist, and reads WHOSE
 * balance carries the disputed amount and the dispute fee off the dispute's
 * own balance_transactions. The judgement about what the numbers mean stays
 * with a person; the numbers themselves are printed here.
 *
 * If the venue-direct dispute lands on the PLATFORM's balance, the settlement
 * model is wrong and every number in the runbook is wrong with it.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_… \
 *   REHEARSAL_MERCHANT_ACCOUNT=acct_venue REHEARSAL_ARTIST_ACCOUNT=acct_act \
 *   npm run stripe:disputes
 *
 * Residue: two open test disputes stay in the sandbox (they can be responded
 * to or ignored; test mode only). This script refuses any key that is not
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
const ARTIST = (process.env.REHEARSAL_ARTIST_ACCOUNT ?? '').trim();
if (!VENUE || !ARTIST) {
  console.error('Set REHEARSAL_MERCHANT_ACCOUNT (a card_payments-active venue) and');
  console.error('REHEARSAL_ARTIST_ACCOUNT (a transfers-active act). Both legs need one.');
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
 *  seconds, occasionally longer. Poll rather than trusting any single read,
 *  the same lesson every readback in the payout rehearsal taught. */
async function waitForDispute(chargeId, scope) {
  for (let i = 0; i < 48; i += 1) {
    const disputes = scope
      ? await stripe.disputes.list({ charge: chargeId, limit: 1 }, scope)
      : await stripe.disputes.list({ charge: chargeId, limit: 1 });
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

async function disputeIsVisible(chargeId, scope) {
  const disputes = scope
    ? await stripe.disputes.list({ charge: chargeId, limit: 1 }, scope)
    : await stripe.disputes.list({ charge: chargeId, limit: 1 });
  return Boolean(disputes.data[0]);
}

async function legVenueDirect() {
  console.log('\n[1] VENUE_DIRECT: the dispute is the venue’s, not the platform’s');
  const intent = await stripe.paymentIntents.create(
    {
      amount: AMOUNT,
      currency: 'usd',
      payment_method: 'pm_card_createDispute',
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      // The same fee shape createVenueDirectCheckoutSession gives a real sale:
      // the artist's 70% and the promoter's 10% claimed by the platform.
      application_fee_amount: Math.floor((AMOUNT * 80) / 100),
      metadata: { rehearsal: 'true', purpose: 'dispute-walk-venue-direct' },
    },
    { stripeAccount: VENUE, idempotencyKey: `dispute-walk-venue:${Date.now()}` },
  );
  check('disputed-card charge succeeds on the venue', intent.status === 'succeeded', intent.status);

  const chargeId = String(intent.latest_charge);
  const dispute = await waitForDispute(chargeId, { stripeAccount: VENUE });
  check('a dispute exists on the VENUE’s account', Boolean(dispute), dispute ? `${dispute.id} (${dispute.status})` : 'none after 4 minutes');
  if (!dispute) return;

  const impact = describeImpact(dispute);
  check(
    'the disputed amount is debited from the VENUE’s balance',
    impact.amount === -AMOUNT,
    `balance_transactions on the venue: amount=${impact.amount}, dispute fee=${impact.fee}, net=${impact.net}`,
  );
  console.log(`        (the dispute fee of ${impact.fee} was billed on the venue’s side of the ledger)`);

  const onPlatform = await disputeIsVisible(chargeId, undefined);
  check('the dispute is INVISIBLE to a platform-scoped lookup', !onPlatform, onPlatform ? 'platform can see it — the model is wrong' : 'not on the platform');
}

async function legDestination() {
  console.log('\n[2] DESTINATION: the dispute is the platform’s — the exposure the 1.5% reserve prices');
  const intent = await stripe.paymentIntents.create(
    {
      amount: AMOUNT,
      currency: 'usd',
      payment_method: 'pm_card_createDispute',
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      transfer_data: { destination: ARTIST },
      application_fee_amount: AMOUNT - Math.floor((AMOUNT * 70) / 100),
      metadata: { rehearsal: 'true', purpose: 'dispute-walk-destination' },
    },
    { idempotencyKey: `dispute-walk-dest:${Date.now()}` },
  );
  check('disputed-card destination charge succeeds', intent.status === 'succeeded', intent.status);

  const chargeId = String(intent.latest_charge);
  const dispute = await waitForDispute(chargeId, undefined);
  check('a dispute exists on the PLATFORM’s account', Boolean(dispute), dispute ? `${dispute.id} (${dispute.status})` : 'none after 4 minutes');
  if (!dispute) return;

  const impact = describeImpact(dispute);
  check(
    'the disputed amount AND the dispute fee are debited from the PLATFORM’s balance',
    impact.amount === -AMOUNT && impact.fee > 0,
    `balance_transactions on the platform: amount=${impact.amount}, dispute fee=${impact.fee}, net=${impact.net}`,
  );

  const onArtist = await disputeIsVisible(chargeId, { stripeAccount: ARTIST });
  check('the act’s account carries NO dispute for it', !onArtist, onArtist ? 'the act was debited — the model is wrong' : 'nothing on the act');
  console.log('        (the act’s transferred share is untouched by the dispute itself — recovering it');
  console.log('         is the reverse-transfer decision the webhook handler deliberately leaves to a person)');
}

async function main() {
  const account = await stripe.accounts.retrieve();
  console.log(`Stripe test-mode dispute walk — account ${account.id}`);
  console.log('Two REAL test disputes are created below; they stay open in the sandbox.');

  await legVenueDirect();
  await legDestination();

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    console.error('\nA failure here means a real dispute would land on a different balance');
    console.error('than the settlement design (and the reserve pricing) assumes.');
    process.exit(1);
  }
  console.log('\nBoth halves of the dispute model hold: a venue-direct chargeback is the');
  console.log('venue’s (and under Stripe-managed risk, Stripe’s beyond that); a destination');
  console.log('chargeback is iHYPE’s, which is what the 1.5% reserve exists to fund.');
}

main().catch((error) => {
  console.error(`\nDispute walk aborted: ${error.message}`);
  process.exit(1);
});
