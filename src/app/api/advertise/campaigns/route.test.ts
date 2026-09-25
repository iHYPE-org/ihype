import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/* The campaign routes are the only two places a Stripe checkout for an ad is
   created from a member's request. Inside the iOS or Android app they must
   refuse (DESIGN_SYNC row 514) — and only there: a browser, on a phone or a
   desktop, keeps buying exactly as before. */

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
const consumeRateLimit = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: (...a: unknown[]) => consumeRateLimit(...a),
  rateLimitKey: vi.fn().mockReturnValue('k'),
}));
vi.mock('@/lib/request-meta', () => ({ readClientAddress: vi.fn().mockReturnValue('127.0.0.1') }));
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/ad-campaign-notify', () => ({ notifyAdvertiser: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/defer-work', () => ({ deferWork: vi.fn() }));
vi.mock('@/lib/runtime-flags', () => ({ isAdvertisingEnabledRuntime: vi.fn().mockResolvedValue(true) }));
vi.mock('@/lib/ad-vetting', () => ({
  vetAdvertisement: vi.fn(),
  vetAdAudioContent: vi.fn(),
  adCampaignStatusFromVetting: vi.fn(),
}));
const createAdCampaignCheckoutSession = vi.fn();
vi.mock('@/lib/stripe', () => ({
  createAdCampaignCheckoutSession: (...a: unknown[]) => createAdCampaignCheckoutSession(...a),
  settleAdCampaign: vi.fn(),
}));
const adFindUnique = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    ad: {
      findUnique: (...a: unknown[]) => adFindUnique(...a),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: 'ad-1' }),
    },
  },
}));

const { auth } = await import('@/lib/auth');
const { POST, PATCH } = await import('./route');

const APP_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 iHYPEApp/1';
const SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

function request(method: 'POST' | 'PATCH', body: unknown, userAgent: string) {
  return new NextRequest('https://ihype.org/api/advertise/campaigns', {
    method,
    headers: { 'content-type': 'application/json', 'user-agent': userAgent },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: 'advertiser-1', email: 'a@example.com' } } as never);
  adFindUnique.mockResolvedValue({
    advertiserId: 'advertiser-1', status: 'AWAITING_PAYMENT', endsAt: null, pausedAt: null, title: 'Spot',
    budgetCents: 2500, spentCents: 0, stripePaymentIntentId: null, settledAt: null, pricingModel: 'SPONSORSHIP', runDays: 30,
  });
});

describe('campaign routes inside the iOS and Android apps', () => {
  it('refuses to create a campaign from the app, before any metered work', async () => {
    const res = await POST(request('POST', { title: 'Spot' }, APP_UA));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'CAMPAIGNS_WEB_ONLY' });
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(createAdCampaignCheckoutSession).not.toHaveBeenCalled();
  });

  it('refuses to start a checkout for an unpaid campaign from the app', async () => {
    const res = await PATCH(request('PATCH', { id: 'ad-1', action: 'retry-checkout' }, APP_UA));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'CAMPAIGNS_WEB_ONLY' });
    expect(adFindUnique).not.toHaveBeenCalled();
    expect(createAdCampaignCheckoutSession).not.toHaveBeenCalled();
  });

  it('still lets the app pause, resume or cancel — none of them sells anything', async () => {
    const res = await PATCH(request('PATCH', { id: 'ad-1', action: 'pause' }, APP_UA));
    expect(res.status).not.toBe(403);
    expect(adFindUnique).toHaveBeenCalledTimes(1);
  });

  it('lets a phone BROWSER start a checkout exactly as before', async () => {
    createAdCampaignCheckoutSession.mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test' });
    const res = await PATCH(request('PATCH', { id: 'ad-1', action: 'retry-checkout' }, SAFARI_UA));
    expect(res.status).not.toBe(403);
    expect(createAdCampaignCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it('does not refuse a browser create on the app rule', async () => {
    const res = await POST(request('POST', { title: 'Spot' }, SAFARI_UA));
    expect(res.status).not.toBe(403);
    expect(consumeRateLimit).toHaveBeenCalledTimes(1);
  });
});
