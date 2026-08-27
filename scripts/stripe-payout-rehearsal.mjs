#!/usr/bin/env node
/**
 * Stripe test-mode rehearsal for the money paths.
 *
 * Why this exists
 * ---------------
 * The ticket payout router, the real refund path, and the per-payable-entry
 * transfer were all written to replace code that was materially wrong (a
 * single `transfer_data.destination` sent 100% of every charge to one party
 * instead of the charter's 70/20/10 split, and nothing ever set an
 * AccountsPayableEntry to RELEASED, so no payout ever actually moved). That
 * rewrite has never executed against Stripe. As of this writing the live
 * account has zero PaymentIntents, zero connected accounts and a zero
 * balance — nothing has been sold yet, which makes now the cheapest possible
 * moment to find out whether the replacement works.
 *
 * What it rehearses
 * -----------------
 * The Stripe-side semantics the application depends on, with the same call
 * shapes src/lib/stripe.ts uses:
 *
 *   1. A ticket PaymentIntent created with `capture_method: 'manual'` and NO
 *      `transfer_data` captures in full to the platform balance. (This is the
 *      "separate charges and transfers" premise the whole split rests on.)
 *   2. Three transfers — 70/20/10 of the captured amount — succeed against
 *      connected accounts and sum to exactly the captured total, with the
 *      last one absorbing the rounding remainder.
 *   3. Those transfers are idempotent: replaying one with the same
 *      idempotency key returns the same transfer id rather than paying twice.
 *   4. A captured PaymentIntent refunds in full.
 *   5. An authorized-but-uncaptured PaymentIntent can be partially captured
 *      (the ad-settlement path, which captures only delivered spend) and can
 *      be cancelled outright (the release-the-hold path).
 *
 * What it does NOT prove
 * ----------------------
 * It does not run the application's own code — there is no database here, so
 * `triggerShowPayouts()` / `refundCapturedTicketOrder()` and their DB state
 * transitions are out of scope. It verifies that the Stripe operations those
 * functions issue behave as assumed. A full end-to-end run still needs a
 * staging database.
 *
 * Usage
 * -----
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-payout-rehearsal.mjs
 *
 * Optionally reuse already-onboarded test connected accounts (see step 2's
 * output if you don't have any):
 *   REHEARSAL_CONNECT_ACCOUNTS=acct_a,acct_b,acct_c
 */

import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY ?? '';

// Refuse to touch live money. This script creates charges, transfers and
// refunds; running it against a live key would be a real transaction against
// real cards and real connected accounts.
if (!KEY) {
  console.error('STRIPE_SECRET_KEY is not set. Export a TEST-mode key (sk_test_...).');
  process.exit(1);
}
if (!KEY.startsWith('sk_test_')) {
  console.error('Refusing to run: STRIPE_SECRET_KEY is not a test-mode key (expected sk_test_...).');
  console.error('This script creates charges, transfers and refunds. It must never run against live mode.');
  process.exit(1);
}

const stripe = new Stripe(KEY);

// 70/20/10, matching the charter and src/lib/ticket-order-state.ts. The last
// share absorbs the remainder so the parts always sum to the whole — the same
// rule buildPayableEntries() uses, restated here so a drift shows up as a
// failed assertion rather than as cents quietly going missing.
const TICKET_AMOUNT_CENTS = 5000;
const SPLIT = [
  { label: 'artist', percent: 70 },
  { label: 'venue', percent: 20 },
  { label: 'promoter', percent: 10 },
];

function splitCents(total, parts) {
  const out = parts.map((p) => ({ ...p, amount: Math.floor((total * p.percent) / 100) }));
  const assigned = out.reduce((sum, p) => sum + p.amount, 0);
  out[out.length - 1].amount += total - assigned;
  return out;
}

let passed = 0;
let failed = 0;
const cleanup = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function createAuthorizedTicketIntent(confirmationCode) {
  // Mirrors the platform-settled branch of createTicketCheckoutSession():
  // manual capture, no transfer_data. The destination-charge branch is
  // rehearsed separately once a settlement-ready account exists.
  return stripe.paymentIntents.create(
    {
      amount: TICKET_AMOUNT_CENTS,
      currency: 'usd',
      capture_method: 'manual',
      payment_method: 'pm_card_visa',
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { confirmationCode, rehearsal: 'true' },
    },
    { idempotencyKey: `ticket-order:${confirmationCode}` }
  );
}

async function step1CaptureToPlatform() {
  console.log('\n[1] Ticket PaymentIntent captures in full to the platform balance');
  const code = `rehearsal-${Date.now()}`;
  const intent = await createAuthorizedTicketIntent(code);
  check('authorizes without transfer_data', !intent.transfer_data, `status=${intent.status}`);
  check('requires capture (manual capture_method)', intent.status === 'requires_capture', intent.status);

  const captured = await stripe.paymentIntents.capture(intent.id, {}, { idempotencyKey: `capture:${intent.id}` });
  check('captures successfully', captured.status === 'succeeded', captured.status);
  check(
    'full amount captured to platform, not routed onward',
    captured.amount_received === TICKET_AMOUNT_CENTS && !captured.transfer_data,
    `amount_received=${captured.amount_received}`
  );
  return captured;
}

async function resolveConnectAccounts() {
  const fromEnv = (process.env.REHEARSAL_CONNECT_ACCOUNTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length >= 3) return fromEnv.slice(0, 3);

  const existing = await stripe.accounts.list({ limit: 100 });
  const payable = existing.data.filter((a) => a.capabilities?.transfers === 'active');
  if (payable.length >= 3) return payable.slice(0, 3).map((a) => a.id);

  return null;
}

async function step2SplitTransfers(captured, accounts) {
  console.log('\n[2] 70/20/10 transfers out of the platform balance');
  if (!accounts) {
    console.log('  SKIP  no connected account with an active `transfers` capability exists in this test account.');
    console.log('        Stripe will not transfer to an account that has not completed onboarding, so this');
    console.log('        step cannot be faked. Create three test Express accounts, complete the hosted');
    console.log('        onboarding for each with Stripe\'s test values, then re-run with:');
    console.log('          REHEARSAL_CONNECT_ACCOUNTS=acct_1,acct_2,acct_3');
    console.log('        The application has the same prerequisite: triggerShowPayouts() can pay nobody');
    console.log('        until at least one real profile finishes Connect onboarding.');
    return null;
  }

  const shares = splitCents(captured.amount_received, SPLIT);
  check(
    'split sums to the captured total with no leakage',
    shares.reduce((s, p) => s + p.amount, 0) === captured.amount_received,
    shares.map((s) => `${s.label}=${s.amount}`).join(' ')
  );

  const transfers = [];
  for (let i = 0; i < shares.length; i += 1) {
    const share = shares[i];
    const entryId = `${captured.id}-${share.label}`;
    // Mirrors createPayoutTransfer(): idempotency keyed on the payable entry.
    const transfer = await stripe.transfers.create(
      {
        amount: share.amount,
        currency: 'usd',
        destination: accounts[i],
        transfer_group: `show:rehearsal`,
        description: `Rehearsal ${share.label} share`,
        metadata: { payableEntryId: entryId, rehearsal: 'true' },
      },
      { idempotencyKey: `payable-entry:${entryId}` }
    );
    transfers.push({ share, transfer, entryId, destination: accounts[i] });
    check(`${share.label} transfer created`, transfer.amount === share.amount, `${transfer.id} amount=${transfer.amount}`);
  }
  return transfers;
}

async function step3TransferIdempotency(transfers) {
  console.log('\n[3] Replaying a payout does not double-pay');
  if (!transfers) {
    console.log('  SKIP  depends on step 2.');
    return;
  }
  const first = transfers[0];
  const replay = await stripe.transfers.create(
    {
      amount: first.share.amount,
      currency: 'usd',
      destination: first.destination,
      transfer_group: `show:rehearsal`,
      description: `Rehearsal ${first.share.label} share`,
      metadata: { payableEntryId: first.entryId, rehearsal: 'true' },
    },
    { idempotencyKey: `payable-entry:${first.entryId}` }
  );
  check('replay returns the original transfer', replay.id === first.transfer.id, `${replay.id} vs ${first.transfer.id}`);
}

async function step4Refund() {
  console.log('\n[4] Captured order refunds in full');
  const code = `rehearsal-refund-${Date.now()}`;
  const intent = await createAuthorizedTicketIntent(code);
  const captured = await stripe.paymentIntents.capture(intent.id, {}, { idempotencyKey: `capture:${intent.id}` });
  const refund = await stripe.refunds.create(
    { payment_intent: captured.id },
    { idempotencyKey: `refund:${captured.id}` }
  );
  check('refund succeeds', refund.status === 'succeeded' || refund.status === 'pending', `status=${refund.status}`);
  check('refund covers the full charge', refund.amount === TICKET_AMOUNT_CENTS, `amount=${refund.amount}`);
}

async function step5AdSettlement() {
  console.log('\n[5] Ad pre-auth settles for delivered spend, or releases');
  const partialCode = `rehearsal-ad-partial-${Date.now()}`;
  const authorized = await createAuthorizedTicketIntent(partialCode);
  const deliveredCents = Math.floor(TICKET_AMOUNT_CENTS / 4);
  const settled = await stripe.paymentIntents.capture(
    authorized.id,
    { amount_to_capture: deliveredCents },
    { idempotencyKey: `settle:${authorized.id}` }
  );
  check(
    'captures only delivered spend, releasing the rest of the hold',
    settled.amount_received === deliveredCents,
    `amount_received=${settled.amount_received} of authorized ${TICKET_AMOUNT_CENTS}`
  );

  const releaseCode = `rehearsal-ad-release-${Date.now()}`;
  const unspent = await createAuthorizedTicketIntent(releaseCode);
  const cancelled = await stripe.paymentIntents.cancel(unspent.id, {}, { idempotencyKey: `cancel:${unspent.id}` });
  check('unaired campaign releases the hold entirely', cancelled.status === 'canceled', cancelled.status);
}

async function main() {
  const account = await stripe.accounts.retrieve();
  console.log(`Stripe test-mode rehearsal — account ${account.id}`);
  console.log('No live-mode key can reach this point; every object below is test data.');

  const captured = await step1CaptureToPlatform();
  const accounts = await resolveConnectAccounts();
  const transfers = await step2SplitTransfers(captured, accounts);
  await step3TransferIdempotency(transfers);
  await step4Refund();
  await step5AdSettlement();

  for (const fn of cleanup) await fn().catch(() => {});

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    console.error('\nA failure here means the application would behave the same way against live money.');
    process.exit(1);
  }
  console.log('\nStripe-side semantics hold. Still unverified: the database state transitions in');
  console.log('triggerShowPayouts()/refundCapturedTicketOrder(), which need a staging DB to exercise.');
}

main().catch((error) => {
  console.error('\nRehearsal aborted:', error?.message ?? error);
  process.exit(1);
});
