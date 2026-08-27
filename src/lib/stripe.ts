import Stripe from 'stripe';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { calculateDestinationChargeSplit } from '@/lib/ticketing';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = readRuntimeEnv('STRIPE_SECRET_KEY');
    if (!key?.startsWith('sk_')) throw new Error('STRIPE_SECRET_KEY is not configured with a valid secret key.');
    /* Moves with the SDK, and is not free to choose. `Stripe.LatestApiVersion`
       is a SINGLE-LITERAL type in each release, so bumping the `stripe` package
       forces this string forward and typecheck fails until it matches — which
       is how the 22.3.2 -> 22.5.0 bump in #753 turned up as a red PR rather
       than a silent behaviour change.
       Worth knowing that it IS a behaviour change and not a version label: an
       API version fixes response shapes and defaults, so what actually
       verifies this is the Stripe-side rehearsal in
       docs/runbooks/money-path-rehearsal.md, not this file compiling. Live mode
       still holds zero PaymentIntents, so nothing in production has ever
       depended on the old version's shapes. */
    _stripe = new Stripe(key, { apiVersion: '2026-07-29.dahlia' });
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(readRuntimeEnv('STRIPE_SECRET_KEY')?.startsWith('sk_'));
}

export async function getOrCreateStripeCustomer({
  userId,
  email,
  name,
  existingCustomerId
}: {
  userId: string;
  email: string;
  name: string | null;
  existingCustomerId: string | null | undefined;
}): Promise<string> {
  const stripe = getStripe();
  if (existingCustomerId) return existingCustomerId;

  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { userId }
  });
  return customer.id;
}

export async function createPaymentMethodSetupSession({
  userId,
  stripeCustomerId,
  returnPath,
}: {
  userId: string;
  stripeCustomerId: string;
  returnPath: string;
}): Promise<string> {
  const stripe = getStripe();
  const baseUrl = readRuntimeEnv('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000';
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'setup',
      customer: stripeCustomerId,
      setup_intent_data: { metadata: { userId } },
      metadata: { purpose: 'ticket_payment_method', userId },
      success_url: `${baseUrl}${returnPath}${returnPath.includes('?') ? '&' : '?'}payment_method=saved`,
      cancel_url: `${baseUrl}${returnPath}${returnPath.includes('?') ? '&' : '?'}payment_method=cancelled`,
    },
    { idempotencyKey: `payment-method-setup:${userId}:${Date.now()}` },
  );

  if (!session.url) throw new Error('Stripe did not return a payment-method setup URL.');
  return session.url;
}

export async function createStripeConnectAccount({
  email,
  profileId,
  profileType
}: {
  email: string;
  profileId: string;
  profileType: string;
}): Promise<string> {
  const stripe = getStripe();
  /* ACCOUNTS V2, and v1 is not a fallback — it is CLOSED.
     `stripe.accounts.create({ type: 'express' })` returns an error, not a
     warning: "Stripe no longer recommends Accounts v1 for new Connect
     integrations." Verified 2026-08-26 by running the old call verbatim
     against a Connect-enabled test account. While it stood, no artist, venue
     or promoter could onboard at all, `stripeConnectAccountId` was never set,
     and every payable entry would have sat PENDING forever.

     TWO CONFIGURATIONS, and the reason is the whole payout design.

     `recipient` (`stripe_balance.stripe_transfers`) is what lets an account
     RECEIVE money from us. Every payee needs it. Do not reach for the legacy
     `transfers` capability: it is a different thing wearing a near-identical
     name, and `GET /v1/accounts` will happily report `transfers: "active"`
     for an account whose v2 recipient capabilities are empty and which Stripe
     refuses to transfer to. That misreading cost real debugging.

     `merchant` (`card_payments`) is what lets an account be the SETTLEMENT
     MERCHANT — the `on_behalf_of` on a destination charge, so the fan's
     statement carries the act's name and the act's 70% is routed by Stripe
     with the charge instead of passing through iHYPE's balance.

     This row used to say these accounts are "RECIPIENTS, not merchants", and
     that was right for the previous design and is wrong for this one. It is
     also not a free upgrade: `card_payments` is only available under the FULL
     service agreement, and an account on the `recipient` agreement can never
     request it (Stripe's own words). So the payee completes fuller KYC than a
     transfers-only recipient would. That is the price of delegating merchant
     of record, and it is deliberate.

     What it does NOT buy is dispute liability. Stripe debits disputes from the
     PLATFORM account on a destination charge "with or without on_behalf_of",
     so iHYPE still carries chargebacks and `responsibilities` below says so
     honestly. Recovery is a transfer reversal, best-effort, not a guarantee.

     `dashboard` is required whenever the transfers capability is requested,
     and the error saying so arrives only after everything else validates. */
  const account = await stripe.v2.core.accounts.create({
    contact_email: email,
    dashboard: 'express',
    identity: { country: 'us', entity_type: 'individual' },
    configuration: {
      recipient: {
        capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
      },
      merchant: {
        capabilities: { card_payments: { requested: true } },
      },
    },
    defaults: {
      currency: 'usd',
      responsibilities: { fees_collector: 'application', losses_collector: 'application' },
    },
    metadata: { profileId, profileType },
  });
  return account.id;
}

/**
 * Whether Stripe will actually accept a transfer to this account.
 *
 * This is the question `stripeConnectOnboarded` is meant to answer, and the
 * old signal answered a different one: the webhook set the flag from
 * `account.charges_enabled`, which is about accepting CARD PAYMENTS. A
 * recipient that has completed onboarding and can receive every transfer we
 * will ever send it still reports `charges_enabled: false`, because iHYPE
 * never asks for `card_payments`. So the flag could not become true, the
 * "Verified" pill in payout settings could never light up, and the Connect
 * health cron would have flagged every correctly-onboarded account as broken.
 *
 * Returns false rather than throwing on a Stripe error: a failed lookup means
 * "not proven ready", and the caller's job is to keep the member's own view
 * honest, not to abort their page.
 */
export async function isConnectPayoutReady(connectAccountId: string): Promise<boolean> {
  try {
    const stripe = getStripe();
    const account = await stripe.v2.core.accounts.retrieve(connectAccountId, {
      include: ['configuration.recipient'],
    });
    const transfers =
      account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers;
    return transfers?.status === 'active';
  } catch {
    return false;
  }
}

/**
 * Whether Stripe will accept this account as the SETTLEMENT MERCHANT of a
 * charge — the `on_behalf_of` on a destination charge.
 *
 * Deliberately separate from `isConnectPayoutReady` above, because they are
 * different questions and merging them would re-create the exact bug that
 * function's docstring describes. An account can be perfectly able to receive
 * every transfer we send and still not be able to settle a charge, and the
 * reverse is possible too while onboarding is partway through. A single
 * "onboarded" boolean cannot mean both.
 *
 * The caller that matters is the purchase route: if this is false the sale
 * must fall back to a platform-settled charge rather than failing, because a
 * fan should never be blocked by the act's paperwork.
 *
 * Returns false rather than throwing, same reason as above: a failed lookup
 * means "not proven ready".
 */
export async function isConnectSettlementReady(connectAccountId: string): Promise<boolean> {
  try {
    const stripe = getStripe();
    const account = await stripe.v2.core.accounts.retrieve(connectAccountId, {
      include: ['configuration.merchant'],
    });
    return account.configuration?.merchant?.capabilities?.card_payments?.status === 'active';
  } catch {
    return false;
  }
}

export async function createConnectOnboardingUrl({
  connectAccountId,
  returnUrl,
  refreshUrl
}: {
  connectAccountId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  /* v2 link for a v2 account — v1's `accountLinks.create` cannot onboard one,
     so this moved with the account creation above and not separately. The
     `configurations` list has to match what the account was created with. */
  const link = await stripe.v2.core.accountLinks.create({
    account: connectAccountId,
    use_case: {
      type: 'account_onboarding',
      account_onboarding: {
        // BOTH, matching the account above. A link that names only one
        // collects the wrong requirements and the missing capability never
        // activates — silently, because the member completes a flow that
        // looks finished.
        configurations: ['recipient', 'merchant'],
        refresh_url: refreshUrl,
        return_url: returnUrl,
      },
    },
  });
  return link.url;
}

/**
 * The ticket purchase — a DESTINATION CHARGE settled on behalf of the act when
 * one is settlement-ready, and a platform-settled charge when not.
 *
 * ## Why the act's share is routed by Stripe rather than paid out later
 *
 * On a destination charge Stripe moves the whole charge to the destination and
 * pulls `application_fee_amount` back to the platform. So the act's 70% never
 * passes through iHYPE's balance: it does not depend on a payout cron running,
 * on a later transfer succeeding, or on the platform being solvent in between.
 * `on_behalf_of` additionally makes the act the settlement merchant, so the
 * fan's statement carries their name.
 *
 * ## The warning that came with the old code, which still applies
 *
 * A destination charge supports exactly ONE connected account, and omitting
 * `transfer_data.amount` sends the ENTIRE charge to it — this codebase's
 * 2026-07-14 bug, which routed 100% of every sale to a single party. The fix is
 * not to route the whole charge but to claim the rest back as an application
 * fee, computed by `calculateDestinationChargeSplit` as `total - destination`:
 * that and `venue + promoter + tax + fee` are equal only while every component
 * is accounted for, and a subtraction cannot silently omit one. An addition
 * that forgot the tax would not fail — it would quietly overpay the act out of
 * money owed to a tax authority.
 *
 * ## What it does not do
 *
 * It does not move dispute liability. Stripe debits disputes from the PLATFORM
 * account on a destination charge "with or without on_behalf_of". iHYPE still
 * carries chargebacks; recovery is a best-effort transfer reversal.
 *
 * ## The fallback is not an error path
 *
 * `destinationAccountId` is optional. With no settlement-ready account this
 * behaves exactly as it did before — platform-settled, split afterwards through
 * `AccountsPayableEntry` — which is why that machinery stays. A fan is never
 * blocked by the act's paperwork.
 */
export async function createTicketCheckoutSession({
  amountCents,
  stripeCustomerId,
  showId,
  showSlug,
  showTitle,
  quantity,
  ticketOrderConfirmationCode,
  destinationAccountId,
  destinationPayoutCents,
}: {
  amountCents: number;
  stripeCustomerId: string;
  showId: string;
  showSlug: string;
  showTitle: string;
  quantity: number;
  ticketOrderConfirmationCode: string;
  /** The act's Connect account, when `isConnectSettlementReady` says so. */
  destinationAccountId?: string | null;
  /** What that account keeps, of FACE VALUE. Required with the account. */
  destinationPayoutCents?: number;
}): Promise<{ checkoutUrl: string; checkoutSessionId: string }> {
  const stripe = getStripe();
  const baseUrl = readRuntimeEnv('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000';

  /* Both or neither. An account with no amount would make Stripe transfer the
     ENTIRE charge — the 2026-07-14 bug exactly — so this refuses rather than
     defaulting, and refuses before the fan ever reaches a payment page. */
  const routed = destinationAccountId
    ? calculateDestinationChargeSplit({
        totalChargeCents: amountCents,
        destinationPayoutCents: destinationPayoutCents ?? -1,
      })
    : null;

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      customer: stripeCustomerId,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: `${quantity} × ${showTitle}`,
            metadata: { showId },
          },
        },
      }],
      payment_intent_data: {
        ...(routed && destinationAccountId
          ? {
              on_behalf_of: destinationAccountId,
              transfer_data: { destination: destinationAccountId },
              application_fee_amount: routed.applicationFeeCents,
            }
          : {}),
        metadata: {
          confirmationCode: ticketOrderConfirmationCode,
          showId,
          // Recorded on the intent so a reconciliation can tell a destination
          // charge from a platform-settled one without re-deriving it.
          settlementMode: routed ? 'destination' : 'platform',
        },
      },
      metadata: {
        purpose: 'ticket_purchase',
        confirmationCode: ticketOrderConfirmationCode,
        showId,
      },
      success_url: `${baseUrl}/shows/${showSlug}?checkout=success`,
      cancel_url: `${baseUrl}/shows/${showSlug}?checkout=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    },
    { idempotencyKey: `ticket-checkout:${ticketOrderConfirmationCode}` },
  );
  if (!session.url) throw new Error('Stripe did not return a ticket checkout URL.');
  return { checkoutUrl: session.url, checkoutSessionId: session.id };
}

/**
 * Real per-party payout — one Stripe transfer from the platform balance to
 * a venue or artist Connect account, for exactly their payable share of one
 * captured ticket order (an `AccountsPayableEntry` row). Idempotent per
 * entry via `transfer_group` + the entry's own id as the idempotency key,
 * so a retried payout run can never double-pay the same entry.
 */
export async function createPayoutTransfer({
  amountCents,
  connectAccountId,
  payableEntryId,
  showId,
  description
}: {
  amountCents: number;
  connectAccountId: string;
  payableEntryId: string;
  showId: string;
  description: string;
}): Promise<string> {
  const stripe = getStripe();
  const transfer = await stripe.transfers.create(
    {
      amount: amountCents,
      currency: 'usd',
      destination: connectAccountId,
      transfer_group: `show:${showId}`,
      description,
      metadata: { payableEntryId, showId }
    },
    { idempotencyKey: `payable-entry:${payableEntryId}` }
  );
  return transfer.id;
}

export async function captureTicketPaymentIntent(paymentIntentId: string): Promise<void> {
  const stripe = getStripe();
  await stripe.paymentIntents.capture(paymentIntentId, {}, { idempotencyKey: `capture:${paymentIntentId}` });
}

export async function cancelTicketPaymentIntent(paymentIntentId: string): Promise<void> {
  const stripe = getStripe();
  await stripe.paymentIntents.cancel(paymentIntentId, {}, { idempotencyKey: `cancel:${paymentIntentId}` });
}

/**
 * Full refund of a captured ticket order. Safe to call against the
 * PaymentIntent directly (rather than needing to reverse a transfer) as
 * long as no payout has happened yet — true by construction here, since
 * `triggerShowPayouts` only ever transfers money for ENDED shows, and this
 * is only ever called for orders more than 48h before their show starts.
 */
/**
 * Refunds a ticket order.
 *
 * `amountCents` is REQUIRED and is not a convenience. Stripe keeps its
 * processing fee on a refund — the money is already gone — so refunding the
 * full charge returns the buyer a fee Stripe never gives back, and the
 * difference comes out of the platform. iHYPE is a nonprofit that absorbs no
 * fee of any kind, so the caller states what is actually being returned:
 * normally face value plus taxes, with the processing fee retained because it
 * was consumed the moment the card was charged.
 *
 * Passing `null` refunds everything, which is a deliberate choice a caller has
 * to make in the open rather than the default it used to be.
 */
export async function refundTicketPaymentIntent(
  paymentIntentId: string,
  amountCents: number | null,
  options: { wasDestinationCharge?: boolean } = {},
): Promise<string> {
  const stripe = getStripe();
  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      ...(amountCents !== null ? { amount: amountCents } : {}),
      /* PULL THE ACT'S SHARE BACK TOO, on a destination charge.
       *
       * Stripe's default on a charge with `transfer_data.destination` is that
       * the destination KEEPS what it was transferred and the platform eats
       * the whole refund — so a refunded $18 ticket would return $18 to the
       * fan out of a balance that only ever received $6.25 of it, and the act
       * would keep their $12.60 for a show the fan is no longer attending.
       * Every refund would be a net loss of roughly the artist's share.
       *
       * `reverse_transfer` reverses proportionally, and
       * `refund_application_fee` returns the platform's share proportionally
       * as well, so a partial refund unwinds each party by the same fraction.
       * Stripe requires the transfer reversal whenever the application fee is
       * refunded, which is why these two are one flag here rather than two.
       *
       * If the act's balance cannot cover it they go negative, and Stripe
       * debits their bank only when `debit_negative_balances` is set. That is
       * the real limit of this: it makes recovery the default rather than a
       * guarantee.
       *
       * Deliberately NOT inferred from the PaymentIntent. Reading it back
       * would be a second network call on a path that already has the answer
       * stored on the order, and inferring money behaviour from a remote read
       * is how the `charges_enabled` mix-up happened. */
      ...(options.wasDestinationCharge
        ? { reverse_transfer: true, refund_application_fee: true }
        : {}),
    },
    // The key carries the amount: a partial refund followed by a different
    // partial refund on the same intent is two distinct operations, and
    // sharing a key would silently return the first one's result.
    { idempotencyKey: `refund:${paymentIntentId}:${amountCents ?? 'full'}` }
  );
  return refund.id;
}

/**
 * Pre-auth-then-capture ad campaign billing (DESIGN_SYNC row 234). A
 * Checkout Session in `mode: 'payment'` needs no client-side Stripe.js/
 * Elements integration (the advertiser is redirected to Stripe's own
 * hosted page) — a good fit for a self-serve B2B flow with no existing
 * card-collection UI in this codebase. `payment_intent_data.capture_method:
 * 'manual'` means the session's underlying PaymentIntent only ever
 * authorizes the full quoted budget; Stripe creates that PaymentIntent
 * synchronously, so its id is available immediately, before the advertiser
 * ever completes checkout — the same manual-capture shape the ticket checkout
 * session uses, and for the same reason.
 */
export async function createAdCampaignCheckoutSession({
  adId,
  amountCents,
  title,
  advertiserEmail,
  idempotencyKey,
}: {
  adId: string;
  amountCents: number;
  title: string;
  advertiserEmail: string | null;
  /** Defaults to one session per ad. Pass a fresh value (e.g. a timestamp)
   *  when the advertiser explicitly asks to retry — otherwise Stripe dedupes
   *  against the first (possibly abandoned/expired) session. */
  idempotencyKey?: string;
}): Promise<{ paymentIntentId: string; checkoutUrl: string }> {
  const stripe = getStripe();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ihype.org';

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: { name: `iHYPE ad campaign — ${title}` },
          },
          quantity: 1,
        },
      ],
      customer_email: advertiserEmail ?? undefined,
      payment_intent_data: {
        capture_method: 'manual',
        metadata: { adId },
      },
      metadata: { adId },
      success_url: `${baseUrl}/advertise/dashboard?checkout=success`,
      cancel_url: `${baseUrl}/advertise/dashboard?checkout=cancelled`,
    },
    { idempotencyKey: idempotencyKey ?? `ad-checkout:${adId}` },
  );

  if (typeof session.payment_intent !== 'string') {
    throw new Error('Checkout session did not return a payment intent id.');
  }

  return { paymentIntentId: session.payment_intent, checkoutUrl: session.url ?? '' };
}

/**
 * Captures only the actual delivered spend, never the full authorized
 * budget — the point of pre-auth-then-capture. Called at campaign end (the
 * settlement cron) or on early self-serve cancellation, in both cases with
 * whatever `spentCents` really is at that moment. Stripe rejects a capture
 * of 0, so a campaign that ran without ever serving an impression is
 * cancelled (releasing the hold) instead of captured.
 */
export async function settleAdCampaignAuthorization(paymentIntentId: string, spentCents: number): Promise<void> {
  const stripe = getStripe();
  if (spentCents <= 0) {
    await stripe.paymentIntents.cancel(paymentIntentId, {}, { idempotencyKey: `ad-settle-cancel:${paymentIntentId}` });
    return;
  }
  await stripe.paymentIntents.capture(
    paymentIntentId,
    { amount_to_capture: spentCents },
    { idempotencyKey: `ad-settle-capture:${paymentIntentId}` },
  );
}

/**
 * Deletes a Stripe Connect Express account, ending its ability to receive
 * future payouts. Called on account erasure (privacy-actions.ts) so an
 * erased identity can't keep collecting money after "deletion." Stripe
 * refuses deletion while a balance or pending payout exists — that's
 * surfaced to the caller rather than swallowed, since it means a human
 * needs to resolve the balance before the account can actually be closed.
 */
export async function deauthorizeStripeConnectAccount(connectAccountId: string): Promise<void> {
  const stripe = getStripe();
  // v2 accounts close rather than delete; `accounts.del` is the v1 verb and
  // does not apply to an account created by `createStripeConnectAccount`.
  await stripe.v2.core.accounts.close(connectAccountId, {
    applied_configurations: ['recipient'],
  });
}

export function constructWebhookEvent(payload: string, signature: string): Stripe.Event {
  const stripe = getStripe();
  const secret = readRuntimeEnv('STRIPE_WEBHOOK_SECRET');
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
