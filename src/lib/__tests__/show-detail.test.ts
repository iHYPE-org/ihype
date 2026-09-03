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
  it('states the split only when the artist and venue shares both exist', () => {
    expect(resolveShowSplits({ artistPayoutPercent: 70, venuePayoutPercent: 20, promoterPayoutPercent: 10 }))
      .toEqual({ artist: 70, venue: 20, promoter: 10 });
    expect(resolveShowSplits({ artistPayoutPercent: null, venuePayoutPercent: 20, promoterPayoutPercent: 10 })).toBeNull();
    expect(resolveShowSplits({ artistPayoutPercent: 70, venuePayoutPercent: null, promoterPayoutPercent: 10 })).toBeNull();
  });

  it('carries a zero promoter share rather than dropping the slice', () => {
    // `Show.promoterPayoutPercent` is `Int @default(10)` — never null — so 0
    // means a real zero share and has to survive as one.
    expect(resolveShowSplits({ artistPayoutPercent: 80, venuePayoutPercent: 20, promoterPayoutPercent: 0 }))
      .toEqual({ artist: 80, venue: 20, promoter: 0 });
  });

  it('does not invent the charter split when the show carries a different one', () => {
    expect(resolveShowSplits({ artistPayoutPercent: 60, venuePayoutPercent: 30, promoterPayoutPercent: 10 }))
      .toEqual({ artist: 60, venue: 30, promoter: 10 });
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

describe('splitFaceValueCents', () => {
  const evenSplit = { artist: 70, venue: 20, promoter: 10 };

  it('splits a whole-dollar face value the obvious way', () => {
    expect(splitFaceValueCents(1800, evenSplit)).toEqual({ artist: 1260, venue: 360, promoter: 180 });
  });

  it('always sums to exactly the face value, however awkward the price', () => {
    for (const price of [1, 7, 99, 333, 1799, 2501, 9999, 123_457]) {
      const shares = splitFaceValueCents(price, evenSplit)!;
      expect(shares.artist + shares.venue + shares.promoter, `price ${price}`).toBe(price);
    }
  });

  it('sums exactly for a show that moved its own percentages', () => {
    for (const splits of [
      { artist: 60, venue: 30, promoter: 10 },
      { artist: 80, venue: 20, promoter: 0 },
      { artist: 45, venue: 45, promoter: 10 },
      { artist: 33, venue: 33, promoter: 34 },
    ]) {
      const shares = splitFaceValueCents(2999, splits)!;
      expect(shares.artist + shares.venue + shares.promoter, JSON.stringify(splits)).toBe(2999);
    }
  });

  it('gives a free show and a nonsense split no figures rather than $0.00 rows', () => {
    expect(splitFaceValueCents(0, evenSplit)).toBeNull();
    expect(splitFaceValueCents(-100, evenSplit)).toBeNull();
    expect(splitFaceValueCents(1800, { artist: 0, venue: 0, promoter: 0 })).toBeNull();
  });
});

/* The float version this replaced, kept so the test states what it is testing
   AGAINST: three independent roundings of a dollar float, which is what
   `/shows/[slug]` painted its split bar with until 2026-09-03. */
function floatSplitDollars(faceValueCents: number, pct: number): string {
  return ((faceValueCents / 100) * (pct / 100)).toFixed(2);
}

describe('the split a reader is shown is the split that is paid', () => {
  const charter = { artist: 70, venue: 20, promoter: 10 };

  it('never disagrees with the payout arithmetic, at any price', () => {
    const disagreements: string[] = [];
    for (let cents = 100; cents <= 15000; cents += 1) {
      const shares = splitFaceValueCents(cents, charter)!;
      // What the reader sees must sum to exactly what they are charged.
      if (shares.artist + shares.venue + shares.promoter !== cents) {
        disagreements.push(`${cents}c does not sum`);
      }
    }
    expect(disagreements).toEqual([]);
  });

  it('is why the float version had to go — it differs on ordinary prices', () => {
    /* $19.95 is the case that made this concrete: the artist row read $13.96
       against the $13.97 actually paid. If this ever stops differing the float
       version is no longer a hazard and this test has lost its subject. */
    const shares = splitFaceValueCents(1995, charter)!;
    expect((shares.artist / 100).toFixed(2)).toBe('13.97');
    expect(floatSplitDollars(1995, 70)).toBe('13.96');
  });
});
