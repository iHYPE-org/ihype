/**
 * WHO WAS THE MERCHANT ON A TICKET ORDER, read off `TicketOrder.settlementMode`.
 *
 *   VENUE_KEEPS_ALL  (2026-09-27, DESIGN_SYNC row 528) the charge is on the
 *                    venue's own Stripe account with NO application fee: the
 *                    venue keeps every cent and pays each act itself under the
 *                    signed Show Revenue Split Agreement. iHYPE holds nothing,
 *                    so the order writes no payables at all.
 *   VENUE_DIRECT     (2026-09-25 to 09-27) the charge is on the venue's account
 *                    and iHYPE claimed the artist's share as an application fee
 *                    and paid it out after the show. Orders sold then still
 *                    refund and pay out this way.
 *   DESTINATION / PLATFORM  older modes, kept for the orders sold under them.
 *
 * One module so the refund, the webhook guard, the payables and the cancel
 * route cannot disagree about which modes put the charge on the venue.
 */
export const VENUE_KEEPS_ALL = 'VENUE_KEEPS_ALL';

/** The charge lives on the venue's connected account (Stripe-Account scoped). */
export function isVenueMerchantMode(mode: string | null | undefined): boolean {
  return mode === 'VENUE_DIRECT' || mode === VENUE_KEEPS_ALL;
}

/** iHYPE claimed an application fee on the charge (and so must return it on a refund). */
export function carriesApplicationFee(mode: string | null | undefined): boolean {
  return mode === 'VENUE_DIRECT';
}
