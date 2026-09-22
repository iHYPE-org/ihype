import { formatDoorTime, formatUsd } from '@/lib/format-locale';
import type { Locale } from '@/lib/i18n/locales';
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
export function formatTicketPrice(show: Pick<ShowRowSource, 'isTicketed' | 'ticketPriceCents'>, locale: Locale): string | null {
  if (!show.isTicketed) return null;
  if (show.ticketPriceCents <= 0) return 'Free';
  return formatUsd(locale, show.ticketPriceCents, 'auto');
}

/**
 * The clock alone, on the VENUE's clock. A row already carries the date in
 * its date block, so the meta line repeating "Sep 9, 2026" beside it said the
 * same thing twice. Until 2026-09-22 this was a zoneless `timeStyle: 'short'`,
 * so both profile calendars read an 8pm Portland show as "12:00 AM" on the
 * Worker (row 464's defect, surviving in a helper the guard could not see
 * because `.startsAt` was on the caller's line and the formatter on this one).
 */
export function formatShowClock(date: Date, locale: Locale, timeZone: string | null): string {
  return formatDoorTime(locale, date, timeZone, { hour: 'numeric', minute: '2-digit' });
}
