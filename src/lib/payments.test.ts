import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPaymentProcessingReadiness } from '@/lib/payments';

/* EVERY INPUT TO THE DECISION IS PINNED HERE, INCLUDING THE ONE THAT TURNS IT
   OFF. `getPaymentProcessingReadiness()` reads five environment values and
   this map named four of them until 2026-09-15, so
   STRIPE_ALLOW_TEST_MODE_REHEARSAL — the hatch that makes a production build
   accept an `sk_test_` key — came from the ambient shell. #991 put it in the
   nightly's JOB env, which is every step's environment, and it inverted the
   assertion in "rejects Stripe test credentials when production ticketing is
   enabled": the guard for the exact rule the hatch bends was switched off by
   the hatch, and two nightlies died before reaching the walk.

   #992 scoped the variable to the walk step, which is right and is where it
   belongs. It is not sufficient: that fix lives in a YAML comment one repo
   convention away from being undone, and a developer with the hatch exported
   in their own shell reproduces the same red suite. Reproduced with

     STRIPE_ALLOW_TEST_MODE_REHEARSAL=true npx vitest run src/lib/payments.test.ts

   A TEST OF A SAFETY CHECK MUST PIN THE VARIABLE THAT DISABLES IT. Anything
   read from the ambient environment is an input the test does not control,
   and the one that can only ever weaken the check is the one that matters. */
const original = {
  NODE_ENV: process.env.NODE_ENV,
  FEATURE_ENABLE_TICKET_PAYMENTS: process.env.FEATURE_ENABLE_TICKET_PAYMENTS,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_ALLOW_TEST_MODE_REHEARSAL: process.env.STRIPE_ALLOW_TEST_MODE_REHEARSAL,
};

function setEnvironment(key: keyof typeof original, value: string | undefined) {
  const environment = process.env as unknown as Record<string, string | undefined>;
  if (value === undefined) delete environment[key];
  else environment[key] = value;
}

beforeEach(() => {
  /* The rehearsal hatch is absent unless a case deliberately sets it. */
  setEnvironment('STRIPE_ALLOW_TEST_MODE_REHEARSAL', undefined);
});

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    setEnvironment(key as keyof typeof original, value);
  }
});

describe('payment processing readiness', () => {
  it('stays disabled even when Stripe credentials are present until explicitly launched', () => {
    process.env.FEATURE_ENABLE_TICKET_PAYMENTS = 'false';
    process.env.STRIPE_SECRET_KEY = 'sk_test_example';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_example';

    const readiness = getPaymentProcessingReadiness();
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.join(' ')).toContain('FEATURE_ENABLE_TICKET_PAYMENTS=true');
  });

  it('requires both Stripe secrets after the launch switch is enabled', () => {
    process.env.FEATURE_ENABLE_TICKET_PAYMENTS = 'true';
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const readiness = getPaymentProcessingReadiness();
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toHaveLength(2);
  });

  it('lets the rehearsal hatch — and ONLY the hatch — accept a test key in a production build', () => {
    /* The hatch had no test of its own until 2026-09-15, which is how it came
       to be the thing that broke the suite: the nightly depends on it (a
       production build bakes in NODE_ENV=production, so without it every money
       item answers 503 and the walk's ticket journeys read BROKEN over a
       product that works — DESIGN_SYNC row 469), and nothing here said what it
       does. An escape hatch the nightly leans on is load-bearing code. */
    setEnvironment('NODE_ENV', 'production');
    setEnvironment('STRIPE_ALLOW_TEST_MODE_REHEARSAL', 'true');
    process.env.FEATURE_ENABLE_TICKET_PAYMENTS = 'true';
    process.env.STRIPE_SECRET_KEY = 'sk_test_example';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_example';

    expect(getPaymentProcessingReadiness().ready).toBe(true);
  });

  it('opens nothing else: the hatch cannot stand in for the launch flag', () => {
    /* It permits a TEST key and nothing more. If it ever also waved the
       launch switch through, a leaked variable would turn paid ticketing on
       rather than merely loosening which key is accepted. */
    setEnvironment('NODE_ENV', 'production');
    setEnvironment('STRIPE_ALLOW_TEST_MODE_REHEARSAL', 'true');
    process.env.FEATURE_ENABLE_TICKET_PAYMENTS = 'false';
    process.env.STRIPE_SECRET_KEY = 'sk_test_example';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_example';

    const readiness = getPaymentProcessingReadiness();
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.join(' ')).toContain('FEATURE_ENABLE_TICKET_PAYMENTS=true');
  });

  it('rejects Stripe test credentials when production ticketing is enabled', () => {
    setEnvironment('NODE_ENV', 'production');
    process.env.FEATURE_ENABLE_TICKET_PAYMENTS = 'true';
    process.env.STRIPE_SECRET_KEY = 'sk_test_example';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_example';

    const readiness = getPaymentProcessingReadiness();
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.join(' ')).toContain('live Stripe secret key');
  });

  it('is ready only when the switch and live-shaped credentials are configured', () => {
    setEnvironment('NODE_ENV', 'production');
    process.env.FEATURE_ENABLE_TICKET_PAYMENTS = 'true';
    process.env.STRIPE_SECRET_KEY = 'sk_live_example';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_example';

    expect(getPaymentProcessingReadiness()).toEqual({
      ready: true,
      blockers: [],
      // Fully configured, so there is nothing for the flag to be the sole
      // blocker of. See the comment in payments.ts for why this is separate.
      paymentsDisabledByFlag: false,
    });
  });

  it('separates "closed on purpose" from "misconfigured"', () => {
    /* This distinction is what the post-deploy smoke test and the readiness
       cron branch on. Collapsing them made a correct production deployment
       fail its own smoke test — skipping the Cloudflare cache purge behind
       it — and would have emailed the administrators daily about a state they
       chose. */
    setEnvironment('FEATURE_ENABLE_TICKET_PAYMENTS', 'false');
    setEnvironment('STRIPE_SECRET_KEY', 'sk_live_configured');
    setEnvironment('STRIPE_WEBHOOK_SECRET', 'whsec_configured');
    const closedOnPurpose = getPaymentProcessingReadiness();
    expect(closedOnPurpose.ready).toBe(false);
    expect(closedOnPurpose.paymentsDisabledByFlag).toBe(true);

    // A second blocker means something is actually wrong, and the flag is no
    // longer the sole reason — this must NOT read as the intended state.
    setEnvironment('STRIPE_SECRET_KEY', undefined);
    const alsoBroken = getPaymentProcessingReadiness();
    expect(alsoBroken.ready).toBe(false);
    expect(alsoBroken.paymentsDisabledByFlag).toBe(false);
    expect(alsoBroken.blockers.length).toBeGreaterThan(1);
  });
});
