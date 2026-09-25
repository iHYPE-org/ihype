import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role, TicketOrderStatus } from '@prisma/client/edge';

// Mirrors the mocking pattern in src/lib/__tests__/show-payouts.test.ts —
// every dependency the route touches is mocked so this test exercises only
// the route handler's own orchestration (readiness gate, rate limit, Stripe
// authorize/capture/cancel sequencing, rollback on decline), not the
// lower-level DB/Stripe helpers, which already have their own unit tests
// (ticket-order-state.test.ts, payments.test.ts).

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/payments', () => ({ getPaymentProcessingReadiness: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  rateLimitKey: vi.fn().mockReturnValue('ticket-purchase:user:user_1'),
  consumeDualRateLimit: vi.fn().mockResolvedValue({ allowed: true, scope: null, result: { allowed: true } }),
}));
// The bot check is exercised on its own in the anti-bot suite below; these
// tests are about the Stripe/reservation path, so it passes here.
vi.mock('@/lib/turnstile', () => ({ verifyTurnstileToken: vi.fn().mockResolvedValue(true) }));
vi.mock('@/lib/mailer', () => ({ sendIssuedTicketEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/notify', () => ({ notifyUser: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/request-location', () => ({ detectLocationFromHeaders: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/request-meta', () => ({ readClientAddress: vi.fn().mockReturnValue('127.0.0.1') }));
vi.mock('@/lib/tickets', () => ({
  buildTicketQrCodeDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,stub'),
  buildTicketVerificationUrl: vi.fn().mockReturnValue('https://ihype.org/verify/stub'),
  formatTicketStatus: vi.fn().mockReturnValue('Captured'),
}));
vi.mock('@/lib/ticketing', () => ({
  ARTIST_SHARE_PERCENT: 75,
  VENUE_SHARE_PERCENT: 25,
  calculateTicketOrderFinancials: vi.fn().mockReturnValue({
    subtotalCents: 2000,
    localCents: 0,
    stateCents: 0,
    countryCents: 0,
    internationalCents: 0,
    totalTaxCents: 0,
    totalChargeCents: 2000,
    venuePayoutCents: 400,
    artistPayoutCents: 1600,
    promoterPayoutCents: 0,
  }),
  formatCurrencyFromCents: vi.fn((cents: number) => `$${(cents / 100).toFixed(2)}`),
}));

const getOrCreateStripeCustomer = vi.fn().mockResolvedValue('cus_existing');
/* Defaults to MERCHANT-ready: since 2026-09-25 the venue is the merchant on
   every sale and a show whose venue is not ready sells nothing, so the ready
   venue is the state every purchase-path test starts from. The refusal gets
   its own tests below. */
const isConnectMerchantReady = vi.fn().mockResolvedValue(true);
const createVenueDirectCheckoutSession = vi.fn();
vi.mock('@/lib/stripe', () => ({
  createVenueDirectCheckoutSession: (...args: unknown[]) => createVenueDirectCheckoutSession(...args),
  getOrCreateStripeCustomer: (...args: unknown[]) => getOrCreateStripeCustomer(...args),
  isConnectMerchantReady: (...args: unknown[]) => isConnectMerchantReady(...args),
}));

const voidReservedTicketOrder = vi.fn().mockResolvedValue(true);
vi.mock('@/lib/ticket-order-state', () => ({
  voidReservedTicketOrder: (...args: unknown[]) => voidReservedTicketOrder(...args),
}));

const dbShowUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
const dbTicketOrderCreate = vi.fn();
const dbTicketOrderAggregate = vi.fn().mockResolvedValue({ _sum: { quantity: 0 } });
const dbTicketOrderUpdate = vi.fn().mockResolvedValue({});
const dbUserUpdate = vi.fn().mockResolvedValue({});
const dbUserFindUnique = vi.fn();
const dbShowFindUnique = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: (...a: unknown[]) => dbUserFindUnique(...a), update: (...a: unknown[]) => dbUserUpdate(...a) },
    show: { findUnique: (...a: unknown[]) => dbShowFindUnique(...a) },
    profile: { findUnique: vi.fn() },
    ticketOrder: {
      update: (...a: unknown[]) => dbTicketOrderUpdate(...a),
    },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        // Both call sites in the route pass a callback; give it a tx stub
        // shaped like what show.updateMany / ticketOrder.create / the
        // mocked ticket-order-state helpers actually need.
        return arg({
          show: { updateMany: dbShowUpdateMany },
          ticketOrder: {
            create: (...a: unknown[]) => dbTicketOrderCreate(...a),
            // Per-show, per-account cap. Zero held by default so these tests
            // stay about the payment path.
            aggregate: (...a: unknown[]) => dbTicketOrderAggregate(...a),
          },
        });
      }
      throw new Error('unexpected $transaction call shape in test');
    }),
  },
}));

vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));

import { auth } from '@/lib/auth';
import { getPaymentProcessingReadiness } from '@/lib/payments';
import { POST } from './route';

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockReadiness = getPaymentProcessingReadiness as unknown as ReturnType<typeof vi.fn>;

function baseUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user_1',
    email: 'fan@ihype.org',
    username: 'fan1',
    name: 'Fan One',
    role: Role.FAN,
    emailVerified: new Date(),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    storedPaymentTokenRef: 'pm_stored',
    stripeCustomerId: 'cus_existing',
    ...overrides,
  };
}

function baseShow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'show_1',
    slug: 'neon-night',
    title: 'Neon Night',
    status: 'LIVE', // captures immediately (shouldCaptureTicketsNow)
    ticketingOpensAt: null,
    isTicketed: true,
    ticketPriceCents: 2000,
    ticketCapacity: 100,
    venuePayoutPercent: 20,
    artistPayoutPercent: 80,
    promoterPayoutPercent: null,
    venueProfile: { id: 'venue_1', name: 'The Venue', postalCode: null, stateRegion: null, country: null, stripeConnectAccountId: 'acct_venue', ownerId: 'owner_venue' },
    headlinerProfile: { id: 'artist_1', name: 'Headliner', stripeConnectAccountId: 'acct_artist', ownerId: 'owner_artist' },
    promoterProfile: null,
    ...overrides,
  };
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('https://ihype.org/api/shows/show_1/tickets', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ showId: 'show_1' }) };

beforeEach(() => {
  vi.clearAllMocks();
  isConnectMerchantReady.mockResolvedValue(true);
  createVenueDirectCheckoutSession.mockResolvedValue({ checkoutSessionId: 'cs_direct', checkoutUrl: 'https://checkout.stripe.com/test' });
  mockAuth.mockResolvedValue({ user: { id: 'user_1' } });
  mockReadiness.mockReturnValue({ ready: true });
  dbUserFindUnique.mockResolvedValue(baseUser());
  dbShowFindUnique.mockResolvedValue(baseShow());
  dbTicketOrderCreate.mockResolvedValue({
    id: 'order_1',
    confirmationCode: 'ABCD1234',
    showId: 'show_1',
    buyerUserId: 'user_1',
    buyerEmail: 'fan@ihype.org',
    buyerName: 'Fan One',
  });
});

describe('POST /api/shows/[showId]/tickets', () => {
  it('returns 503 without touching Stripe when payment processing is not ready', async () => {
    mockReadiness.mockReturnValue({ ready: false });

    const res = await POST(makeRequest({ quantity: 1 }), params);

    expect(res.status).toBe(503);
    expect(createVenueDirectCheckoutSession).not.toHaveBeenCalled();
  });

  it('reserves inventory and returns secure hosted checkout', async () => {
    createVenueDirectCheckoutSession.mockResolvedValue({ checkoutSessionId: 'cs_test', checkoutUrl: 'https://checkout.stripe.com/test' });

    const res = await POST(makeRequest({ quantity: 1 }), params);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.captureMode).toBe('checkout');
    expect(json.checkoutUrl).toBe('https://checkout.stripe.com/test');
    expect(createVenueDirectCheckoutSession).toHaveBeenCalledTimes(1);
    expect(voidReservedTicketOrder).not.toHaveBeenCalled();
  });

  it('answers 503 PAYMENTS_UNAVAILABLE, not 500, when Stripe cannot be reached — and the reservation is voided', async () => {
    createVenueDirectCheckoutSession.mockRejectedValue(Object.assign(new Error('An error occurred with our connection to Stripe.'), { type: 'StripeConnectionError' }));

    const res = await POST(makeRequest({ quantity: 1 }), params);
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.code).toBe('PAYMENTS_UNAVAILABLE');
    expect(res.headers.get('retry-after')).toBe('120');
    expect(voidReservedTicketOrder).toHaveBeenCalledTimes(1);
  });

  it('still answers 500 for an error that is not Stripe being unavailable', async () => {
    createVenueDirectCheckoutSession.mockRejectedValue(Object.assign(new Error('No such customer'), { type: 'StripeInvalidRequestError' }));
    const res = await POST(makeRequest({ quantity: 1 }), params);
    expect(res.status).toBe(500);
  });

  describe('the venue is the merchant on every sale', () => {
    beforeEach(() => {
      /* vi.clearAllMocks() clears CALLS, not implementations, so a readiness
         set false in one test would leak into the next. */
      isConnectMerchantReady.mockResolvedValue(true);
    });

    it('charges on the venue account and claims only the artist share', async () => {
      const res = await POST(makeRequest({ quantity: 1 }), params);
      expect(res.status).toBe(201);

      const [call] = createVenueDirectCheckoutSession.mock.calls.at(-1) as [Record<string, unknown>];
      expect(call.venueAccountId).toBe('acct_venue');
      expect(call.artistPayoutCents).toBe(1600);
      expect(call).not.toHaveProperty('promoterPayoutCents');
      // Selected on card_payments, never on the payout capability.
      expect(isConnectMerchantReady).toHaveBeenCalledWith('acct_venue');

      const [{ data }] = dbTicketOrderCreate.mock.calls.at(-1) as [{ data: Record<string, unknown> }];
      expect(data.settlementMode).toBe('VENUE_DIRECT');
      expect(data.settlementAccountId).toBe('acct_venue');
    });

    it('computes the sale under the charter split, not the show row', async () => {
      // The row carries 20/80 here; the sale is made under 75/25.
      const { calculateTicketOrderFinancials } = await import('@/lib/ticketing');
      await POST(makeRequest({ quantity: 1 }), params);
      const [input] = vi.mocked(calculateTicketOrderFinancials).mock.calls.at(-1) as [Record<string, unknown>];
      expect(input.artistPayoutPercent).toBe(75);
      expect(input.venuePayoutPercent).toBe(25);
    });

    it('refuses a sale, holding nothing, when the venue is not ready to be the merchant', async () => {
      /* A venue that finished recipient onboarding alone is payout-ready and
         still cannot take a charge; the old fallbacks (a destination charge to
         the act, or iHYPE as merchant) are gone, so the sale waits. */
      isConnectMerchantReady.mockResolvedValue(false);

      const res = await POST(makeRequest({ quantity: 1 }), params);
      expect(res.status).toBe(409);
      expect((await res.json()).code).toBe('VENUE_NOT_PAYMENT_READY');
      expect(dbTicketOrderCreate).not.toHaveBeenCalled();
      expect(dbShowUpdateMany).not.toHaveBeenCalled();
      expect(createVenueDirectCheckoutSession).not.toHaveBeenCalled();
    });

    it('refuses a sale when the show has no venue on iHYPE', async () => {
      dbShowFindUnique.mockResolvedValueOnce(baseShow({ venueProfile: null }));
      const res = await POST(makeRequest({ quantity: 1 }), params);
      expect(res.status).toBe(409);
      expect((await res.json()).code).toBe('VENUE_NOT_PAYMENT_READY');
      expect(isConnectMerchantReady).not.toHaveBeenCalled();
      expect(dbTicketOrderCreate).not.toHaveBeenCalled();
    });

    it('answers 503, holding nothing, when Stripe cannot be reached for the merchant check', async () => {
      isConnectMerchantReady.mockRejectedValue(Object.assign(new Error('An error occurred with our connection to Stripe.'), { type: 'StripeConnectionError' }));
      const res = await POST(makeRequest({ quantity: 1 }), params);
      expect(res.status).toBe(503);
      expect((await res.json()).code).toBe('PAYMENTS_UNAVAILABLE');
      expect(dbTicketOrderCreate).not.toHaveBeenCalled();
      expect(voidReservedTicketOrder).not.toHaveBeenCalled();
    });
  });

  it('rolls back the reservation when hosted checkout creation fails', async () => {
    createVenueDirectCheckoutSession.mockRejectedValue(new Error('Stripe API unreachable'));

    const res = await POST(makeRequest({ quantity: 1 }), params);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBeTruthy();
    expect(voidReservedTicketOrder).toHaveBeenCalledWith(expect.anything(), 'order_1');
  });

  it('rolls back the reservation when Stripe authorization itself throws', async () => {
    createVenueDirectCheckoutSession.mockRejectedValue(new Error('Stripe API unreachable'));

    const res = await POST(makeRequest({ quantity: 1 }), params);

    expect(res.status).toBe(500);
    expect(voidReservedTicketOrder).toHaveBeenCalledWith(expect.anything(), 'order_1');
  });

  it('rejects non-fan accounts before ever calling Stripe', async () => {
    dbUserFindUnique.mockResolvedValue(baseUser({ role: Role.ARTIST }));

    const res = await POST(makeRequest({ quantity: 1 }), params);

    expect(res.status).toBe(403);
    expect(createVenueDirectCheckoutSession).not.toHaveBeenCalled();
  });
});

// ── Anti-bot guards ────────────────────────────────────────────────────────
// Ticket bots are an economic problem: resale is what makes hoarding pay, so
// the purchase endpoint is the chokepoint. Each of these asserts a REFUSAL —
// a guard nothing proves refuses is decoration.
describe('POST /api/shows/[showId]/tickets — anti-bot guards', () => {
  it('refuses a purchase that fails the bot check, before touching Stripe', async () => {
    const { verifyTurnstileToken } = await import('@/lib/turnstile');
    vi.mocked(verifyTurnstileToken).mockResolvedValueOnce(false);

    const response = await POST(
      new Request('http://localhost/api/shows/show_1/tickets', {
        method: 'POST',
        body: JSON.stringify({ quantity: 2 }),
      }),
      { params: Promise.resolve({ showId: 'show_1' }) },
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('BOT_CHECK_FAILED');
    // The point of ordering the check first: no customer created, no hold.
    expect(getOrCreateStripeCustomer).not.toHaveBeenCalled();
    expect(createVenueDirectCheckoutSession).not.toHaveBeenCalled();
  });

  it('refuses when either rate-limit bucket is exhausted', async () => {
    const { consumeDualRateLimit } = await import('@/lib/rate-limit');
    vi.mocked(consumeDualRateLimit).mockResolvedValueOnce({
      allowed: false,
      scope: 'ip',
      result: { allowed: false, retryAfterSeconds: 900 },
    } as Awaited<ReturnType<typeof consumeDualRateLimit>>);

    const response = await POST(
      new Request('http://localhost/api/shows/show_1/tickets', {
        method: 'POST',
        body: JSON.stringify({ quantity: 1 }),
      }),
      { params: Promise.resolve({ showId: 'show_1' }) },
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('900');
    expect(createVenueDirectCheckoutSession).not.toHaveBeenCalled();
  });

  it('refuses once the account already holds the per-show maximum', async () => {
    // 8 held, asking for 1 more.
    dbTicketOrderAggregate.mockResolvedValueOnce({ _sum: { quantity: 8 } });

    const response = await POST(
      new Request('http://localhost/api/shows/show_1/tickets', {
        method: 'POST',
        body: JSON.stringify({ quantity: 1 }),
      }),
      { params: Promise.resolve({ showId: 'show_1' }) },
    );

    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.code).toBe('TICKET_LIMIT_REACHED');
    // The message has to name the limit, or a real buyer cannot act on it.
    expect(body.error).toContain('8');
    // Inventory must not have been consumed by a refused purchase.
    expect(dbTicketOrderCreate).not.toHaveBeenCalled();
  });

  it('counts tickets already held rather than only this order', async () => {
    // 6 held + 3 requested = 9, over the cap, even though 3 alone is fine.
    dbTicketOrderAggregate.mockResolvedValueOnce({ _sum: { quantity: 6 } });

    const response = await POST(
      new Request('http://localhost/api/shows/show_1/tickets', {
        method: 'POST',
        body: JSON.stringify({ quantity: 3 }),
      }),
      { params: Promise.resolve({ showId: 'show_1' }) },
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('2 more');
  });

  it('rejects a quantity above the per-order maximum at the schema', async () => {
    const response = await POST(
      new Request('http://localhost/api/shows/show_1/tickets', {
        method: 'POST',
        body: JSON.stringify({ quantity: 50 }),
      }),
      { params: Promise.resolve({ showId: 'show_1' }) },
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(createVenueDirectCheckoutSession).not.toHaveBeenCalled();
  });
});
