import { describe, expect, it } from 'vitest';
import type { ShowStatus } from '@prisma/client';
import {
  canViewShow,
  formatShowWhere,
  isTicketingOpen,
  resolveShowSplits,
  splitFaceValueCents,
} from '@/lib/show-detail';

const CREATOR = 'user_creator';
const draft = { status: 'DRAFT' as ShowStatus, creatorId: CREATOR };
const scheduled = { status: 'SCHEDULED' as ShowStatus, creatorId: CREATOR };

describe('canViewShow', () => {
  it('shows a published show to anyone, signed in or not', () => {
    for (const status of ['SCHEDULED', 'LIVE', 'ENDED', 'CANCELED'] as ShowStatus[]) {
      expect(canViewShow({ status, creatorId: CREATOR }, { userId: null, isAdmin: false })).toBe(true);
    }
    expect(canViewShow(scheduled, { userId: 'someone', isAdmin: false })).toBe(true);
  });

  it('hides a draft from strangers and from signed-in non-owners', () => {
    expect(canViewShow(draft, { userId: null, isAdmin: false })).toBe(false);
    expect(canViewShow(draft, { userId: 'user_other', isAdmin: false })).toBe(false);
  });

  it('lets the creator and an admin preview a draft', () => {
    // The divergence this file exists for: the shell copy of this page used to
    // hide a draft from its own creator while the public URL showed it.
    expect(canViewShow(draft, { userId: CREATOR, isAdmin: false })).toBe(true);
    expect(canViewShow(draft, { userId: 'user_admin', isAdmin: true })).toBe(true);
  });

  it('does not treat a draft with no creator as everyone’s', () => {
    expect(canViewShow({ status: 'DRAFT', creatorId: null }, { userId: 'anyone', isAdmin: false })).toBe(false);
    expect(canViewShow({ status: 'DRAFT', creatorId: null }, { userId: null, isAdmin: false })).toBe(false);
  });
});

describe('isTicketingOpen', () => {
  const now = new Date('2026-08-14T12:00:00.000Z');
  const at = (offsetMs: number) => new Date(now.getTime() + offsetMs);

  it('is open for a live show whatever the opening time says', () => {
    expect(isTicketingOpen({ status: 'LIVE', ticketingOpensAt: null }, now)).toBe(true);
    expect(isTicketingOpen({ status: 'LIVE', ticketingOpensAt: at(60_000) }, now)).toBe(true);
  });

  it('opens at the opening time, inclusive', () => {
    expect(isTicketingOpen({ status: 'SCHEDULED', ticketingOpensAt: at(1) }, now)).toBe(false);
    expect(isTicketingOpen({ status: 'SCHEDULED', ticketingOpensAt: now }, now)).toBe(true);
    expect(isTicketingOpen({ status: 'SCHEDULED', ticketingOpensAt: at(-1) }, now)).toBe(true);
  });

  it('treats an unset opening time as closed, not as on sale', () => {
    expect(isTicketingOpen({ status: 'SCHEDULED', ticketingOpensAt: null }, now)).toBe(false);
    expect(isTicketingOpen({ status: 'DRAFT', ticketingOpensAt: null }, now)).toBe(false);
  });
});

describe('resolveShowSplits', () => {
  it('states the split only when the show is ticketed with both shares set', () => {
    expect(resolveShowSplits({ artistPayoutPercent: 75, venuePayoutPercent: 25 })).toEqual({ artist: 75, venue: 25 });
    expect(resolveShowSplits({ artistPayoutPercent: null, venuePayoutPercent: 25 })).toBeNull();
    expect(resolveShowSplits({ artistPayoutPercent: 75, venuePayoutPercent: null })).toBeNull();
  });

  it('states the charter split even over a row still carrying the retired one', () => {
    // A sale is made under the charter constants, so the page must say them.
    expect(resolveShowSplits({ artistPayoutPercent: 70, venuePayoutPercent: 20 })).toEqual({ artist: 75, venue: 25 });
  });
});

describe('formatShowWhere', () => {
  it('joins whatever parts exist', () => {
    expect(formatShowWhere({ name: 'The Armory', city: 'Portland' })).toBe('The Armory · Portland');
    expect(formatShowWhere({ name: 'The Armory', city: null })).toBe('The Armory');
    expect(formatShowWhere({ name: null, city: 'Portland' })).toBe('Portland');
    expect(formatShowWhere(null)).toBe('');
    expect(formatShowWhere({ name: null, city: null })).toBe('');
  });
});

describe('splitFaceValueCents — the card fee off the top, then 75/25', () => {
  const charter = { artist: 75, venue: 25 };

  it('splits an $18 ticket the way the purchase route does', () => {
    // Stripe's standard 2.9% + 30c on 1800 is 82c; the 1718 left splits 75/25.
    expect(splitFaceValueCents(1800, charter)).toEqual({ fee: 82, artist: 1288, venue: 430 });
  });

  it('always sums to exactly the face value, however awkward the price', () => {
    const disagreements: string[] = [];
    for (let cents = 100; cents <= 15000; cents += 1) {
      const shares = splitFaceValueCents(cents, charter)!;
      if (shares.fee + shares.artist + shares.venue !== cents) disagreements.push(`${cents}c`);
    }
    expect(disagreements).toEqual([]);
  });

  it('agrees with the purchase arithmetic on every price', async () => {
    const { calculateTicketOrderFinancials } = await import('@/lib/ticketing');
    for (const cents of [500, 999, 1800, 1995, 2500, 12345]) {
      const shares = splitFaceValueCents(cents, charter)!;
      const order = calculateTicketOrderFinancials({ ticketPriceCents: cents, quantity: 1, venuePayoutPercent: 25, artistPayoutPercent: 75 });
      expect({ fee: order.stripeFeeCents, artist: order.artistPayoutCents, venue: order.venuePayoutCents }).toEqual(shares);
    }
  });

  it('gives a free show, a price the fee would swallow and a fractional price no figures', () => {
    expect(splitFaceValueCents(0, charter)).toBeNull();
    expect(splitFaceValueCents(-100, charter)).toBeNull();
    expect(splitFaceValueCents(30, charter)).toBeNull();
    expect(splitFaceValueCents(19.5, charter)).toBeNull();
  });
});
