import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key?.startsWith('sk_')) throw new Error('STRIPE_SECRET_KEY is not configured with a valid secret key.');
    _stripe = new Stripe(key, { apiVersion: '2026-06-24.dahlia' });
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim().startsWith('sk_'));
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

/**
 * Real per-party payout — one Stripe transfer from the platform balance to
 * a venue/artist/promoter's Connect account, for exactly their share of one
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
export async function refundTicketPaymentIntent(paymentIntentId: string): Promise<string> {
  const stripe = getStripe();
  const refund = await stripe.refunds.create(
    { payment_intent: paymentIntentId },
    { idempotencyKey: `refund:${paymentIntentId}` }
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
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
