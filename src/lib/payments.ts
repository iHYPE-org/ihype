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
  const paymentsFlagOff = !isExplicitlyEnabled(readRuntimeEnv('FEATURE_ENABLE_TICKET_PAYMENTS'));
  if (paymentsFlagOff) {
    blockers.push('Set FEATURE_ENABLE_TICKET_PAYMENTS=true only when paid ticketing is approved for launch.');
  }

  /* REHEARSAL ESCAPE HATCH, deliberately narrow. The money-path rehearsal has
     to run against the real production worker build — src/lib/db.ts's wasm
     engine cannot load under `next dev` (measured 2026-08-28) — and a
     production build has NODE_ENV=production baked in, so the test-key refusal
     below made the rehearsal impossible against the only build that can run.
     This variable is set only by the local rehearsal tooling against a scratch
     database. Two rails keep it out of production: lint-source.mjs fails the
     build if wrangler.toml ever defines it (the same guard the FEATURE flag
     has), and even if it leaked, it only permits a TEST key — it can never
     make a live key more capable. */
  const rehearsalTestMode =
    readRuntimeEnv('STRIPE_ALLOW_TEST_MODE_REHEARSAL') === 'true';
  if (!stripeSecretKey?.startsWith('sk_')) {
    blockers.push('Set STRIPE_SECRET_KEY to a valid sk_ secret.');
  } else if (
    process.env.NODE_ENV === 'production' &&
    stripeSecretKey.startsWith('sk_test_') &&
    !rehearsalTestMode
  ) {
    blockers.push('Production paid ticketing requires a live Stripe secret key, not sk_test_.');
  }

  if (!stripeWebhookSecret?.startsWith('whsec_')) {
    blockers.push('Set STRIPE_WEBHOOK_SECRET so ticket/payment webhooks can be verified.');
  }

  /* WHY THIS FLAG IS SEPARATED FROM THE OTHER BLOCKERS.
   *
   * "Not ready" has two completely different meanings here and callers were
   * treating them as one:
   *
   *   - The flag is off ON PURPOSE. Paid ticketing is closed until the money
   *     path has been rehearsed. This is the correct, approved state of
   *     production today, and nothing should alarm about it.
   *   - Something is MISCONFIGURED. The flag is on but a secret is missing, or
   *     production is holding a test key. That is a fault and must be loud.
   *
   * Collapsing the two made a correct production configuration fail the
   * post-deploy smoke test (which skipped the Cloudflare cache purge behind
   * it), and would have had the readiness cron email the administrators every
   * run, forever, about a state they chose. An alert that always fires is an
   * alert nobody reads — the same failure the connect-health cron had.
   *
   * A boolean rather than string-matching the blocker text at the call site:
   * the message is prose and will be reworded, and a check that silently stops
   * matching is worse than no check. */
  return {
    ready: blockers.length === 0,
    blockers,
    /** True when the ONLY thing standing between this deployment and taking
     *  payments is the deliberate feature flag. Everything else is configured.
     *  This is the intended state until the money-path runbook is walked. */
    paymentsDisabledByFlag: paymentsFlagOff && blockers.length === 1,
  };
}
