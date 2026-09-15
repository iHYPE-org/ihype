import { beforeEach, describe, expect, it, vi } from 'vitest';

// This route's first test. What it guards is the window between "Stripe has
// created a live account" and "we have written its id down" — the only place
// in the product where a failure leaves a real object at a payment processor
// with nothing here naming it.

const auth = vi.fn();
vi.mock('@/lib/auth', () => ({ auth: () => auth() }));

const isStripeConfigured = vi.fn().mockReturnValue(true);
const createStripeConnectAccount = vi.fn();
const createConnectOnboardingUrl = vi.fn().mockResolvedValue('https://connect.stripe.com/setup/x');
vi.mock('@/lib/stripe', () => ({
  isStripeConfigured: () => isStripeConfigured(),
  createStripeConnectAccount: (...a: unknown[]) => createStripeConnectAccount(...a),
  createConnectOnboardingUrl: (...a: unknown[]) => createConnectOnboardingUrl(...a),
}));

const logError = vi.fn();
vi.mock('@/lib/logger', () => ({ log: { error: (...a: unknown[]) => logError(...a) } }));

const profileFindUnique = vi.fn();
const profileUpdate = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    profile: {
      findUnique: (...a: unknown[]) => profileFindUnique(...a),
      update: (...a: unknown[]) => profileUpdate(...a),
    },
  },
}));

import { POST } from './route';

const PROFILE = {
  id: 'prof_1',
  type: 'ARTIST',
  name: 'Test Act',
  slug: 'test-act',
  stripeConnectAccountId: null as string | null,
  stripeConnectOnboarded: false,
  owner: { id: 'user_1', email: 'act@ihype.org' },
};

function makeRequest(body: unknown) {
  return new Request('https://ihype.org/api/stripe/connect/onboard', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  isStripeConfigured.mockReturnValue(true);
  auth.mockResolvedValue({ user: { id: 'user_1', role: 'ARTIST' } });
  profileFindUnique.mockResolvedValue({ ...PROFILE });
  createStripeConnectAccount.mockResolvedValue('acct_new');
  profileUpdate.mockResolvedValue({});
  createConnectOnboardingUrl.mockResolvedValue('https://connect.stripe.com/setup/x');
});

describe('POST /api/stripe/connect/onboard', () => {
  it('creates the account, stores its id, and hands back an onboarding link', async () => {
    const res = await POST(makeRequest({ profileId: 'prof_1' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ onboardingUrl: 'https://connect.stripe.com/setup/x' });
    expect(profileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'prof_1' }, data: { stripeConnectAccountId: 'acct_new' } }),
    );
  });

  it('names the orphaned account when the profile write fails, and does not hand out a link', async () => {
    /* The account is live at Stripe by this point. If the id is not in the
       log it is in nothing: not the database, not the response, not the
       error. An operator finds it by the metadata.profileId this message
       names, so both ids have to be in it. A link would be worse than the
       500 — `connect/return` verifies against `stripeConnectAccountId`,
       which is still null, so the member would finish a flow that cannot
       complete. */
    profileUpdate.mockRejectedValue(new Error('connection terminated'));

    const res = await POST(makeRequest({ profileId: 'prof_1' }));

    expect(res.status).toBe(500);
    expect(createConnectOnboardingUrl).not.toHaveBeenCalled();
    const message = String(logError.mock.calls.at(-1)?.[0]);
    expect(message).toContain('acct_new');
    expect(message).toContain('prof_1');
  });

  it('never creates a second account for a profile that already has one', async () => {
    profileFindUnique.mockResolvedValue({ ...PROFILE, stripeConnectAccountId: 'acct_existing' });

    const res = await POST(makeRequest({ profileId: 'prof_1' }));

    expect(res.status).toBe(200);
    expect(createStripeConnectAccount).not.toHaveBeenCalled();
    expect(profileUpdate).not.toHaveBeenCalled();
    expect(createConnectOnboardingUrl).toHaveBeenCalledWith(
      expect.objectContaining({ connectAccountId: 'acct_existing' }),
    );
  });

  it('refuses a profile the caller does not own', async () => {
    auth.mockResolvedValue({ user: { id: 'someone_else', role: 'ARTIST' } });

    const res = await POST(makeRequest({ profileId: 'prof_1' }));

    expect(res.status).toBe(403);
    expect(createStripeConnectAccount).not.toHaveBeenCalled();
  });
});
