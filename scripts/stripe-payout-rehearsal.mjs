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
 *   1. A PaymentIntent with NO `transfer_data` captures in full to the
 *      platform balance. (This is the "separate charges and transfers" premise
 *      the whole split rests on.) It is written with `capture_method: 'manual'`
 *      so authorization and capture can be asserted separately — note that the
 *      LIVE ticket path does not: `createTicketCheckoutSession` sets no capture
 *      method, so a real ticket captures on payment. What is being rehearsed
 *      here is where the money lands, which is identical either way.
 *   2. Three transfers — 70/20/10 of the captured amount — succeed against
 *      connected accounts and sum to exactly the captured total, with the
 *      last one absorbing the rounding remainder.
 *   3. Those transfers are idempotent: replaying one with the same
 *      idempotency key returns the same transfer id rather than paying twice.
 *   4. A captured PaymentIntent refunds in full.
 *   5. An authorized-but-uncaptured PaymentIntent can be partially captured
 *      (the ad-settlement path, which captures only delivered spend) and can
 *      be cancelled outright (the release-the-hold path).
 *   6. DESTINATION mode: a charge with `transfer_data.destination` and an
 *      `application_fee_amount` routes exactly the act's share to the act and
 *      keeps the rest on the platform — NOT the whole charge, which is the
 *      2026-07-14 bug this shape replaced. Refunding it with
 *      `reverse_transfer`/`refund_application_fee` unwinds the act too, rather
 *      than leaving the platform to fund the whole refund alone.
 *   7. VENUE_DIRECT mode: a charge created ON the venue's account really does
 *      live there and not on the platform, and the `application_fee_amount`
 *      carrying the artist's 70% and the promoter's 10% really does land in
 *      the PLATFORM balance where the payout cron can transfer it onward.
 *
 * Steps 1-5 rehearse settlement mode PLATFORM, which is the FALLBACK. Steps 6
 * and 7 rehearse the two modes a real sale is expected to take. A run that
 * skips 6 and 7 for want of connected accounts has proved the fallback and
 * nothing else — do not read it as a green light.
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
 *
 * Step 7 additionally needs one account with an active `card_payments`
 * capability — a MERCHANT, which is a strictly higher bar than the `transfers`
 * capability steps 2 and 6 need. Pass it explicitly if the auto-detection
 * picks the wrong one:
 *   REHEARSAL_MERCHANT_ACCOUNT=acct_venue
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
/* Steps 6 and 7 skip when no suitable connected account exists, and a skip is
   not a failure — nobody can conjure an onboarded venue out of a script. But a
   silent skip that still exits 0 is how this codebase has twice ended up
   trusting a green tick that measured nothing (the gated CI stages, the
   redirect entry in the Lighthouse set). So a run that could not exercise the
   modes a real sale takes exits 2: not a failure, not a pass either. */
const skippedModes = [];

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
  // The platform-settled shape: no transfer_data, so the whole charge lands on
  // the platform balance. Manual capture is this script's own choice, not the
  // live path's — it lets authorization and capture be asserted as two steps.
  // Modes 2 and 3 are rehearsed in steps 6 and 7.
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

  // Transfers draw on the AVAILABLE balance, and every test-mode card charge
  // above (pm_card_visa) lands as PENDING — so on a fresh sandbox this step
  // always fails with "insufficient available funds" (measured 2026-08-30).
  // Stripe's documented fix is a charge on the bypass-pending test card
  // (4000 0000 0000 0077), which settles immediately. Test mode only by
  // construction: the key guard at the top refuses anything but sk_test_.
  const availableUsd = async () =>
    (await stripe.balance.retrieve()).available.find((b) => b.currency === 'usd')?.amount ?? 0;
  let available = await availableUsd();
  // The top-up charge itself pays Stripe's fee (2.9% + 30c in test mode), so
  // funding the bare shortfall leaves the balance ~3% short — measured on the
  // first local run (2026-08-30): funded 5895 against -895, transfers still
  // refused. Gross up for the fee, then re-check rather than assume.
  for (let funding = 0; available < captured.amount_received && funding < 2; funding += 1) {
    const shortfall = captured.amount_received - available;
    const gross = Math.ceil((shortfall + 30) / 0.971) + 100;
    const topUp = await stripe.paymentIntents.create(
      {
        amount: gross,
        currency: 'usd',
        payment_method: 'pm_card_bypassPending',
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: { rehearsal: 'true', purpose: 'available-balance-top-up' },
      },
      { idempotencyKey: `topup:${captured.id}:${funding}` }
    );
    console.log(`        (available balance was ${available}; funded ${topUp.amount_received} gross via the bypass-pending test card)`);
    // The Balance API lags the charge by several seconds — measured
    // 2026-08-30: three top-ups fired in three seconds, each against the
    // same stale reading, and the transfer still found nothing. Poll for the
    // funds to actually show before concluding more funding is needed.
    for (let i = 0; i < 60 && available < captured.amount_received; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      available = await availableUsd();
    }
    console.log(`        (available balance now ${available})`);
  }

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

async function resolveMerchantAccount() {
  const fromEnv = (process.env.REHEARSAL_MERCHANT_ACCOUNT ?? '').trim();
  if (fromEnv) return fromEnv;
  const existing = await stripe.accounts.list({ limit: 100 });
  // card_payments, not transfers. An account can be payable and still be
  // unable to be the merchant on a charge, which is exactly the distinction
  // isConnectPayoutReady() vs. the venue-direct branch turns on.
  const merchant = existing.data.find((a) => a.capabilities?.card_payments === 'active');
  return merchant?.id ?? null;
}

async function step6DestinationCharge(accounts) {
  console.log('\n[6] DESTINATION mode routes the act\'s share and no more');
  if (!accounts) {
    console.log('  SKIP  depends on the connected accounts step 2 needs.');
    skippedModes.push('DESTINATION');
    return;
  }
  const actAccount = accounts[0];
  const actShareCents = Math.floor((TICKET_AMOUNT_CENTS * 70) / 100);
  // calculateDestinationChargeSplit(): the fee is what is LEFT, computed by
  // subtraction. An addition that forgot a component would not fail here; it
  // would quietly overpay the act. Restated so a drift fails an assertion.
  const applicationFeeCents = TICKET_AMOUNT_CENTS - actShareCents;

  const code = `rehearsal-dest-${Date.now()}`;
  const intent = await stripe.paymentIntents.create(
    {
      amount: TICKET_AMOUNT_CENTS,
      currency: 'usd',
      payment_method: 'pm_card_visa',
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      transfer_data: { destination: actAccount },
      application_fee_amount: applicationFeeCents,
      metadata: { confirmationCode: code, settlementMode: 'destination', rehearsal: 'true' },
    },
    { idempotencyKey: `ticket-destination:${code}` },
  );
  check('destination charge succeeds', intent.status === 'succeeded', intent.status);
  check(
    'iHYPE stays the settlement merchant (no on_behalf_of)',
    !intent.on_behalf_of,
    `on_behalf_of=${intent.on_behalf_of ?? 'unset'}`,
  );

  // The transfer attaches to the charge moments AFTER the PaymentIntent
  // confirms — an immediate readback reported "no transfer" on the first real
  // run (2026-08-30) while the object demonstrably existed a minute later.
  // Poll briefly instead of trusting the first read.
  let charge = null;
  let transfer = null;
  for (let i = 0; i < 10 && !transfer; i += 1) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
    charge = await stripe.charges.retrieve(String(intent.latest_charge), { expand: ['transfer'] });
    transfer = charge.transfer && typeof charge.transfer === 'object' ? charge.transfer : null;
  }
  check('a transfer to the act was created', Boolean(transfer), transfer ? transfer.id : 'none');
  // THE ASSERTION THIS STEP EXISTS FOR — stated per Stripe's documented
  // mechanics: with application_fee_amount the FULL charge amount transfers
  // to the destination and the fee is then pulled back to the platform, so
  // the act's share is the NET of the two. (The first version of this check
  // expected transfer.amount === the share, which can never be true in this
  // shape.) The 2026-07-14 bug was this transfer with NO fee coming back.
  check(
    'the act nets their share, not the whole charge',
    transfer?.amount === TICKET_AMOUNT_CENTS && transfer.amount - applicationFeeCents === actShareCents,
    `transferred=${transfer?.amount}, fee back=${applicationFeeCents}, net=${(transfer?.amount ?? 0) - applicationFeeCents} expected=${actShareCents}`,
  );
  check(
    'the platform keeps the remainder as an application fee',
    charge.application_fee_amount === applicationFeeCents,
    `fee=${charge.application_fee_amount} expected=${applicationFeeCents}`,
  );

  // refundTicketPaymentIntent({ wasDestinationCharge: true }). Without these
  // two flags a refunded ticket returns the full face value out of a balance
  // that only ever received the fee, and the act keeps their share.
  const refund = await stripe.refunds.create(
    { payment_intent: intent.id, reverse_transfer: true, refund_application_fee: true },
    { idempotencyKey: `refund:${intent.id}:full` },
  );
  check('destination refund succeeds', refund.status === 'succeeded' || refund.status === 'pending', `status=${refund.status}`);
  const afterRefund = transfer ? await stripe.transfers.retrieve(transfer.id) : null;
  // Boolean(afterRefund) matters: with no transfer this used to compare
  // undefined === undefined and PASS while measuring nothing.
  check(
    'the refund pulls the act\'s share back too',
    Boolean(afterRefund) && afterRefund.amount_reversed === afterRefund.amount,
    `reversed=${afterRefund?.amount_reversed} of ${afterRefund?.amount}`,
  );
}

async function step7VenueDirectCharge(merchantAccount) {
  console.log('\n[7] VENUE_DIRECT mode puts the charge on the venue and the fee on the platform');
  if (!merchantAccount) {
    console.log('  SKIP  no connected account has an active `card_payments` capability.');
    console.log('        This is a HIGHER bar than the transfers capability steps 2 and 6 use: a');
    console.log('        venue-direct charge needs a full-service-agreement merchant, which means');
    console.log('        completing hosted onboarding with the merchant configuration requested.');
    console.log('        Create one, then re-run with:');
    console.log('          REHEARSAL_MERCHANT_ACCOUNT=acct_venue');
    console.log('        Until this step runs, the mode a real sale is expected to take is unproven.');
    skippedModes.push('VENUE_DIRECT');
    return;
  }

  // calculateDirectChargeApplicationFee(): a SUM of the two onward shares, not
  // total - venue. The venue keeps what it is not charged, so the platform
  // must name what it takes rather than what the venue receives.
  const artistCents = Math.floor((TICKET_AMOUNT_CENTS * 70) / 100);
  const promoterCents = Math.floor((TICKET_AMOUNT_CENTS * 10) / 100);
  const applicationFeeCents = artistCents + promoterCents;
  check(
    'the application fee claims the two onward shares and nothing else',
    applicationFeeCents < TICKET_AMOUNT_CENTS,
    `fee=${applicationFeeCents} of ${TICKET_AMOUNT_CENTS}, venue keeps the rest less Stripe's cut`,
  );

  const code = `rehearsal-direct-${Date.now()}`;
  const intent = await stripe.paymentIntents.create(
    {
      amount: TICKET_AMOUNT_CENTS,
      currency: 'usd',
      payment_method: 'pm_card_visa',
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      application_fee_amount: applicationFeeCents,
      metadata: { confirmationCode: code, settlementMode: 'venue_direct', rehearsal: 'true' },
    },
    {
      // The header is the whole difference. Without it this is an ordinary
      // platform charge carrying a nonsensical fee, and iHYPE is silently the
      // merchant again — which looks completely normal until a chargeback.
      stripeAccount: merchantAccount,
      idempotencyKey: `ticket-direct:${merchantAccount}:${code}`,
    },
  );
  check('direct charge succeeds', intent.status === 'succeeded', intent.status);

  // The merchant role really moved: the charge is not on the platform at all.
  // A platform-scoped lookup must fail, and that failure is the pass.
  let visibleToPlatform = true;
  try {
    await stripe.paymentIntents.retrieve(intent.id);
  } catch {
    visibleToPlatform = false;
  }
  check(
    'the charge lives on the venue, not the platform',
    !visibleToPlatform,
    visibleToPlatform ? 'platform can read it — the stripeAccount header did not apply' : `${intent.id} is invisible to the platform`,
  );

  // Options are the THIRD argument on retrieve(); passed second, stripeAccount
  // is sent to the API as a request parameter and rejected ("Received unknown
  // parameter"), which aborted the first real run of this step (2026-08-30).
  const charge = await stripe.charges.retrieve(String(intent.latest_charge), {}, { stripeAccount: merchantAccount });
  check(
    'the venue is charged the application fee',
    charge.application_fee_amount === applicationFeeCents,
    `fee=${charge.application_fee_amount} expected=${applicationFeeCents}`,
  );

  // And it landed on the PLATFORM, which is what makes the split payable.
  // Application fees are readable platform-side by definition; if this is
  // empty the money is somewhere the payout cron cannot reach.
  // Same async attach as step 6: the ApplicationFee object is created moments
  // after the charge, and the first real run (2026-08-30) read it back too
  // early and reported "no application fee object on the platform" while the
  // fee existed. Poll the venue-side charge until it names the fee.
  let feeId = charge.application_fee;
  for (let i = 0; i < 10 && !feeId; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const again = await stripe.charges.retrieve(String(intent.latest_charge), {}, { stripeAccount: merchantAccount });
    feeId = again.application_fee;
  }
  const fee = feeId ? await stripe.applicationFees.retrieve(typeof feeId === 'string' ? feeId : feeId.id) : null;
  check(
    'the fee lands in the platform balance, where the payout cron can transfer it',
    fee?.amount === applicationFeeCents,
    fee ? `application_fee ${fee.id} = ${fee.amount}` : 'no application fee object on the platform',
  );
  console.log(`        Onward: artist ${artistCents}, promoter ${promoterCents}. The transfer mechanism`);
  console.log('        itself is the one step 2 and step 3 already proved — same createPayoutTransfer().');
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
  await step6DestinationCharge(accounts);
  await step7VenueDirectCharge(await resolveMerchantAccount());

  for (const fn of cleanup) await fn().catch(() => {});

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    console.error('\nA failure here means the application would behave the same way against live money.');
    process.exit(1);
  }
  console.log('\nStripe-side semantics hold. Still unverified: the database state transitions in');
  console.log('triggerShowPayouts()/refundCapturedTicketOrder(), which need a staging DB to exercise.');
  if (skippedModes.length > 0) {
    console.error(`\nINCOMPLETE — could not rehearse: ${skippedModes.join(', ')}.`);
    console.error('Those are the settlement modes a real sale is expected to take. What ran was the');
    console.error('PLATFORM fallback. Onboard the connected accounts named above and run this again');
    console.error('before treating the money path as rehearsed. Exiting 2 rather than 0 so this');
    console.error('cannot be mistaken for a pass by anything reading the exit code.');
    process.exit(2);
  }
  console.log('All three settlement modes rehearsed: PLATFORM, DESTINATION, VENUE_DIRECT.');
}

main().catch((error) => {
  console.error('\nRehearsal aborted:', error?.message ?? error);
  process.exit(1);
});
