function isExplicitlyEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === 'true';
}

export function isPaymentProcessingConfigured() {
  return getPaymentProcessingReadiness().ready;
}

export function getPaymentProcessingReadiness() {
  const blockers: string[] = [];

  if (!isExplicitlyEnabled(process.env.FEATURE_ENABLE_TICKET_PAYMENTS)) {
    blockers.push('Set FEATURE_ENABLE_TICKET_PAYMENTS=true only when paid ticketing is approved for launch.');
  }

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
    throw new Error('Paid ticketing is currently unavailable.');
  }
}
