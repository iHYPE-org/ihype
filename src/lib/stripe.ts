import Stripe from 'stripe';
import { readRuntimeEnv } from '@/lib/runtime-env';

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
  const account = await stripe.accounts.create({
    type: 'express',
    email,
    capabilities: { transfers: { requested: true } },
    metadata: { profileId, profileType }
  });
  return account.id;
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
  const link = await stripe.accountLinks.create({
    account: connectAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding'
  });
  return link.url;
}

/**
 * "Separate charges and transfers" pattern — deliberately does NOT set
 * `transfer_data.destination`. A destination charge only supports ONE
 * Connect account per PaymentIntent, and (this codebase's real bug, fixed
 * here) omitting `transfer_data.amount` means Stripe transfers the ENTIRE
 * captured charge to that one account — so the previous version routed
 * 100% of every ticket sale to a single party (venue, or artist if no
 * venue) instead of the charter's 70/20/10 split. The full charge now
 * captures to the platform's own Stripe balance; the actual per-party
 * split is paid out afterward as real `stripe.transfers.create()` calls
 * (see `createPayoutTransfer` below), one per `AccountsPayableEntry`,
 * driven by `src/lib/show-payouts.ts`.
 */
export async function createTicketPaymentIntent({
  amountCents,
  stripeCustomerId,
  paymentMethodId,
  showId,
  ticketOrderConfirmationCode,
  venuePayoutCents,
  artistPayoutCents
}: {
  amountCents: number;
  stripeCustomerId: string;
  paymentMethodId: string;
  showId: string;
  ticketOrderConfirmationCode: string;
  venuePayoutCents: number;
  artistPayoutCents: number;
}): Promise<{ paymentIntentId: string; status: Stripe.PaymentIntent.Status }> {
  const stripe = getStripe();

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: 'usd',
      capture_method: 'manual',
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      confirm: true,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/shows/${showId}`,
      metadata: {
        confirmationCode: ticketOrderConfirmationCode,
        showId,
        venuePayoutCents: String(venuePayoutCents),
        artistPayoutCents: String(artistPayoutCents)
      }
    },
    { idempotencyKey: `ticket-order:${ticketOrderConfirmationCode}` }
  );

  return { paymentIntentId: paymentIntent.id, status: paymentIntent.status };
}

export async function createTicketCheckoutSession({
  amountCents,
  stripeCustomerId,
  showId,
  showSlug,
  showTitle,
  quantity,
  ticketOrderConfirmationCode,
}: {
  amountCents: number;
  stripeCustomerId: string;
  showId: string;
  showSlug: string;
  showTitle: string;
  quantity: number;
  ticketOrderConfirmationCode: string;
}): Promise<{ checkoutUrl: string; checkoutSessionId: string }> {
  const stripe = getStripe();
  const baseUrl = readRuntimeEnv('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000';
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
        metadata: { confirmationCode: ticketOrderConfirmationCode, showId },
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
): Promise<string> {
  const stripe = getStripe();
  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      ...(amountCents !== null ? { amount: amountCents } : {}),
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
 * ever completes checkout — same as `createTicketPaymentIntent`, just via
 * the Checkout Session wrapper instead of a directly-confirmed PaymentIntent.
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
  await stripe.accounts.del(connectAccountId);
}

export function constructWebhookEvent(payload: string, signature: string): Stripe.Event {
  const stripe = getStripe();
  const secret = readRuntimeEnv('STRIPE_WEBHOOK_SECRET');
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
