import { isTicketingOpen, type ShowTicketing } from '@/lib/show-detail';

/**
 * The trail of a show row on a public profile — the one word a fan reads
 * before anything else (2026-09-02, owner: "a simple layout with relevant
 * information quick to access for fans").
 *
 * Derived from the same two rules the show page itself uses, so the row and
 * the page cannot disagree: `upcomingShowWhere` already lists a LIVE show
 * however long ago it started, and `isTicketingOpen` decides whether a ticket
 * can be bought right now. Before this, a show on stage rendered identically
 * to one next month, and every row said "Get ticket" whether or not a ticket
 * could be got.
 *
 * Pure, so both profile pages share it and a test can pin the wording.
 */
export type ShowRowSource = ShowTicketing & {
  isTicketed: boolean;
  ticketPriceCents: number;
};

export type RowTrail = { label: string; tone: 'live' | 'sale' | 'quiet' };

export function showRowTrail(show: ShowRowSource, now: Date = new Date()): RowTrail | null {
  if (show.status === 'LIVE') return { label: 'On stage now', tone: 'live' };
  // An unticketed show has no sale to report; its time is already in the meta.
  if (!show.isTicketed) return null;
  if (isTicketingOpen(show, now)) return { label: 'On sale', tone: 'sale' };
  return { label: 'Tickets soon', tone: 'quiet' };
}

/**
 * The face value as a fan reads it, or null when the show sells no tickets.
 * A ticketed show at zero cents is a free ticket, which is still a ticket.
 */
export function formatTicketPrice(show: Pick<ShowRowSource, 'isTicketed' | 'ticketPriceCents'>): string | null {
  if (!show.isTicketed) return null;
  if (show.ticketPriceCents <= 0) return 'Free';
  const dollars = show.ticketPriceCents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}
