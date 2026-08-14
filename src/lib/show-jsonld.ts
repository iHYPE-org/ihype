import type { ShowStatus } from '@prisma/client';

/**
 * The structured data a show publishes to search engines.
 *
 * This is the one place iHYPE talks to the open web about a show. A local
 * music platform lives on being findable — someone searching "shows in
 * Portland this weekend" is the whole funnel — and event rich results are how
 * a show reaches that person without an ad. So the markup is worth getting
 * exactly right, and it was wrong in three ways that all pointed the same
 * direction: telling search engines something the product does not do.
 *
 *  1. **`eventStatus` never said cancelled.** A CANCELED show published
 *     `EventScheduled`. The product has a real cancellation flow that refunds
 *     every order, and the page itself renders the cancellation notice — while
 *     the markup underneath it kept telling Google the show was on. That is the
 *     one error in this file with a person standing outside a dark venue at the
 *     end of it.
 *  2. **`EventPast` is not a schema.org value.** There are five —
 *     EventScheduled, EventCancelled, EventMovedOnline, EventPostponed,
 *     EventRescheduled — and every ENDED show was emitting a sixth, which makes
 *     the whole block invalid rather than partly right. A past event stays
 *     `EventScheduled`; `endDate` is what says it is over.
 *  3. **`MixedEventAttendanceMode` claimed an online option that does not
 *     exist.** iHYPE hosts no video and no livestream — it is a brand constant,
 *     not an oversight — so a real show is `OfflineEventAttendanceMode`.
 *
 * And one omission, which is the reason to touch this at all: **no `offers`**.
 * Price and availability are what make a ticketed event eligible for the event
 * experiences in search, and every field needed was already on the row. A
 * ticketing product publishing no price to search engines is the gap here.
 *
 * Pure and tested. The page passes in what it already queried.
 */

export type ShowJsonLdInput = {
  slug: string;
  title: string;
  description: string | null;
  status: ShowStatus;
  startsAt: Date;
  endsAt: Date | null;
  posterImage: string | null;
  isRadioShow: boolean;
  isTicketed: boolean;
  ticketPriceCents: number;
  ticketCapacity: number | null;
  ticketsSoldCount: number;
  ticketingOpensAt: Date | null;
  headlinerName: string | null;
  venue: {
    name: string;
    addressLine1?: string | null;
    city?: string | null;
    stateRegion?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
};

/** The five real values. There is no `EventPast`. */
const EVENT_STATUS: Record<string, string> = {
  CANCELED: 'https://schema.org/EventCancelled',
  DEFAULT: 'https://schema.org/EventScheduled',
};

function offers(show: ShowJsonLdInput, base: string) {
  // An unticketed show has nothing to offer, and a free one is a real offer at
  // price 0 — those are different, and collapsing them would either hide free
  // shows or invent a price for shows that are not sold here at all.
  if (!show.isTicketed) return null;

  const soldOut = show.ticketCapacity !== null && show.ticketsSoldCount >= show.ticketCapacity;
  return {
    '@type': 'Offer',
    url: `${base}/shows/${show.slug}`,
    price: (show.ticketPriceCents / 100).toFixed(2),
    priceCurrency: 'USD',
    availability: soldOut
      ? 'https://schema.org/SoldOut'
      : 'https://schema.org/InStock',
    /* When tickets went (or go) on sale. Google reads this, and it is the field
       that distinguishes "not on sale yet" from "gone". */
    ...(show.ticketingOpensAt ? { validFrom: show.ticketingOpensAt.toISOString() } : {}),
  };
}

function place(venue: NonNullable<ShowJsonLdInput['venue']>) {
  return {
    '@type': 'Place',
    name: venue.name,
    address: {
      '@type': 'PostalAddress',
      // Every part that exists, and none that does not: an empty string in an
      // address is worse than an absent field, because it validates.
      ...(venue.addressLine1 ? { streetAddress: venue.addressLine1 } : {}),
      ...(venue.city ? { addressLocality: venue.city } : {}),
      ...(venue.stateRegion ? { addressRegion: venue.stateRegion } : {}),
      ...(venue.postalCode ? { postalCode: venue.postalCode } : {}),
      ...(venue.country ? { addressCountry: venue.country } : {}),
    },
  };
}

export function buildShowJsonLd(show: ShowJsonLdInput, base: string): Record<string, unknown> {
  /* A radio episode is not an event: it has no venue, no door time and no
     tickets, so it publishes as a RadioEpisode and skips everything below. */
  if (show.isRadioShow) {
    return {
      '@context': 'https://schema.org',
      '@type': 'RadioEpisode',
      name: show.title,
      url: `${base}/shows/${show.slug}`,
      ...(show.description ? { description: show.description } : {}),
      ...(show.posterImage ? { image: show.posterImage } : {}),
      ...(show.headlinerName
        ? { byArtist: { '@type': 'MusicGroup', name: show.headlinerName } }
        : {}),
    };
  }

  const offer = offers(show, base);

  return {
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    name: show.title,
    url: `${base}/shows/${show.slug}`,
    ...(show.description ? { description: show.description } : {}),
    ...(show.posterImage ? { image: show.posterImage } : {}),
    eventStatus: EVENT_STATUS[show.status] ?? EVENT_STATUS.DEFAULT,
    // No video, no livestream — a brand constant, so never Mixed or Online.
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    startDate: show.startsAt.toISOString(),
    ...(show.endsAt ? { endDate: show.endsAt.toISOString() } : {}),
    ...(show.venue ? { location: place(show.venue) } : {}),
    ...(show.headlinerName
      ? { performer: { '@type': 'MusicGroup', name: show.headlinerName } }
      : {}),
    ...(offer ? { offers: offer } : {}),
    /* Who is selling. iHYPE takes 0% of a ticket, and naming the organiser is
       what lets a search result attribute the sale to the platform people
       actually bought from. */
    organizer: { '@type': 'Organization', name: 'iHYPE', url: base },
  };
}
