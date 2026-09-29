/**
 * WHAT AN ACT'S SHARE OF A TICKET ORDER IS, on a surface that lists orders.
 *
 * Since the split agreement (2026-09-27, DESIGN_SYNC row 528) a sale writes
 * `TicketOrder.artistPayoutCents` as 0: the venue collects every cent and pays
 * each act itself, the share being the percentage both signed, computed on the
 * settlement statement (`src/lib/settlement-statement.ts`) over the whole
 * show. Two surfaces went on summing that column — the artist's analytics tile
 * "Gross (your share)" and the organiser's order table — and read $0 for every
 * sale since, over a product where the act was owed real money (found by the
 * 2026-09-29 audit, DESIGN_SYNC row 532).
 *
 * This is the ORDER-LEVEL reading: the face value the order carried times the
 * split the act signed, before the deductions, refunds and guarantee the
 * statement applies. It is what "gross" means on those surfaces. The statement
 * remains the number the venue pays; nothing here replaces it.
 *
 * An order sold under an older mode keeps the payout the sale recorded.
 */
import { VENUE_KEEPS_ALL } from './settlement-mode';

export type ShareOrder = {
  settlementMode: string | null;
  subtotalCents: number;
  artistPayoutCents: number;
};

/**
 * One act's gross share of one order: face value × the act's signed split,
 * rounded to the cent (Agreement 4.3: the half cent goes to the act). `null`
 * when the order needs a split and none is known — an unsigned share is not a
 * zero, and a sum must not silently absorb it.
 */
export function orderActShareCents(order: ShareOrder, splitPercent: number | null): number | null {
  if (order.settlementMode !== VENUE_KEEPS_ALL) return order.artistPayoutCents;
  if (splitPercent == null) return null;
  return Math.round((order.subtotalCents * splitPercent) / 100 + 1e-9);
}

/**
 * The sum over orders, with the split looked up per show. `unsignedOrders`
 * counts the VENUE_KEEPS_ALL orders that had no split to apply (a superseded
 * agreement, an order on a show the act is not signed to); the caller decides
 * whether to say so.
 */
export function sumActShares<T extends ShareOrder & { showId: string }>(
  orders: T[],
  splitPercentByShow: ReadonlyMap<string, number>,
): { cents: number; unsignedOrders: number } {
  let cents = 0;
  let unsignedOrders = 0;
  for (const order of orders) {
    const share = orderActShareCents(order, splitPercentByShow.get(order.showId) ?? null);
    if (share == null) unsignedOrders += 1;
    else cents += share;
  }
  return { cents, unsignedOrders };
}

/**
 * Every act's share of one order together (the organiser's table has one
 * column for the acts): face value × the sum of the live splits. Siblings'
 * splits are percentages of the same ticket price, so they add.
 */
export function orderActsShareCents(order: ShareOrder, liveSplitPercents: readonly number[]): number | null {
  if (order.settlementMode !== VENUE_KEEPS_ALL) return order.artistPayoutCents;
  if (liveSplitPercents.length === 0) return null;
  const total = liveSplitPercents.reduce((sum, p) => sum + p, 0);
  return Math.round((order.subtotalCents * total) / 100 + 1e-9);
}
