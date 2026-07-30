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
vi.mock('@/lib/stripe', () => ({
  constructWebhookEvent: (...args: unknown[]) => constructWebhookEvent(...args),
  isStripeConfigured: () => isStripeConfigured(),
}));

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
        ticketOrder: { findUnique: (...a: unknown[]) => ticketOrderFindUnique(...a), findMany: (...a: unknown[]) => ticketOrderFindMany(...a) },
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
    data: { object: { id: paymentIntentId } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  processedEvents = new Set();
  isStripeConfigured.mockReturnValue(true);
  ticketOrderFindUnique.mockResolvedValue({ id: 'order_1' });
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

  it('finalizes the ticket order on a successful payment_intent.succeeded event', async () => {
    const event = succeededEvent('evt_1', 'pi_1');
    constructWebhookEvent.mockReturnValue(event);

    const res = await POST(makeRequest(event));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.duplicate).toBe(false);
    expect(finalizeCapturedTicketOrder).toHaveBeenCalledTimes(1);
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
    ticketOrderFindMany.mockResolvedValue([{ id: 'order_9' }]);
    adFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest(event));

    expect(res.status).toBe(200);
    expect(voidReservedTicketOrder).toHaveBeenCalledWith(expect.anything(), 'order_9');
  });
});
