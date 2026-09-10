/**
 * Where a profile answers its booking requests.
 *
 * The inbox lived at one URL under `/app/me/venues/`, gated on the profile
 * being a VENUE — while the requests it lists are addressed to whoever the
 * sender picked, and the demand radar's whole purpose is a venue writing to
 * an ARTIST. So every offer an artist received pointed at a page that
 * answered them 404, and the count on their dashboard was unlinked text.
 *
 * One function, so the notification, the dashboard link and the page cannot
 * disagree about where that is.
 */
export type BookingInboxProfileType = string | null | undefined;

export function bookingInboxPath(type: BookingInboxProfileType, slug: string): string {
  const segment = type === 'VENUE' ? 'venues' : 'artists';
  return `/app/me/${segment}/${slug}/booking-inbox`;
}
