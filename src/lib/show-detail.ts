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
 *    once: this is where money changes hands, and a split shown as 70/20/10
 *    because the real one is missing is a promise the payout engine never made.
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
  promoterPayoutPercent: number;
};

export type ShowSplits = {
  artist: number;
  venue: number;
  promoter: number;
};

/**
 * The 70/20/10 split for this show, or null when it cannot be stated.
 *
 * Null whenever the artist or venue share is missing — see the header. The
 * promoter share is NOT nullable and is not treated as though it were:
 * `Show.promoterPayoutPercent` is `Int @default(10)` in the schema, so every
 * show has one whether or not a promoter is attached to it. (This started out
 * typed as nullable on the reasoning that a show without a promoter would
 * carry no share. The schema disagrees, and the compiler said so.)
 */
export function resolveShowSplits(show: ShowSplitSource): ShowSplits | null {
  if (show.artistPayoutPercent === null || show.venuePayoutPercent === null) return null;
  return {
    artist: show.artistPayoutPercent,
    venue: show.venuePayoutPercent,
    promoter: show.promoterPayoutPercent,
  };
}

/**
 * What each share of the FACE VALUE is worth, in cents.
 *
 * The percentages alone are not enough on a purchase surface, and the design
 * system says why: "The 70/20/10 split is shown against **face value only**.
 * Against the total it would imply the artist's 70% includes money Stripe took."
 * The shell's split bar sat directly above a sale card whose bottom line is a
 * total carrying tax and Stripe's processing, and named no base at all — so a
 * buyer read "70% artist" against the number they were about to pay.
 *
 * Integer cents, and the LAST share absorbs the rounding remainder, so the three
 * always sum to exactly the face value. The same rule the payout entries follow
 * (`splitArtistPayoutAcrossLineup`): a display that does not add up invites
 * exactly the question the charter exists to answer.
 */
export function splitFaceValueCents(
  faceValueCents: number,
  splits: ShowSplits,
): { artist: number; venue: number; promoter: number } | null {
  if (!Number.isFinite(faceValueCents) || faceValueCents <= 0) return null;
  const total = splits.artist + splits.venue + splits.promoter;
  if (total <= 0) return null;

  const artist = Math.round((faceValueCents * splits.artist) / total);
  const venue = Math.round((faceValueCents * splits.venue) / total);
  /* Not rounded independently: the remainder has to land somewhere, and the
     promoter pool is the share the charter already describes as a pool rather
     than one party's fee. */
  return { artist, venue, promoter: faceValueCents - artist - venue };
}

/** "The Armory · Portland" — the one-line place, from whatever parts exist. */
export function formatShowWhere(venue: { name?: string | null; city?: string | null } | null): string {
  if (!venue) return '';
  return [venue.name, venue.city].filter(Boolean).join(' · ');
}
