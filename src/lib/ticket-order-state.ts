import {
  AccountsPayableCategory,
  AccountsPayableStatus,
  Prisma,
  TicketOrderStatus,
} from '@prisma/client/edge';
import { createSerializedTicketId } from '@/lib/tickets';

type DbClient = typeof import('@/lib/db').db;
type Tx = Pick<
  DbClient,
  'ticketOrder' | 'ticket' | 'accountsPayableEntry' | 'show' | 'showLineupSlot'
>;

/**
 * Lineup & Split Agreement (DESIGN_SYNC row 226) — when a show has more than
 * one billed act, its artist share is split across ACCEPTED
 * ShowLineupSlot rows (each act's splitPercent, siblings summing to
 * Show.artistPayoutPercent) instead of paying 100% to headlinerProfileId.
 *
 * Each act is paid strictly its own contracted share
 * (splitPercent / artistPayoutPercent) of the order's artist payout, and the
 * last act absorbs only the sub-cent rounding drift between those shares —
 * so in the normal case (every slot ACCEPTED, splitPercents summing to
 * artistPayoutPercent) the per-act payouts sum to artistPayoutCents exactly,
 * with no cent unaccounted for or double-paid.
 *
 * The caller filters to ACCEPTED slots defensively, even though a show can't
 * reach SCHEDULED with a pending/declined slot. This function has to stay
 * defensive in the same direction: if that filter ever *does* drop a slot,
 * the accepted splitPercents sum to less than artistPayoutPercent, and the
 * undistributed portion must NOT be handed to whichever act happens to sort
 * last — it simply goes unallocated. Overpaying a real person is far harder
 * to claw back than under-distributing into the platform balance, which an
 * admin can settle manually against the logged warning.
 */
export function splitArtistPayoutAcrossLineup(
  artistPayoutCents: number,
  artistPayoutPercent: number | null,
  lineupSlots: { profileId: string; splitPercent: number }[],
): { profileId: string; amountCents: number }[] {
  const acceptedPercent = lineupSlots.reduce((sum, s) => sum + s.splitPercent, 0);
  const totalPercent = artistPayoutPercent ?? acceptedPercent;
  if (totalPercent <= 0) return [];

  // The pot actually owed to the acts present here. Equals artistPayoutCents
  // whenever the slots sum to the show's full artist share, which is the only
  // state a ticketed show is supposed to be able to reach.
  const distributable = Math.round(artistPayoutCents * (Math.min(acceptedPercent, totalPercent) / totalPercent));

  if (distributable !== artistPayoutCents) {
    console.warn(
      '[ticket-order-state] lineup splits do not cover the full artist share',
      { artistPayoutCents, distributable, totalPercent, acceptedPercent, slots: lineupSlots.length },
    );
  }

  let allocated = 0;
  return lineupSlots.map((slot, i) => {
    const isLast = i === lineupSlots.length - 1;
    const amountCents = isLast
      ? distributable - allocated
      : Math.round(artistPayoutCents * (slot.splitPercent / totalPercent));
    allocated += amountCents;
    return { profileId: slot.profileId, amountCents };
  });
}

export function buildPayableEntries(
  show: { id: string; venueProfileId: string | null; headlinerProfileId: string | null; artistPayoutPercent: number | null },
  order: {
    id: string;
    affiliatePromoterProfileId: string | null;
    taxLocalCents: number;
    taxStateCents: number;
    taxCountryCents: number;
    taxInternationalCents: number;
    venuePayoutCents: number;
    artistPayoutCents: number;
    promoterPayoutCents: number;
    /** Which party was the merchant, and so which share never reached iHYPE.
     *  See TicketOrder.settlementMode. Absent means PLATFORM. */
    settlementMode?: string | null;
    settlementAccountId?: string | null;
  },
  acceptedLineupSlots: { profileId: string; splitPercent: number }[],
) {
  const entries: Prisma.AccountsPayableEntryCreateManyInput[] = [];
  const push = (
    amountCents: number,
    category: AccountsPayableCategory,
    payeeLabel: string,
    note: string,
    profileId: string | null = null,
  ) => {
    if (amountCents <= 0) return;
    entries.push({
      ticketOrderId: order.id,
      showId: show.id,
      profileId,
      category,
      status: AccountsPayableStatus.PENDING,
      amountCents,
      payeeLabel,
      note,
    });
  };

  /* WHICH SHARES ACTUALLY REACHED THE PLATFORM.
   *
   * A payable is a promise to pay someone out of money iHYPE is holding. If
   * the money never arrived, the promise is a double payment waiting to
   * happen — and an undetectable one, because the entry looks exactly like a
   * legitimate payout and the transfer succeeds. Nothing downstream can catch
   * it, so it has to be right here.
   *
   *   VENUE_DIRECT  the charge was on the venue's own account. Their share and
   *                 the tax never left it — they are the merchant and they
   *                 remit. iHYPE holds only the artist's and promoter's shares
   *                 as an application fee, so only those two get payables.
   *   DESTINATION   Stripe routed the ARTIST's share with the charge; the rest
   *                 came back to iHYPE as the application fee.
   *   PLATFORM      everything captured to iHYPE; every share is a payable.
   */
  const venueIsMerchant = order.settlementMode === 'VENUE_DIRECT';
  const artistWasRouted = order.settlementMode === 'DESTINATION' || Boolean(order.settlementAccountId && order.settlementMode !== 'VENUE_DIRECT');

  if (!venueIsMerchant) {
    push(order.taxLocalCents, 'TAX_LOCAL', 'Local tax payable', 'Captured ticket order tax.');
    push(order.taxStateCents, 'TAX_STATE', 'State / province tax payable', 'Captured ticket order tax.');
    push(order.taxCountryCents, 'TAX_COUNTRY', 'Country tax payable', 'Captured ticket order tax.');
    push(order.taxInternationalCents, 'TAX_INTERNATIONAL', 'International tax payable', 'Captured ticket order tax.');
    push(order.venuePayoutCents, 'VENUE_PAYOUT', 'Venue payout', 'Venue payout from captured ticket order.', show.venueProfileId);
  }

  /* NO PAYABLE FOR A SHARE STRIPE ALREADY ROUTED.
   *
   * On a destination charge the act's share never reached the platform — it
   * went to their account with the charge, and the platform only ever received
   * the application fee (venue + promoter + tax + processing). Writing an
   * ARTIST_PAYOUT entry here anyway would have `triggerShowPayouts()` transfer
   * that share a SECOND time, out of money belonging to the venue, the
   * promoter and a tax authority. Nothing downstream would catch it: the entry
   * would look exactly like every other artist payout and the transfer would
   * succeed.
   *
   * A lineup never takes this branch, because a lineup is never settled on
   * behalf of one act in the first place (see the purchase route) — but the
   * guard is written to cover both shapes rather than relying on that, since
   * the two decisions live in different files and only one of them is here.
   */
  if (artistWasRouted) {
    // Nothing to record. The act has been paid by Stripe, in full, already.
  } else if (acceptedLineupSlots.length > 0) {
    const perActShares = splitArtistPayoutAcrossLineup(order.artistPayoutCents, show.artistPayoutPercent, acceptedLineupSlots);
    for (const share of perActShares) {
      push(share.amountCents, 'ARTIST_PAYOUT', 'Artist payout (lineup split)', 'Artist payout (lineup split) from captured ticket order.', share.profileId);
    }
  } else {
    push(order.artistPayoutCents, 'ARTIST_PAYOUT', 'Artist payout', 'Artist payout from captured ticket order.', show.headlinerProfileId);
  }
  push(
    order.promoterPayoutCents,
    'PROMOTER_AFFILIATE',
    order.affiliatePromoterProfileId ? 'Affiliate promoter payout' : 'Promoter affiliate pool',
    'Affiliate payout from captured ticket order.',
    order.affiliatePromoterProfileId,
  );

  return entries;
}

export async function finalizeCapturedTicketOrder(
  tx: Tx,
  orderId: string,
  chargedAt = new Date(),
) {
  const order = await tx.ticketOrder.findUnique({
    where: { id: orderId },
    include: {
      show: { select: { id: true, venueProfileId: true, headlinerProfileId: true, artistPayoutPercent: true } },
      tickets: true,
    },
  });

  if (!order) throw new Error(`Ticket order ${orderId} not found.`);
  if (order.status === TicketOrderStatus.CAPTURED) return { order, tickets: order.tickets, changed: false };
  if (order.status !== TicketOrderStatus.RESERVED) {
    throw new Error(`Ticket order ${orderId} is not capturable from status ${order.status}.`);
  }

  const transitioned = await tx.ticketOrder.updateMany({
    where: { id: order.id, status: TicketOrderStatus.RESERVED },
    data: { status: TicketOrderStatus.CAPTURED, chargedAt },
  });
  if (transitioned.count !== 1) {
    const current = await tx.ticketOrder.findUnique({ where: { id: order.id }, include: { tickets: true } });
    if (current?.status === TicketOrderStatus.CAPTURED) {
      return { order: current, tickets: current.tickets, changed: false };
    }
    throw new Error(`Ticket order ${order.id} changed while it was being captured.`);
  }

  const tickets = await tx.ticket.createManyAndReturn({
    data: Array.from({ length: order.quantity }, () => ({
      serializedId: createSerializedTicketId(),
      ticketOrderId: order.id,
      showId: order.showId,
      venueProfileId: order.show.venueProfileId,
      holderName: order.buyerName,
      holderEmail: order.buyerEmail,
    })),
  });

  // Only ACCEPTED slots are ever paid — a show can't reach SCHEDULED with a
  // pending/declined slot in the first place (see the lineup-response
  // route), but this stays defensive rather than trusting that invariant.
  const acceptedLineupSlots = await tx.showLineupSlot.findMany({
    where: { showId: order.showId, status: 'ACCEPTED' },
    select: { profileId: true, splitPercent: true },
  });

  const payableEntries = buildPayableEntries(order.show, order, acceptedLineupSlots);
  if (payableEntries.length) await tx.accountsPayableEntry.createMany({ data: payableEntries });

  return { order: { ...order, status: TicketOrderStatus.CAPTURED, chargedAt }, tickets, changed: true };
}

/**
 * DB-side effects of a real refund, called only after Stripe has already
 * confirmed the refund succeeded (the route calling this is the source of
 * truth ordering — money moves first, then these records catch up, never
 * the other way around). Reuses VOID for "refunded" the same way it's
 * already used for "cancelled before capture" — everywhere else in the app
 * (`/tickets` list, etc.) already treats VOID as "no longer a live ticket."
 *
 * Also voids any still-PENDING AccountsPayableEntry rows for this order so
 * the payout cron can never pay out a refunded order. This is always safe
 * because payouts only ever run for ENDED shows (src/lib/show-payouts.ts),
 * and a refund is only allowed more than 48h before the show starts — so a
 * refundable order's payable entries are guaranteed to still be PENDING,
 * never RELEASED, at refund time.
 */
export async function refundCapturedTicketOrder(tx: Tx, orderId: string) {
  const order = await tx.ticketOrder.findUnique({
    where: { id: orderId },
    select: { id: true, showId: true, quantity: true, status: true },
  });
  if (!order || order.status !== TicketOrderStatus.CAPTURED) return false;

  const transitioned = await tx.ticketOrder.updateMany({
    where: { id: order.id, status: TicketOrderStatus.CAPTURED },
    data: { status: TicketOrderStatus.VOID },
  });
  if (transitioned.count !== 1) return false;

  await tx.ticket.updateMany({
    where: { ticketOrderId: order.id, status: 'VALID' },
    data: { status: 'VOID' },
  });

  const released = await tx.show.updateMany({
    where: { id: order.showId, ticketsSoldCount: { gte: order.quantity } },
    data: { ticketsSoldCount: { decrement: order.quantity } },
  });
  if (released.count !== 1) {
    throw new Error(`Ticket order ${order.id} was refunded without releasing sold capacity.`);
  }

  await tx.accountsPayableEntry.updateMany({
    where: { ticketOrderId: order.id, status: AccountsPayableStatus.PENDING },
    data: { status: AccountsPayableStatus.VOID },
  });

  return true;
}

export async function voidReservedTicketOrder(tx: Tx, orderId: string) {
  const order = await tx.ticketOrder.findUnique({
    where: { id: orderId },
    select: { id: true, showId: true, quantity: true, status: true },
  });
  if (!order || order.status !== TicketOrderStatus.RESERVED) return false;

  const transitioned = await tx.ticketOrder.updateMany({
    where: { id: order.id, status: TicketOrderStatus.RESERVED },
    data: { status: TicketOrderStatus.VOID },
  });
  if (transitioned.count !== 1) return false;

  const released = await tx.show.updateMany({
    where: { id: order.showId, ticketsSoldCount: { gte: order.quantity } },
    data: { ticketsSoldCount: { decrement: order.quantity } },
  });
  if (released.count !== 1) {
    throw new Error(`Ticket order ${order.id} was voided without releasing reserved capacity.`);
  }

  return true;
}
