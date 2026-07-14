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
 * venue) instead of the charter's 45/45/10 split. The full charge now
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
