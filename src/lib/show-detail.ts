import { stripeCutOf } from '@/lib/stripe-fees';
import { ARTIST_SHARE_PERCENT, VENUE_SHARE_PERCENT, calculateTicketOrderPayouts } from '@/lib/ticketing';
import type { ShowStatus } from '@prisma/client';

/**
 * The rules a show detail page enforces, in one place.
 *
 * A show is rendered by TWO routes: `/shows/[slug]`, which is public and is the
 * URL people share to sell tickets, and `/app/shows/[slug]`, which is the same
 * show inside the signed-in shell. They cannot be collapsed into one route —
 * the public one has to render logged out and the shell one requires a session
 * — so they will stay two pages, and the question is only whether they agree.
 *
 * They did not. Every rule below had drifted between them by the time this file
 * was written, and each divergence was invisible from either page alone:
 *
 *  - **Draft visibility.** The public page lets a show's own creator, and an
 *    admin, preview a DRAFT; the shell page returned "not found" to everyone,
 *    so an organiser opening their own unpublished show from the shell was told
 *    it did not exist while the other URL showed it to them.
 *  - **Promoter attribution.** The shell page shipped passing `null`, silently
 *    dropping the 10% credit for every ticket bought through the new shell —
 *    fixed there, and recorded in that file's own comment.
 *  - **The split panel.** Both gate on the percentages being set rather than
 *    defaulting them, for the same reason, and that reason is worth stating
 *    once: this is where money changes hands, and a default split shown
 *    because the show has none is a promise the payout engine never made.
 *
 * These are pure and tested. Each page keeps its own query and its own layout —
 * the design gives the shell a deliberately slimmer surface — but neither gets
 * to hold its own opinion about who may see a draft or when ticketing opens.
 */

export type ShowVisibility = {
  status: ShowStatus;
  /** The account that created the show; may preview it while it is a DRAFT. */
  creatorId: string | null;
};

export type ShowViewer = {
  userId: string | null;
  isAdmin: boolean;
};

/**
 * Whether this viewer may see this show at all.
 *
 * A DRAFT is private: it is how a lineup-pending show stays unbookable while
 * the acts are still deciding. Its creator and an admin can preview it; for
 * everyone else the page must answer exactly as it does for a show that does
 * not exist, because "this show exists but is not public yet" is not something
 * a stranger should be able to learn from the difference between two errors.
 */
export function canViewShow(show: ShowVisibility, viewer: ShowViewer): boolean {
  if (show.status !== 'DRAFT') return true;
  if (viewer.isAdmin) return true;
  return Boolean(viewer.userId && show.creatorId && viewer.userId === show.creatorId);
}

export type ShowTicketing = {
  status: ShowStatus;
  ticketingOpensAt: Date | null;
};

/**
 * Whether tickets can be bought right now.
 *
 * A LIVE show is always open — someone standing at the door can still buy.
 * Otherwise it opens at `ticketingOpensAt`, and a show with no opening time
 * set is NOT open: the field is venue-controlled, and treating "not configured"
 * as "on sale" would sell tickets to a show whose organiser has not opened the
 * doors.
 */
export function isTicketingOpen(show: ShowTicketing, now: Date = new Date()): boolean {
  if (show.status === 'LIVE') return true;
  return Boolean(show.ticketingOpensAt && show.ticketingOpensAt <= now);
}

export type ShowSplitSource = {
  artistPayoutPercent: number | null;
  venuePayoutPercent: number | null;
};

export type ShowSplits = {
  artist: number;
  venue: number;
};

/**
 * The charter split for this show, or null when it is not ticketed.
 *
 * Null whenever the artist or venue share is missing — see the header. The
 * NUMBERS are the charter's (75/25 since 2026-09-25), never the row's: a show
 * created under 70/20/10 carried those percentages until the migration moved
 * it, and a sale is always made under the charter constants, so the page must
 * state the same split the purchase route will use.
 */
export function resolveShowSplits(show: ShowSplitSource): ShowSplits | null {
  if (show.artistPayoutPercent === null || show.venuePayoutPercent === null) return null;
  return { artist: ARTIST_SHARE_PERCENT, venue: VENUE_SHARE_PERCENT };
}

/**
 * What one ticket's face value becomes, in cents: Stripe's card fee first,
 * then the artist's and the venue's shares of what is left.
 *
 * The same arithmetic the purchase route runs (`calculateTicketOrderPayouts`
 * with the standard-rate fee on the face value), so a page can never state a
 * split the sale does not make. The three always sum to the face value. Tax is
 * not in it: the venue collects and remits tax as the merchant, and the page
 * states the split of the ticket price.
 */
export function splitFaceValueCents(
  faceValueCents: number,
  splits: ShowSplits,
): { fee: number; artist: number; venue: number } | null {
  if (!Number.isFinite(faceValueCents) || !Number.isInteger(faceValueCents) || faceValueCents <= 0) return null;
  const fee = stripeCutOf(faceValueCents);
  if (fee >= faceValueCents) return null;
  const payouts = calculateTicketOrderPayouts({
    ticketPriceCents: faceValueCents,
    quantity: 1,
    venuePayoutPercent: splits.venue,
    artistPayoutPercent: splits.artist,
    stripeFeeCents: fee,
  });
  return { fee, artist: payouts.artistPayoutCents, venue: payouts.venuePayoutCents };
}

/** "The Armory · Portland" — the one-line place, from whatever parts exist. */
export function formatShowWhere(venue: { name?: string | null; city?: string | null } | null): string {
  if (!venue) return '';
  return [venue.name, venue.city].filter(Boolean).join(' · ');
}
