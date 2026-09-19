/**
 * The two halves of a show's seat count, in one place.
 *
 * `Show.ticketsSoldCount` is the only thing standing between a sold-out show
 * and an oversold one, and until 2026-09-17 the rule for moving it was written
 * FOUR times: once to take seats (the purchase route) and three times to give
 * them back (`ticket-order-state.ts` twice, `expire-reservations` once). Two of
 * those three releases guarded `gte` and threw when the write did not apply;
 * the third guarded nothing and could drive the count negative, which the
 * purchase guard then reads as room. That divergence is what let the expiry
 * cron oversell a show, and a rule written four times will diverge again — so
 * it is written here once and imported.
 *
 * Both functions are deliberately CONDITIONAL WRITES rather than
 * read-then-write. The condition is evaluated by Postgres against the row's
 * live value at update time, which is what makes them correct under concurrent
 * buyers without a lock or a Serializable transaction. Do not "simplify" either
 * into a read followed by an update: every buyer for one show writes the same
 * `Show` row, so the read would be stale precisely when it matters most.
 *
 * `scripts/concurrency-probe.mts` drives these functions — not a copy of them —
 * against a real Postgres from many connections at once. A harness that
 * reimplements the rule measures the harness.
 */

/**
 * The minimum this module needs, declared STRUCTURALLY rather than as
 * `Pick<typeof db, 'show'>`.
 *
 * Tying it to the edge client would make the rule unreachable from Node, and
 * `scripts/concurrency-probe.mts` — the only thing that can prove the rule
 * holds under simultaneous writers — runs under tsx with the plain client. A
 * contract narrow enough for both is also a contract that says exactly what
 * this module touches: one conditional update of one column.
 */
type ShowInventoryUpdate = {
  where: {
    id: string;
    isTicketed?: boolean;
    status?: { in: ('SCHEDULED' | 'LIVE')[] };
    ticketsSoldCount?: { lte: number } | { gte: number };
  };
  data: { ticketsSoldCount: { increment: number } | { decrement: number } };
};

export type InventoryTx = {
  show: { updateMany(args: ShowInventoryUpdate): Promise<{ count: number }> };
};

/**
 * Takes `quantity` seats if the show still has them.
 *
 * Returns false when the show sold out, stopped being ticketed or left the
 * on-sale statuses between the caller's read and this write — the caller
 * decides what that means, because the purchase route owes the buyer a
 * different sentence than a batch job does.
 *
 * `ticketCapacity: null` means uncapped, and is NOT the same as zero.
 */
export async function reserveShowInventory(
  tx: InventoryTx,
  { showId, quantity, ticketCapacity }: { showId: string; quantity: number; ticketCapacity: number | null },
): Promise<boolean> {
  const capacityGuard =
    ticketCapacity === null ? {} : { ticketsSoldCount: { lte: ticketCapacity - quantity } };

  const reserved = await tx.show.updateMany({
    where: {
      id: showId,
      isTicketed: true,
      status: { in: ['SCHEDULED', 'LIVE'] },
      ...capacityGuard,
    },
    data: { ticketsSoldCount: { increment: quantity } },
  });

  // Deliberately NOT also gated on `updatedAt`: that column is bumped by any
  // write to the row, including another buyer's successful reservation moments
  // earlier, so pinning it would refuse concurrent purchases that are still
  // within capacity as spurious "availability changed" errors.
  return reserved.count === 1;
}

/**
 * Gives `seats` back.
 *
 * Returns false when the decrement would take the count below zero, which can
 * only happen if the count and the orders have already disagreed. Every caller
 * treats that as a throw: a negative seat count is read as room by
 * `reserveShowInventory`, so silently writing one converts a bookkeeping fault
 * into an oversold show.
 *
 * `seats` must be what the caller actually voided, never what it read and
 * intended to void — the difference is every order that captured in between.
 */
export async function releaseShowInventory(
  tx: InventoryTx,
  { showId, seats }: { showId: string; seats: number },
): Promise<boolean> {
  if (seats <= 0) return true;

  const released = await tx.show.updateMany({
    where: { id: showId, ticketsSoldCount: { gte: seats } },
    data: { ticketsSoldCount: { decrement: seats } },
  });

  return released.count === 1;
}
