import { readRuntimeEnv } from '@/lib/runtime-env';

function isExplicitlyEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === 'true';
}

export function isPaymentProcessingConfigured() {
  return getPaymentProcessingReadiness().ready;
}

export function getPaymentProcessingReadiness() {
  const blockers: string[] = [];
  // Read through readRuntimeEnv: both of these are Worker *secrets*, which
  // never appear on process.env in workerd. Reading process.env alone made
  // this report "Set STRIPE_SECRET_KEY..." even when the secret was set,
  // which hides the real buy button behind a "Paid tickets · Coming soon"
  // placeholder on every show page.
  const stripeSecretKey = readRuntimeEnv('STRIPE_SECRET_KEY');
  const stripeWebhookSecret = readRuntimeEnv('STRIPE_WEBHOOK_SECRET');

  // FEATURE_ENABLE_TICKET_PAYMENTS is a plain var in wrangler.toml, not a
  // secret, but route it through the same helper so all three agree on where
  // configuration comes from.
  if (!isExplicitlyEnabled(readRuntimeEnv('FEATURE_ENABLE_TICKET_PAYMENTS'))) {
    blockers.push('Set FEATURE_ENABLE_TICKET_PAYMENTS=true only when paid ticketing is approved for launch.');
  }

  if (!stripeSecretKey?.startsWith('sk_')) {
    blockers.push('Set STRIPE_SECRET_KEY to a valid sk_ secret.');
  } else if (process.env.NODE_ENV === 'production' && stripeSecretKey.startsWith('sk_test_')) {
    blockers.push('Production paid ticketing requires a live Stripe secret key, not sk_test_.');
  }

  if (!stripeWebhookSecret?.startsWith('whsec_')) {
    blockers.push('Set STRIPE_WEBHOOK_SECRET so ticket/payment webhooks can be verified.');
  }

  return {
    ready: blockers.length === 0,
    blockers,
  };
}
