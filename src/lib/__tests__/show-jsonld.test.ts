import { describe, expect, it } from 'vitest';
import type { ShowStatus } from '@prisma/client';
import { buildShowJsonLd, type ShowJsonLdInput } from '@/lib/show-jsonld';

const BASE = 'https://ihype.org';

const show = (over: Partial<ShowJsonLdInput> = {}): ShowJsonLdInput => ({
  slug: 'harbour-lights-night',
  title: 'Harbour Lights Night',
  description: 'Three acts on the eastern prom.',
  status: 'SCHEDULED' as ShowStatus,
  startsAt: new Date('2026-09-04T23:00:00.000Z'),
  endsAt: new Date('2026-09-05T03:00:00.000Z'),
  posterImage: 'https://cdn.ihype.org/poster.jpg',
  isRadioShow: false,
  isTicketed: true,
  ticketPriceCents: 1800,
  ticketCapacity: 200,
  ticketsSoldCount: 40,
  ticketingOpensAt: new Date('2026-08-01T12:00:00.000Z'),
  headlinerName: 'Vera Solano',
  venue: {
    name: 'The Armory',
    addressLine1: '20 Fore St',
    city: 'Portland',
    stateRegion: 'ME',
    postalCode: '04101',
    country: 'US',
  },
  ...over,
});

/** The five values schema.org actually defines. */
const VALID_EVENT_STATUS = new Set([
  'https://schema.org/EventScheduled',
  'https://schema.org/EventCancelled',
  'https://schema.org/EventMovedOnline',
  'https://schema.org/EventPostponed',
  'https://schema.org/EventRescheduled',
]);

describe('buildShowJsonLd — event status', () => {
  it('publishes a cancelled show as cancelled', () => {
    // The one that had a person standing outside a dark venue at the end of it:
    // a CANCELED show used to publish EventScheduled.
    const ld = buildShowJsonLd(show({ status: 'CANCELED' as ShowStatus }), BASE);
    expect(ld.eventStatus).toBe('https://schema.org/EventCancelled');
  });

  it('only ever emits a real schema.org status', () => {
    // `EventPast` is not one, and every ENDED show used to emit it — which
    // invalidates the whole block rather than one field.
    const statuses: ShowStatus[] = ['DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELED'];
    for (const status of statuses) {
      const ld = buildShowJsonLd(show({ status }), BASE);
      expect(VALID_EVENT_STATUS.has(String(ld.eventStatus)), `${status} → ${ld.eventStatus}`).toBe(true);
    }
  });

  it('marks a past show with an end date rather than a made-up status', () => {
    const ld = buildShowJsonLd(show({ status: 'ENDED' as ShowStatus }), BASE);
    expect(ld.eventStatus).toBe('https://schema.org/EventScheduled');
    expect(ld.endDate).toBe('2026-09-05T03:00:00.000Z');
  });
});

describe('buildShowJsonLd — attendance', () => {
  it('is always offline: iHYPE hosts no video or livestream', () => {
    expect(buildShowJsonLd(show(), BASE).eventAttendanceMode)
      .toBe('https://schema.org/OfflineEventAttendanceMode');
  });
});

describe('buildShowJsonLd — offers', () => {
  it('publishes price, currency and availability for a ticketed show', () => {
    expect(buildShowJsonLd(show(), BASE).offers).toEqual({
      '@type': 'Offer',
      url: `${BASE}/shows/harbour-lights-night`,
      price: '18.00',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      validFrom: '2026-08-01T12:00:00.000Z',
    });
  });

  it('says sold out once capacity is reached', () => {
    const ld = buildShowJsonLd(show({ ticketsSoldCount: 200 }), BASE);
    expect((ld.offers as { availability: string }).availability).toBe('https://schema.org/SoldOut');
  });

  it('treats an uncapped show as in stock however many sold', () => {
    const ld = buildShowJsonLd(show({ ticketCapacity: null, ticketsSoldCount: 9999 }), BASE);
    expect((ld.offers as { availability: string }).availability).toBe('https://schema.org/InStock');
  });

  it('offers a free ticketed show at 0, and offers nothing for an unticketed one', () => {
    // Different things: free is a real offer, unticketed is not sold here.
    const free = buildShowJsonLd(show({ ticketPriceCents: 0 }), BASE);
    expect((free.offers as { price: string }).price).toBe('0.00');
    expect(buildShowJsonLd(show({ isTicketed: false }), BASE).offers).toBeUndefined();
  });
});

describe('buildShowJsonLd — place and shape', () => {
  it('publishes every address part that exists and none that does not', () => {
    expect((buildShowJsonLd(show(), BASE).location as { address: unknown }).address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '20 Fore St',
      addressLocality: 'Portland',
      addressRegion: 'ME',
      postalCode: '04101',
      addressCountry: 'US',
    });
    const sparse = buildShowJsonLd(
      show({ venue: { name: 'The Armory', city: 'Portland' } }),
      BASE,
    );
    // No empty strings: an empty address field validates and says nothing.
    expect((sparse.location as { address: Record<string, unknown> }).address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Portland',
    });
  });

  it('omits location entirely for a show with no venue', () => {
    expect(buildShowJsonLd(show({ venue: null }), BASE).location).toBeUndefined();
  });

  it('publishes a radio show as an episode, with no event fields at all', () => {
    const ld = buildShowJsonLd(show({ isRadioShow: true }), BASE);
    expect(ld['@type']).toBe('RadioEpisode');
    for (const eventField of ['eventStatus', 'eventAttendanceMode', 'offers', 'location', 'startDate']) {
      expect(ld[eventField], eventField).toBeUndefined();
    }
  });
});
