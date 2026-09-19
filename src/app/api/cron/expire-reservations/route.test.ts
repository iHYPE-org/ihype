import { describe, expect, it, vi, beforeEach } from 'vitest';

const orderFindMany = vi.fn();
const orderUpdateMany = vi.fn();
const showUpdateMany = vi.fn();

vi.mock('@/lib/cron-auth', () => ({ isCronRequestAuthorized: () => true }));
vi.mock('@/lib/db', () => ({
  db: {
    ticketOrder: { findMany: (...a: unknown[]) => orderFindMany(...a) },
    $transaction: (fn: (tx: unknown) => unknown) =>
      Promise.resolve(fn({
        ticketOrder: { updateMany: (...a: unknown[]) => orderUpdateMany(...a) },
        show: { updateMany: (...a: unknown[]) => showUpdateMany(...a) },
      })),
  },
}));

import { NextRequest } from 'next/server';
import { GET } from './route';

const run = () => GET(new NextRequest('http://ihype.test/api/cron/expire-reservations'));

beforeEach(() => {
  orderFindMany.mockReset();
  orderUpdateMany.mockReset();
  showUpdateMany.mockReset();
  showUpdateMany.mockResolvedValue({ count: 1 });
});

describe('GET /api/cron/expire-reservations', () => {
  /*
   * THE REGRESSION THIS FILE EXISTS FOR.
   *
   * The void was guarded (`status: RESERVED, stripePaymentIntentId: null`) and
   * the release was not — it decremented the quantity summed from the READ. So
   * an order that captured between the read and the write kept its tickets AND
   * had its seats handed back, and the show sold them again. A guard on one
   * half of a two-half rule reads green forever; only driving the race shows
   * it, which is why this asserts the released seats and not just the void.
   */
  it('releases only the seats it actually voided when a reservation captures mid-run', async () => {
    orderFindMany.mockResolvedValue([
      { id: 'o1', showId: 'show-1', quantity: 2 },
      { id: 'o2', showId: 'show-1', quantity: 2 },
    ]);
    // One of the two captured between the read and the write.
    orderUpdateMany.mockResolvedValue({ count: 1 });

    const res = await run();

    expect(showUpdateMany).toHaveBeenCalledTimes(1);
    expect(showUpdateMany.mock.calls[0][0].data).toEqual({ ticketsSoldCount: { decrement: 2 } });
    await expect(res.json()).resolves.toMatchObject({ ok: true, voided: 1, raced: 1, showsAffected: 1 });
  });

  it('never writes a negative capacity — the release is guarded and a lost one throws', async () => {
    orderFindMany.mockResolvedValue([{ id: 'o1', showId: 'show-1', quantity: 3 }]);
    orderUpdateMany.mockResolvedValue({ count: 1 });
    showUpdateMany.mockResolvedValue({ count: 0 });

    await expect(run()).rejects.toThrow(/could not release 3 seat/);
    expect(showUpdateMany.mock.calls[0][0].where.ticketsSoldCount).toEqual({ gte: 3 });
  });

  it('touches no show when every stale reservation raced', async () => {
    orderFindMany.mockResolvedValue([{ id: 'o1', showId: 'show-1', quantity: 1 }]);
    orderUpdateMany.mockResolvedValue({ count: 0 });

    const res = await run();

    expect(showUpdateMany).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({ voided: 0, raced: 1, showsAffected: 0 });
  });

  it('groups by (show, quantity) so mixed order sizes each release their own seats', async () => {
    orderFindMany.mockResolvedValue([
      { id: 'o1', showId: 'show-1', quantity: 1 },
      { id: 'o2', showId: 'show-1', quantity: 4 },
      { id: 'o3', showId: 'show-1', quantity: 1 },
    ]);
    orderUpdateMany.mockResolvedValue({ count: 1 });

    await run();

    // Two groups: quantity 1 (two orders, one voided here) and quantity 4.
    const decrements = showUpdateMany.mock.calls.map((c) => c[0].data.ticketsSoldCount.decrement);
    expect(decrements.sort()).toEqual([1, 4]);
  });
});
