import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client/edge';

// Exercises the REAL route handler (src/app/api/stripe/webhook/route.ts),
// unlike src/lib/__tests__/webhook-idempotency.test.ts, which only tests a
// hand-rolled in-memory reimplementation of the idempotency pattern and
// never actually imports or calls this file. Signature verification itself
// is Stripe SDK's job (constructWebhookEvent is mocked here, not
// re-verified) — what's under test is the route's own dispatch and
// dedup/rollback orchestration.

const constructWebhookEvent = vi.fn();
const isStripeConfigured = vi.fn().mockReturnValue(true);
vi.mock('@/lib/stripe', () => {
  // Defined inside the factory so the route's `instanceof` check compares
  // against the same class this test throws.
  class WebhookSecretUnavailableError extends Error {}
  return {
    WebhookSecretUnavailableError,
    constructWebhookEvent: (...args: unknown[]) => constructWebhookEvent(...args),
    isStripeConfigured: () => isStripeConfigured(),
  };
});

const finalizeCapturedTicketOrder = vi.fn();
const voidReservedTicketOrder = vi.fn().mockResolvedValue(true);
vi.mock('@/lib/ticket-order-state', () => ({
  finalizeCapturedTicketOrder: (...args: unknown[]) => finalizeCapturedTicketOrder(...args),
  voidReservedTicketOrder: (...args: unknown[]) => voidReservedTicketOrder(...args),
}));

const processNotificationJobs = vi.fn().mockResolvedValue({ selected: 1, completed: 1, failed: 0 });
vi.mock('@/lib/notification-jobs', () => ({
  processNotificationJobs: (...args: unknown[]) => processNotificationJobs(...args),
}));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));

// In-memory table backing tx.processedWebhookEvent, so a real event ID
// replayed twice actually hits the same duplicate-detection path the live
// unique constraint enforces (findUnique sees it, then create P2002s).
let processedEvents: Set<string>;

const ticketOrderFindUnique = vi.fn();
const adFindUnique = vi.fn();
const profileUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
const ticketOrderFindMany = vi.fn().mockResolvedValue([]);
const ticketOrderUpdate = vi.fn().mockResolvedValue({});
const dbTicketOrderFindUniqueTopLevel = vi.fn();
const dbAdFindUniqueTopLevel = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    ticketOrder: { findUnique: (...a: unknown[]) => dbTicketOrderFindUniqueTopLevel(...a) },
    ad: { findUnique: (...a: unknown[]) => dbAdFindUniqueTopLevel(...a) },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        processedWebhookEvent: {
          findUnique: vi.fn(async ({ where }: { where: { source_eventId: { source: string; eventId: string } } }) => {
            const key = `${where.source_eventId.source}:${where.source_eventId.eventId}`;
            return processedEvents.has(key) ? { id: key } : null;
          }),
          create: vi.fn(async ({ data }: { data: { source: string; eventId: string } }) => {
            const key = `${data.source}:${data.eventId}`;
            if (processedEvents.has(key)) {
              throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
                code: 'P2002',
                clientVersion: 'test',
              });
            }
            processedEvents.add(key);
            return { id: key };
          }),
        },
        ad: { findUnique: (...a: unknown[]) => adFindUnique(...a), update: vi.fn().mockResolvedValue({}) },
        ticketOrder: { findUnique: (...a: unknown[]) => ticketOrderFindUnique(...a), findMany: (...a: unknown[]) => ticketOrderFindMany(...a), update: (...a: unknown[]) => ticketOrderUpdate(...a) },
        profile: { updateMany: (...a: unknown[]) => profileUpdateMany(...a) },
        notificationJob: { upsert: vi.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    }),
  },
}));

import { POST } from './route';

function makeRequest(body: unknown) {
  return new Request('https://ihype.org/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 't=1,v1=stub' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

function succeededEvent(id: string, paymentIntentId: string) {
  return {
    id,
    type: 'payment_intent.succeeded',
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: paymentIntentId, amount_received: 2000 } },
  };
}

// The order every ticket branch reads: settles on the platform, charges $20.
const PLATFORM_ORDER = { id: 'order_1', settlementMode: 'PLATFORM', settlementAccountId: null, totalChargeCents: 2000 };

beforeEach(() => {
  vi.clearAllMocks();
  processedEvents = new Set();
  isStripeConfigured.mockReturnValue(true);
  ticketOrderFindUnique.mockResolvedValue(PLATFORM_ORDER);
  dbTicketOrderFindUniqueTopLevel.mockResolvedValue({
    id: 'order_1',
    buyerEmail: 'fan@ihype.org',
    buyerName: 'Fan One',
    totalChargeCents: 2000,
    tickets: [{ id: 't1', serializedId: 'ser1', status: 'CAPTURED' }],
    show: { title: 'Neon Night', ticketingOpensAt: null, venueProfile: { name: 'The Venue' } },
  });
  finalizeCapturedTicketOrder.mockResolvedValue({ changed: true });
});

describe('POST /api/stripe/webhook', () => {
  it('returns 503 without reading the request body when payments are not configured', async () => {
    isStripeConfigured.mockReturnValue(false);

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(503);
    expect(constructWebhookEvent).not.toHaveBeenCalled();
  });

  it('returns 400 for a missing signature header', async () => {
    const req = new Request('https://ihype.org/api/stripe/webhook', { method: 'POST', body: '{}' }) as unknown as import('next/server').NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when the Stripe signature is invalid', async () => {
    constructWebhookEvent.mockImplementation(() => {
      throw new Error('signature mismatch');
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 503, not 400, when the webhook secret is unreadable this invocation', async () => {
    // The transient env-binding loss of 2026-08-30: the secret IS set, this
    // one request's Cloudflare context came back empty. 400 tells Stripe the
    // delivery is bad and mislabels the fault as a signature failure; 503 is
    // retryable, and the retry arrives with a fresh (working) context.
    const { WebhookSecretUnavailableError } = await import('@/lib/stripe');
    constructWebhookEvent.mockImplementation(() => {
      throw new WebhookSecretUnavailableError();
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(503);
  });

  it('finalizes the ticket order on a successful payment_intent.succeeded event', async () => {
    const event = succeededEvent('evt_1', 'pi_1');
    constructWebhookEvent.mockReturnValue(event);

    const res = await POST(makeRequest(event));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.duplicate).toBe(false);
    expect(finalizeCapturedTicketOrder).toHaveBeenCalledTimes(1);
  });

  it('finalizes a hosted ticket checkout and stores its PaymentIntent', async () => {
    const event = {
      id: 'evt_checkout',
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      data: { object: {
        id: 'cs_1', mode: 'payment', payment_status: 'paid', payment_intent: 'pi_checkout', amount_total: 2000,
        metadata: { purpose: 'ticket_purchase', confirmationCode: 'ABCD1234', showId: 'show_1' },
      } },
    };
    constructWebhookEvent.mockReturnValue(event);

    const res = await POST(makeRequest(event));

    expect(res.status).toBe(200);
    expect(ticketOrderUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order_1' },
      data: { stripePaymentIntentId: 'pi_checkout' },
    }));
    expect(finalizeCapturedTicketOrder).toHaveBeenCalledWith(expect.anything(), 'order_1', expect.any(Date));
  });

  it('refuses a connected-account checkout that names a platform order (security sweep, 2026-09-02)', async () => {
    // A venue with its own Stripe keys pays fifty cents on ITS account with
    // someone else's confirmationCode in metadata. Signed by Stripe, real
    // event — and not about this order.
    const event = {
      id: 'evt_forged', type: 'checkout.session.completed', created: Math.floor(Date.now() / 1000),
      account: 'acct_venue',
      data: { object: {
        id: 'cs_forged', mode: 'payment', payment_status: 'paid', payment_intent: 'pi_forged', amount_total: 50,
        metadata: { purpose: 'ticket_purchase', confirmationCode: 'ABCD1234', showId: 'show_1' },
      } },
    };
    constructWebhookEvent.mockReturnValue(event);

    const res = await POST(makeRequest(event));

    expect(res.status).toBe(200); // acknowledged so Stripe stops retrying; nothing changed
    expect(ticketOrderUpdate).not.toHaveBeenCalled();
    expect(finalizeCapturedTicketOrder).not.toHaveBeenCalled();
  });

  it('refuses a session paid for less than the order charges', async () => {
    const event = {
      id: 'evt_short', type: 'checkout.session.completed', created: Math.floor(Date.now() / 1000),
      data: { object: {
        id: 'cs_short', mode: 'payment', payment_status: 'paid', payment_intent: 'pi_short', amount_total: 50,
        metadata: { purpose: 'ticket_purchase', confirmationCode: 'ABCD1234', showId: 'show_1' },
      } },
    };
    constructWebhookEvent.mockReturnValue(event);

    const res = await POST(makeRequest(event));

    expect(res.status).toBe(200);
    expect(finalizeCapturedTicketOrder).not.toHaveBeenCalled();
  });

  it('accepts a venue-direct sale only from the venue account', async () => {
    ticketOrderFindUnique.mockResolvedValue({ id: 'order_vd', settlementMode: 'VENUE_DIRECT', settlementAccountId: 'acct_venue', totalChargeCents: 2000 });
    const base = {
      type: 'checkout.session.completed', created: Math.floor(Date.now() / 1000),
      data: { object: {
        id: 'cs_vd', mode: 'payment', payment_status: 'paid', payment_intent: 'pi_vd', amount_total: 2000,
        metadata: { purpose: 'ticket_purchase', confirmationCode: 'VD1', showId: 'show_1' },
      } },
    };
    constructWebhookEvent.mockReturnValue({ ...base, id: 'evt_vd_wrong', account: 'acct_other' });
    await POST(makeRequest(base));
    expect(finalizeCapturedTicketOrder).not.toHaveBeenCalled();

    constructWebhookEvent.mockReturnValue({ ...base, id: 'evt_vd_right', account: 'acct_venue' });
    await POST(makeRequest(base));
    expect(finalizeCapturedTicketOrder).toHaveBeenCalledWith(expect.anything(), 'order_vd', expect.any(Date));
  });

  it('releases inventory when hosted checkout expires', async () => {
    const event = {
      id: 'evt_expired', type: 'checkout.session.expired', created: Math.floor(Date.now() / 1000),
      data: { object: { id: 'cs_expired', metadata: { purpose: 'ticket_purchase', confirmationCode: 'ABCD1234' } } },
    };
    constructWebhookEvent.mockReturnValue(event);

    const res = await POST(makeRequest(event));

    expect(res.status).toBe(200);
    expect(voidReservedTicketOrder).toHaveBeenCalledWith(expect.anything(), 'order_1');
  });

  it('is idempotent: the same event ID replayed does not re-finalize or re-email', async () => {
    const event = succeededEvent('evt_replay', 'pi_replay');
    constructWebhookEvent.mockReturnValue(event);

    const first = await POST(makeRequest(event));
    expect((await first.json()).duplicate).toBe(false);
    expect(finalizeCapturedTicketOrder).toHaveBeenCalledTimes(1);
    expect(processNotificationJobs).toHaveBeenCalledTimes(1);

    // Stripe resends webhooks on any non-2xx or timeout — a real retry
    // looks exactly like this: same event.id, sent again.
    const second = await POST(makeRequest(event));
    const secondJson = await second.json();

    expect(second.status).toBe(200);
    expect(secondJson.duplicate).toBe(true);
    // The core assertion: replay must not double-issue tickets or emails.
    expect(finalizeCapturedTicketOrder).toHaveBeenCalledTimes(1);
    expect(processNotificationJobs).toHaveBeenCalledTimes(2);
  });

  it('treats a raced duplicate insert (P2002) the same as an already-seen event', async () => {
    // Simulates two concurrent deliveries both passing the findUnique dedup
    // check before either has committed its processedWebhookEvent row — the
    // route's own catch(P2002) branch is what has to save it here.
    const event = succeededEvent('evt_race', 'pi_race');
    constructWebhookEvent.mockReturnValue(event);
    processedEvents.add('stripe:evt_race'); // pre-seed so create() throws P2002
    // But make findUnique (the dedup read) miss, to force the code down the
    // "not a duplicate yet" path into the create() that then races.
    const originalHas = processedEvents.has.bind(processedEvents);
    let findUniqueCalls = 0;
    processedEvents.has = ((key: string) => {
      if (key === 'stripe:evt_race' && findUniqueCalls === 0) {
        findUniqueCalls++;
        return false;
      }
      return originalHas(key);
    }) as typeof processedEvents.has;

    const res = await POST(makeRequest(event));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.duplicate).toBe(true);
  });

  it('voids reserved ticket orders on payment_intent.payment_failed', async () => {
    const event = {
      id: 'evt_failed',
      type: 'payment_intent.payment_failed',
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: 'pi_failed' } },
    };
    constructWebhookEvent.mockReturnValue(event);
    ticketOrderFindMany.mockResolvedValue([{ ...PLATFORM_ORDER, id: 'order_9' }]);
    adFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest(event));

    expect(res.status).toBe(200);
    expect(voidReservedTicketOrder).toHaveBeenCalledWith(expect.anything(), 'order_9');
  });
});
