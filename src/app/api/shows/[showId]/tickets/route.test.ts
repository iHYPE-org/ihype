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
}));
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

const createTicketPaymentIntent = vi.fn();
const captureTicketPaymentIntent = vi.fn().mockResolvedValue(undefined);
const cancelTicketPaymentIntent = vi.fn().mockResolvedValue(undefined);
const getOrCreateStripeCustomer = vi.fn().mockResolvedValue('cus_existing');
vi.mock('@/lib/stripe', () => ({
  createTicketPaymentIntent: (...args: unknown[]) => createTicketPaymentIntent(...args),
  captureTicketPaymentIntent: (...args: unknown[]) => captureTicketPaymentIntent(...args),
  cancelTicketPaymentIntent: (...args: unknown[]) => cancelTicketPaymentIntent(...args),
  getOrCreateStripeCustomer: (...args: unknown[]) => getOrCreateStripeCustomer(...args),
}));

const finalizeCapturedTicketOrder = vi.fn();
const voidReservedTicketOrder = vi.fn().mockResolvedValue(true);
vi.mock('@/lib/ticket-order-state', () => ({
  finalizeCapturedTicketOrder: (...args: unknown[]) => finalizeCapturedTicketOrder(...args),
  voidReservedTicketOrder: (...args: unknown[]) => voidReservedTicketOrder(...args),
}));

const dbShowUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
const dbTicketOrderCreate = vi.fn();
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
          ticketOrder: { create: (...a: unknown[]) => dbTicketOrderCreate(...a) },
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
    isEighteenOrOlder: true,
    storedPaymentTokenRef: 'pm_stored',
    stripeCustomerId: 'cus_existing',
    ...overrides,
  };
}

function baseShow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'show_1',
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
    expect(createTicketPaymentIntent).not.toHaveBeenCalled();
  });

  it('authorizes, captures, and finalizes on a successful charge', async () => {
    createTicketPaymentIntent.mockResolvedValue({ paymentIntentId: 'pi_ok', status: 'requires_capture' });
    finalizeCapturedTicketOrder.mockResolvedValue({
      tickets: [{ id: 't1', serializedId: 'ser1', status: 'CAPTURED' }],
    });

    const res = await POST(makeRequest({ quantity: 1 }), params);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.captureMode).toBe('captured');
    expect(captureTicketPaymentIntent).toHaveBeenCalledWith('pi_ok');
    expect(finalizeCapturedTicketOrder).toHaveBeenCalledTimes(1);
    // A successful charge must never trigger the decline-rollback path.
    expect(voidReservedTicketOrder).not.toHaveBeenCalled();
    expect(cancelTicketPaymentIntent).not.toHaveBeenCalled();
  });

  it('rolls back the reservation and cancels the hold when the card is declined', async () => {
    // Stripe returning anything other than 'requires_capture' after confirm
    // means the charge was NOT authorized (e.g. a decline) — the route must
    // treat this as a failure, not a success.
    createTicketPaymentIntent.mockResolvedValue({ paymentIntentId: 'pi_declined', status: 'requires_payment_method' });

    const res = await POST(makeRequest({ quantity: 1 }), params);
    const json = await res.json();

    expect(res.status).toBe(402);
    expect(json.code).toBe('PAYMENT_AUTHORIZATION_FAILED');
    // The reservation made just before authorization must be unwound, and
    // the (never-to-be-captured) payment intent hold released — otherwise a
    // declined card would silently eat ticket inventory forever.
    expect(cancelTicketPaymentIntent).toHaveBeenCalledWith('pi_declined');
    expect(voidReservedTicketOrder).toHaveBeenCalledWith(expect.anything(), 'order_1');
    expect(captureTicketPaymentIntent).not.toHaveBeenCalled();
    expect(finalizeCapturedTicketOrder).not.toHaveBeenCalled();
  });

  it('rolls back the reservation when Stripe authorization itself throws', async () => {
    createTicketPaymentIntent.mockRejectedValue(new Error('Stripe API unreachable'));

    const res = await POST(makeRequest({ quantity: 1 }), params);

    expect(res.status).toBe(500);
    expect(voidReservedTicketOrder).toHaveBeenCalledWith(expect.anything(), 'order_1');
    // No payment intent id was ever obtained, so there's nothing to cancel.
    expect(cancelTicketPaymentIntent).not.toHaveBeenCalled();
  });

  it('rejects non-fan accounts before ever calling Stripe', async () => {
    dbUserFindUnique.mockResolvedValue(baseUser({ role: Role.ARTIST }));

    const res = await POST(makeRequest({ quantity: 1 }), params);

    expect(res.status).toBe(403);
    expect(createTicketPaymentIntent).not.toHaveBeenCalled();
  });
});
