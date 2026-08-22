import { describe, expect, it, vi } from 'vitest';
import {
  finalizeCapturedTicketOrder,
  refundCapturedTicketOrder,
  voidReservedTicketOrder,
} from '@/lib/ticket-order-state';

/**
 * The order lifecycle, end to end, where the money actually moves.
 *
 * ## Why this file exists
 *
 * `buildPayableEntries` and `splitArtistPayoutAcrossLineup` are covered by
 * `ticket-order-state.test.ts` — the arithmetic of the 70/20/10 split is well
 * tested. The three functions that WRITE that arithmetic into the database were
 * not covered anywhere: `refundCapturedTicketOrder` and
 * `voidReservedTicketOrder` appear in the test suite only as `vi.fn()` stubs at
 * the route level, i.e. every test that touches a refund asserts that the
 * refund function was CALLED, and nothing asserts what it does.
 *
 * That is the wrong half to leave uncovered. Nothing has ever been sold through
 * this app — live Stripe holds zero PaymentIntents — so the first real refund
 * will be the first execution of this code, and its failure modes are all
 * silent-and-expensive: capacity that is never released, a ticket that stays
 * scannable after a refund, or a payable entry left PENDING for the payout cron
 * to pay out on a refunded order.
 *
 * ## Why a fake `tx` rather than a database
 *
 * These functions take a Prisma transaction client and do nothing else — no
 * `@/lib/db` import, no network. A fake `tx` that records calls tests exactly
 * what they are responsible for: the ORDER of operations and the guard on each
 * one. It cannot test that Prisma's `updateMany` filters as documented, which is
 * what the staging rehearsal in `docs/money-path-rehearsal.md` is for.
 */
type Call = { model: string; method: string; args: any };

/**
 * `counts` programs what each `updateMany` reports back, keyed `model.method`
 * or `model.method#n` for the nth call — which is how a lost race is expressed:
 * the row moved between the read and the write, so the update matches nothing.
 */
function fakeTx(rows: Record<string, any>, counts: Record<string, { count: number }> = {}) {
  const calls: Call[] = [];
  const seen: Record<string, number> = {};
  const model = (name: string) => new Proxy({}, {
    get: (_t, method: string) => (args: any) => {
      calls.push({ model: name, method, args });
      const key = `${name}.${method}`;
      seen[key] = (seen[key] ?? 0) + 1;
      const indexed = counts[`${key}#${seen[key]}`];
      if (indexed) return Promise.resolve(indexed);
      if (counts[key]) return Promise.resolve(counts[key]);
      if (method === 'findUnique' || method === 'findFirst') return Promise.resolve(rows[name] ?? null);
      if (method === 'findMany') return Promise.resolve(rows[`${name}.many`] ?? []);
      if (method === 'createManyAndReturn') {
        return Promise.resolve((args.data as unknown[]).map((_, i) => ({ id: `t${i}` })));
      }
      if (method === 'updateMany' || method === 'createMany') return Promise.resolve({ count: 1 });
      return Promise.resolve({});
    },
  });
  const tx = new Proxy({}, { get: (_t, name: string) => model(name) }) as any;
  return { tx, calls, of: (m: string, method: string) => calls.filter((c) => c.model === m && c.method === method) };
}

const capturedOrder = { id: 'ord_1', showId: 'show_1', quantity: 3, status: 'CAPTURED' };
const reservedOrder = { id: 'ord_2', showId: 'show_1', quantity: 2, status: 'RESERVED' };

describe('refundCapturedTicketOrder', () => {
  it('voids the order and its live tickets, releases capacity, and voids PENDING payables', async () => {
    const { tx, of } = fakeTx({ ticketOrder: capturedOrder });
    await expect(refundCapturedTicketOrder(tx, 'ord_1')).resolves.toBe(true);

    expect(of('ticketOrder', 'updateMany')[0].args.data).toEqual({ status: 'VOID' });
    // Only VALID tickets: a SCANNED one is a person who walked through the
    // door, and the refund route refuses that order before reaching here.
    expect(of('ticket', 'updateMany')[0].args.where).toMatchObject({ ticketOrderId: 'ord_1', status: 'VALID' });
    expect(of('show', 'updateMany')[0].args.data).toEqual({ ticketsSoldCount: { decrement: 3 } });
    expect(of('accountsPayableEntry', 'updateMany')[0].args).toMatchObject({
      where: { ticketOrderId: 'ord_1', status: 'PENDING' },
      data: { status: 'VOID' },
    });
  });

  it('never touches a RELEASED payable — money that has already moved is not unpaid by a refund', async () => {
    const { tx, of } = fakeTx({ ticketOrder: capturedOrder });
    await refundCapturedTicketOrder(tx, 'ord_1');
    /* The filter is the whole guarantee, and the module's own comment leans on
       it: payouts run only for ENDED shows and refunds only more than 48h
       before doors, so a refundable order's entries are still PENDING. If that
       filter ever widens, a refund starts clawing back transfers that have
       already left the platform balance — which Stripe will not undo. */
    expect(of('accountsPayableEntry', 'updateMany')[0].args.where.status).toBe('PENDING');
  });

  it('is a no-op on an order that is not CAPTURED, and on one that does not exist', async () => {
    for (const row of [{ ...capturedOrder, status: 'RESERVED' }, { ...capturedOrder, status: 'VOID' }, null]) {
      const { tx, calls } = fakeTx({ ticketOrder: row });
      await expect(refundCapturedTicketOrder(tx, 'ord_1')).resolves.toBe(false);
      expect(calls.filter((c) => c.method !== 'findUnique')).toEqual([]);
    }
  });

  it('stops dead when it loses the race for the order, before voiding a single ticket', async () => {
    // Two refunds landing together: the first transitions the row, the second
    // reads CAPTURED and then matches nothing. Without the count check the
    // loser would go on to decrement capacity a second time.
    const { tx, calls } = fakeTx({ ticketOrder: capturedOrder }, { 'ticketOrder.updateMany': { count: 0 } });
    await expect(refundCapturedTicketOrder(tx, 'ord_1')).resolves.toBe(false);
    expect(calls.some((c) => c.model === 'ticket')).toBe(false);
    expect(calls.some((c) => c.model === 'show')).toBe(false);
    expect(calls.some((c) => c.model === 'accountsPayableEntry')).toBe(false);
  });

  it('throws rather than returning true when sold capacity could not be released', async () => {
    /* The seat has to go back on sale. Returning true here would leave a show
       permanently one ticket short of its own capacity with a refunded buyer and
       no record of why — so this is a throw, which rolls the transaction back. */
    const { tx } = fakeTx({ ticketOrder: capturedOrder }, { 'show.updateMany': { count: 0 } });
    await expect(refundCapturedTicketOrder(tx, 'ord_1')).rejects.toThrow(/without releasing sold capacity/);
  });
});

describe('voidReservedTicketOrder', () => {
  it('voids the order and releases the held seats', async () => {
    const { tx, of } = fakeTx({ ticketOrder: reservedOrder });
    await expect(voidReservedTicketOrder(tx, 'ord_2')).resolves.toBe(true);
    expect(of('ticketOrder', 'updateMany')[0].args.data).toEqual({ status: 'VOID' });
    expect(of('show', 'updateMany')[0].args.data).toEqual({ ticketsSoldCount: { decrement: 2 } });
  });

  it('touches no tickets and no payables — a reserved order has neither yet', async () => {
    const { tx, calls } = fakeTx({ ticketOrder: reservedOrder });
    await voidReservedTicketOrder(tx, 'ord_2');
    expect(calls.some((c) => c.model === 'ticket')).toBe(false);
    expect(calls.some((c) => c.model === 'accountsPayableEntry')).toBe(false);
  });

  it('refuses an order that is already CAPTURED — that is a refund, not a void', async () => {
    const { tx, calls } = fakeTx({ ticketOrder: { ...reservedOrder, status: 'CAPTURED' } });
    await expect(voidReservedTicketOrder(tx, 'ord_2')).resolves.toBe(false);
    expect(calls.filter((c) => c.method !== 'findUnique')).toEqual([]);
  });

  it('throws rather than returning true when held capacity could not be released', async () => {
    const { tx } = fakeTx({ ticketOrder: reservedOrder }, { 'show.updateMany': { count: 0 } });
    await expect(voidReservedTicketOrder(tx, 'ord_2')).rejects.toThrow(/without releasing reserved capacity/);
  });
});

describe('finalizeCapturedTicketOrder', () => {
  const show = { id: 'show_1', venueProfileId: 'venue_1', headlinerProfileId: 'artist_1', artistPayoutPercent: 70 };
  const order = {
    id: 'ord_3',
    showId: 'show_1',
    quantity: 2,
    status: 'RESERVED',
    buyerName: 'A Buyer',
    buyerEmail: 'buyer@example.com',
    venuePayoutCents: 2000,
    artistPayoutCents: 7000,
    promoterPayoutCents: 1000,
    taxLocalCents: 0,
    taxStateCents: 0,
    taxCountryCents: 0,
    taxInternationalCents: 0,
    affiliatePromoterProfileId: null,
    show,
    tickets: [],
  };

  it('issues one ticket per seat and books the split as PENDING payables', async () => {
    const { tx, of } = fakeTx({ ticketOrder: order });
    const result = await finalizeCapturedTicketOrder(tx, 'ord_3');

    expect(result.changed).toBe(true);
    expect(of('ticket', 'createManyAndReturn')[0].args.data).toHaveLength(2);
    const entries = of('accountsPayableEntry', 'createMany')[0].args.data;
    /* The sum is the invariant that matters: every cent of the captured order
       is accounted for by exactly one payable row, so the platform's own take
       stays $0 as the charter says. */
    expect(entries.reduce((sum: number, e: any) => sum + e.amountCents, 0)).toBe(10_000);
    expect(entries.every((e: any) => e.status === 'PENDING')).toBe(true);
  });

  it('is idempotent on an order Stripe told us about twice', async () => {
    const { tx, calls } = fakeTx({ ticketOrder: { ...order, status: 'CAPTURED', tickets: [{ id: 't0' }] } });
    const result = await finalizeCapturedTicketOrder(tx, 'ord_3');
    expect(result.changed).toBe(false);
    // No second set of tickets, and no second set of payables.
    expect(calls.some((c) => c.method === 'createManyAndReturn')).toBe(false);
    expect(calls.some((c) => c.model === 'accountsPayableEntry')).toBe(false);
  });

  it('refuses to capture from a status that is not RESERVED', async () => {
    const { tx } = fakeTx({ ticketOrder: { ...order, status: 'VOID' } });
    await expect(finalizeCapturedTicketOrder(tx, 'ord_3')).rejects.toThrow(/not capturable/);
  });

  it('returns the existing capture when it loses the race, instead of double-issuing', async () => {
    const { tx, calls } = fakeTx(
      { ticketOrder: order },
      { 'ticketOrder.updateMany': { count: 0 }, 'ticketOrder.findUnique#2': { ...order, status: 'CAPTURED', tickets: [{ id: 't0' }] } },
    );
    const result = await finalizeCapturedTicketOrder(tx, 'ord_3');
    expect(result.changed).toBe(false);
    expect(calls.some((c) => c.method === 'createManyAndReturn')).toBe(false);
  });

  it('throws when it loses the race and the winner did not capture — the order moved somewhere unexpected', async () => {
    const { tx } = fakeTx(
      { ticketOrder: order },
      { 'ticketOrder.updateMany': { count: 0 }, 'ticketOrder.findUnique#2': { ...order, status: 'VOID' } },
    );
    await expect(finalizeCapturedTicketOrder(tx, 'ord_3')).rejects.toThrow(/changed while it was being captured/);
  });
});
