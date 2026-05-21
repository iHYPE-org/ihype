export function isPaymentProcessingConfigured() {
  return getPaymentProcessingReadiness().ready;
}

export function getPaymentProcessingReadiness() {
  const blockers: string[] = [];

  if (!process.env.STRIPE_SECRET_KEY?.trim().startsWith('sk_')) {
    blockers.push('Set STRIPE_SECRET_KEY to a valid sk_ secret.');
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET?.trim().startsWith('whsec_')) {
    blockers.push('Set STRIPE_WEBHOOK_SECRET so ticket/payment webhooks can be verified.');
  }

  return {
    ready: blockers.length === 0,
    blockers
  };
}

export function assertPaymentProcessingConfigured() {
  if (!isPaymentProcessingConfigured()) {
    throw new Error('Ticket payment capture requires STRIPE_SECRET_KEY in production environment variables.');
  }
}
