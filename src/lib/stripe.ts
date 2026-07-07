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

/**
 * Create or retrieve a Stripe Customer for a fan user.
 * Stores the customer ID on the User row so we never create duplicates.
 */
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

  if (existingCustomerId) {
    return existingCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { userId }
  });

  return customer.id;
}

/**
 * Create a Stripe Connect Express account for an artist, venue, or promoter profile.
 * Returns the account ID to store on the Profile row.
 */
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
    capabilities: {
      transfers: { requested: true }
    },
    metadata: { profileId, profileType }
  });

  return account.id;
}

/**
 * Create an onboarding link for a Connect Express account.
 */
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
 * Create a PaymentIntent for a ticket reservation.
 * Uses manual capture so we only charge when the venue opens the event.
 */
export async function createTicketPaymentIntent({
  amountCents,
  stripeCustomerId,
  paymentMethodId,
  showId,
  ticketOrderConfirmationCode,
  venueConnectAccountId,
  artistConnectAccountId,
  venuePayoutCents,
  artistPayoutCents
}: {
  amountCents: number;
  stripeCustomerId: string;
  paymentMethodId: string;
  showId: string;
  ticketOrderConfirmationCode: string;
  venueConnectAccountId: string | null | undefined;
  artistConnectAccountId: string | null | undefined;
  venuePayoutCents: number;
  artistPayoutCents: number;
}): Promise<{ paymentIntentId: string }> {
  const stripe = getStripe();

  const primaryConnectAccountId = venueConnectAccountId ?? artistConnectAccountId;

  const paymentIntent = await stripe.paymentIntents.create({
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
    },
    ...(primaryConnectAccountId
      ? {
          transfer_data: {
            destination: primaryConnectAccountId
          }
        }
      : {})
  });

  return { paymentIntentId: paymentIntent.id };
}

/**
 * Capture a previously authorized PaymentIntent when the event goes live.
 */
export async function captureTicketPaymentIntent(paymentIntentId: string): Promise<void> {
  const stripe = getStripe();
  await stripe.paymentIntents.capture(paymentIntentId);
}

/**
 * Cancel a PaymentIntent (for voided orders).
 */
export async function cancelTicketPaymentIntent(paymentIntentId: string): Promise<void> {
  const stripe = getStripe();
  await stripe.paymentIntents.cancel(paymentIntentId);
}

/**
 * Verify a Stripe webhook signature and return the event.
 */
export function constructWebhookEvent(payload: string, signature: string): Stripe.Event {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
