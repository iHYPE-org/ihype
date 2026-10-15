import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/runtime-env', () => ({ readRuntimeEnv: () => 'sk_test_local_fixture' }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Stripe 23 request compatibility', () => {
  it.each([true, false])('uses the Endive onboarding wire format (merchant intent %s)', async (merchantOnboarding) => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      object: 'v2.core.account_link', url: 'https://connect.stripe.test/onboarding',
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);
    const { createConnectOnboardingUrl } = await import('@/lib/stripe');
    const result = await createConnectOnboardingUrl({
      connectAccountId: 'acct_fixture',
      refreshUrl: 'https://ihype.test/api/stripe/connect/refresh?profileId=venue',
      returnUrl: 'https://ihype.test/api/stripe/connect/return?profileId=venue',
      merchantOnboarding,
    });
    expect(result).toBe('https://connect.stripe.test/onboarding');
    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toBe('https://api.stripe.com/v2/core/account_links');
    expect(new Headers(options.headers).get('Stripe-Version')).toBe('2026-09-30.endive');
    expect(JSON.parse(String(options.body))).toEqual({
      account: 'acct_fixture',
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          refresh_url: 'https://ihype.test/api/stripe/connect/refresh?profileId=venue',
          return_url: 'https://ihype.test/api/stripe/connect/return?profileId=venue',
        },
      },
    });
  });
});
