import { describe, expect, it } from 'vitest';
import type { ShowStatus } from '@prisma/client';
import {
  canViewShow,
  formatShowWhere,
  isTicketingOpen,
  resolveShowSplits,
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
