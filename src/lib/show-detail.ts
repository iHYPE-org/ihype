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

/* `resolveShowSplits()` and `splitFaceValueCents()` lived here until
   2026-09-29 (DESIGN_SYNC row 533). They stated the fixed 75/25 the charter
   carried for two days in September; since row 528 each act's share is the
   percentage it signed, so a page that names a split reads the live
   agreements (see `src/lib/artist-share.ts`) and both show pages gate the
   ticket card on `isTicketed` alone. */

/** "The Armory · Portland" — the one-line place, from whatever parts exist. */
export function formatShowWhere(venue: { name?: string | null; city?: string | null } | null): string {
  if (!venue) return '';
  return [venue.name, venue.city].filter(Boolean).join(' · ');
}
