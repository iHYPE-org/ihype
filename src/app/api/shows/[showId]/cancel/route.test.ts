import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A REFUND THAT REACHED STRIPE AND FAILED TO RECORD IS NOT A FAILED REFUND.
 *
 * Both branches of this route call Stripe FIRST and write the row second,
 * which is the only safe order — a row marked refunded over a refund that
 * never happened is the worse error. But the `try` wrapped both halves and
 * the `catch` counted everything as `failed`, under an operator email reading
 * "N order refunds failed and need a manual refund in Stripe".
 *
 * `refundCapturedTicketOrder()` throws by design when it loses a race
 * ("Order changed state before the refund could be recorded."). So a refund
 * that SUCCEEDED and then hit that throw — or any Postgres blip in the same
 * transaction — was reported to an operator as needing a manual refund, with
 * no `refundedAt`/`stripeRefundId` on the row to show the first one had
 * happened. Following that instruction pays the buyer twice.
 *
 * These are two states with opposite correct actions and they cannot share a
 * counter: nothing moved wants a manual refund; money already returned wants
 * the ROW reconciled and must never be refunded again.
 *
 * Latent when written — production had zero captured orders, so no
 * cancellation had ever refunded anything, which is exactly why it was worth
 * fixing before the first sale rather than after.
 */

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/permissions', () => ({ canManageOwnedResource: (s: { user?: { id?: string } }, owner?: string) => Boolean(owner) && s?.user?.id === owner }));
vi.mock('@/lib/notify', () => ({ notifyUser: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/env', () => ({ getAdminAlertRecipients: () => ['admin@ihype.org'] }));

const sendOperationalEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/mailer', () => ({ sendOperationalEmail: (...a: unknown[]) => sendOperationalEmail(...a) }));

const refundTicketPaymentIntent = vi.fn();
const cancelTicketPaymentIntent = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/stripe', () => ({
  refundTicketPaymentIntent: (...a: unknown[]) => refundTicketPaymentIntent(...a),
  cancelTicketPaymentIntent: (...a: unknown[]) => cancelTicketPaymentIntent(...a),
}));

const refundCapturedTicketOrder = vi.fn();
vi.mock('@/lib/ticket-order-state', () => ({
  refundCapturedTicketOrder: (...a: unknown[]) => refundCapturedTicketOrder(...a),
  voidReservedTicketOrder: vi.fn().mockResolvedValue(true),
}));

const orderFindMany = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    show: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'show_1', slug: 'the-night', title: 'The Night', status: 'SCHEDULED',
        creatorId: 'organiser', venueProfile: null, headlinerProfile: null,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    ticketOrder: {
      findMany: (...a: unknown[]) => orderFindMany(...a),
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: (fn: (tx: unknown) => unknown) => Promise.resolve(fn({
      ticketOrder: { update: vi.fn().mockResolvedValue({}) },
    })),
  },
}));

import { auth } from '@/lib/auth';
import { POST } from './route';

const CAPTURED_ORDER = {
  id: 'order_1', confirmationCode: 'IH-ABC123', status: 'CAPTURED',
  stripePaymentIntentId: 'pi_live_1', settlementMode: 'PLATFORM', settlementAccountId: null,
  totalChargeCents: 1952, processingFeeCents: 87, buyerUserId: 'buyer_1', tickets: [{ status: 'VALID' }],
};

function cancel() {
  return POST(
    new Request('https://ihype.org/api/shows/show_1/cancel', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'venue' }),
    }),
    { params: Promise.resolve({ showId: 'show_1' }) },
  );
}

/** Every operational email this run sent, flattened to searchable text. */
function mailText(): string {
  return sendOperationalEmail.mock.calls
    .map(([msg]) => `${msg.subject}\n${msg.text}\n${msg.html}`)
    .join('\n---\n');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: 'organiser' } } as never);
  orderFindMany.mockResolvedValue([CAPTURED_ORDER]);
  refundTicketPaymentIntent.mockResolvedValue('re_1');
  refundCapturedTicketOrder.mockResolvedValue(true);
});

describe('cancelling a show', () => {
  it('refunds and records a captured order', async () => {
    const body = await (await cancel()).json();
    expect(body.ordersRefunded).toBe(1);
    expect(body.ordersFailed).toBe(0);
    expect(body.ordersSettledNotRecorded).toBe(0);
    expect(sendOperationalEmail).not.toHaveBeenCalled();
  });

  it('a refund that never reached Stripe is a failure, and the email says to CHECK first', async () => {
    refundTicketPaymentIntent.mockRejectedValue(new Error('No such payment_intent'));
    const body = await (await cancel()).json();
    expect(body.ordersFailed).toBe(1);
    expect(body.ordersSettledNotRecorded).toBe(0);
    expect(mailText()).toMatch(/never reached Stripe/);
  });

  it('a refund that SUCCEEDED but could not be recorded is never reported as needing another refund', async () => {
    /* The race `refundCapturedTicketOrder` throws on by design. Stripe has
       already moved the money at this point. */
    refundCapturedTicketOrder.mockRejectedValue(new Error('Order changed state before the refund could be recorded.'));
    const body = await (await cancel()).json();

    expect(body.ordersSettledNotRecorded).toBe(1);
    expect(body.ordersFailed, 'must not be counted as a failed refund').toBe(0);

    const mail = mailText();
    expect(mail).toMatch(/DO NOT REFUND/);
    expect(mail, 'the operator needs the order to look up').toContain('IH-ABC123');
    expect(mail, 'and the Stripe reference for the refund that did happen').toContain('re_1');
    /* The exact sentence that caused the double refund. It may never be
       applied to an order Stripe has already settled. */
    expect(mail).not.toMatch(/need\w*\s+a manual refund in Stripe/);
  });

  it('separates the two outcomes when both happen in one cancellation', async () => {
    orderFindMany.mockResolvedValue([
      CAPTURED_ORDER,
      { ...CAPTURED_ORDER, id: 'order_2', confirmationCode: 'IH-DEF456', stripePaymentIntentId: 'pi_live_2' },
    ]);
    refundTicketPaymentIntent
      .mockRejectedValueOnce(new Error('No such payment_intent'))   // order_1: nothing moved
      .mockResolvedValueOnce('re_2');                                // order_2: money moved
    refundCapturedTicketOrder.mockRejectedValue(new Error('Order changed state before the refund could be recorded.'));

    const body = await (await cancel()).json();
    expect(body.ordersFailed).toBe(1);
    expect(body.ordersSettledNotRecorded).toBe(1);

    const mail = mailText();
    /* Two alerts, and the dangerous one names only the order it applies to —
       an operator must not read IH-ABC123 under "do not refund". */
    expect(mail).toMatch(/DO NOT REFUND/);
    expect(mail).toMatch(/never reached Stripe/);
    const danger = sendOperationalEmail.mock.calls.map(([m]) => m).find((m) => /DO NOT REFUND/.test(m.subject));
    expect(danger.text).toContain('IH-DEF456');
    expect(danger.text).not.toContain('IH-ABC123');
  });
});
