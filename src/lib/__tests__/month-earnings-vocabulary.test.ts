import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

/*
 * TWO DASHBOARDS, ONE LABEL, OPPOSITE QUANTITIES.
 *
 * `getArtistDashboardStats` sums RELEASED `AccountsPayableEntry` rows paid this
 * month — money transferred. `getVenueDashboardData` sums the venue's split of
 * every CAPTURED order placed this month — money earned. Both cards are titled
 * "This Month", and both sub-lines used to read "Your … share · $0 iHYPE fee",
 * so one sold-out Saturday read banked to the venue and $0.00 to the act for
 * the ten days of the payout hold, with nothing on either card saying why.
 *
 * The arithmetic is NOT the thing to normalise: a `VENUE_DIRECT` venue is the
 * merchant on its own shows, so its 20% never becomes a payable at all, and a
 * released-only figure would read $0.00 for a venue holding the money. The
 * asymmetry is what the settlement modes do. What has to hold is that each
 * card names the quantity it is showing.
 */

const read = (p: string) => maskComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

const ARTIST_LIB = 'src/lib/artist-dashboard.ts';
const VENUE_LIB = 'src/lib/venue-dashboard.ts';
const ARTIST_PAGE = 'src/app/app/me/artists/[slug]/dashboard/page.tsx';
const VENUE_PAGE = 'src/app/app/me/venues/[slug]/dashboard/page.tsx';

/** The one sub-line under each "This Month" money figure. */
function monthSubline(source: string, marker: string): string {
  const at = source.indexOf(marker);
  expect(at, `${marker} not found — the card was renamed; re-derive this guard`).toBeGreaterThan(0);
  const window = source.slice(at, at + 900);
  const m = window.match(/t\('[A-Za-z.]*(?:thisMonthEarnedSub|paidOutThisMonth)',\s*'([^']+)'/);
  expect(m, 'the "This Month" card has no sub-line naming its quantity').not.toBeNull();
  return (m as RegExpMatchArray)[1];
}

describe('the two "This Month" money cards name which quantity they show', () => {
  it('the artist figure is still RELEASED payables and its sub-line says paid', () => {
    const lib = read(ARTIST_LIB);
    expect(lib).toMatch(/status:\s*'RELEASED'/);
    expect(lib).toMatch(/paidAt:\s*\{\s*gte:\s*startOfMonth\s*\}/);

    const sub = monthSubline(read(ARTIST_PAGE), 'thisMonthLabel');
    expect(sub.toLowerCase()).toContain('paid');
    // Never the venue's vocabulary: this money has left the platform balance.
    expect(sub.toLowerCase()).not.toContain('earned');
  });

  it('the venue figure is still captured orders and its sub-line says earned', () => {
    const lib = read(VENUE_LIB);
    expect(lib).toMatch(/thisMonthEarningsCents \+= order\.venuePayoutCents/);

    const sub = monthSubline(read(VENUE_PAGE), 'thisMonth');
    expect(sub.toLowerCase()).toContain('earned');
    /* Never "paid": a DESTINATION or PLATFORM venue has not been paid this
       yet, and a VENUE_DIRECT venue was paid by the buyer rather than by us. */
    expect(sub.toLowerCase()).not.toContain('paid');
  });

  it('the two sub-lines are not the same sentence', () => {
    const artist = monthSubline(read(ARTIST_PAGE), 'thisMonthLabel');
    const venue = monthSubline(read(VENUE_PAGE), 'thisMonth');
    expect(artist).not.toBe(venue);
  });
});
