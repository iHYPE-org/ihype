import { describe, expect, it, vi } from 'vitest';

// ticket-order-state imports @/lib/db for its type only, but the module graph
// still resolves it — same inert auto-mock pattern as show-payouts.test.ts.
vi.mock('@/lib/db', () => {
  const models = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  const db = new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string) {
      if (!models.has(prop)) {
        models.set(prop, {
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn().mockResolvedValue({}),
        });
      }
      return models.get(prop);
    },
  });
  return { db };
});

import { buildPayableEntries, splitArtistPayoutAcrossLineup } from '@/lib/ticket-order-state';

const slot = (profileId: string, splitPercent: number) => ({ profileId, splitPercent });

const sum = (rows: { amountCents: number }[]) => rows.reduce((t, r) => t + r.amountCents, 0);

describe('splitArtistPayoutAcrossLineup', () => {
  it('pays a single accepted act the whole artist share', () => {
    const rows = splitArtistPayoutAcrossLineup(7000, 70, [slot('a', 70)]);
    expect(rows).toEqual([{ profileId: 'a', amountCents: 7000 }]);
  });

  it('splits an even two-way lineup exactly', () => {
    const rows = splitArtistPayoutAcrossLineup(7000, 70, [slot('a', 35), slot('b', 35)]);
    expect(rows).toEqual([
      { profileId: 'a', amountCents: 3500 },
      { profileId: 'b', amountCents: 3500 },
    ]);
  });

  it('splits proportionally by each act\'s own percent, not evenly', () => {
    const rows = splitArtistPayoutAcrossLineup(7000, 70, [slot('head', 50), slot('sup', 20)]);
    expect(rows).toEqual([
      { profileId: 'head', amountCents: 5000 },
      { profileId: 'sup', amountCents: 2000 },
    ]);
  });

  it('never leaks or invents a cent on a payout that does not divide evenly', () => {
    // 3333 cents across three equal acts: 1111 each, no drift.
    // 1000 across three equal acts is the interesting one — 333.33 each.
    const rows = splitArtistPayoutAcrossLineup(1000, 70, [
      slot('a', 24),
      slot('b', 23),
      slot('c', 23),
    ]);
    expect(sum(rows)).toBe(1000);
    // The last act absorbs only the rounding drift, never a whole share.
    expect(rows[2].amountCents).toBeCloseTo(1000 * (23 / 70), -1);
  });

  it('sums to the full artist payout across many awkward splits', () => {
    for (const cents of [1, 7, 99, 101, 3333, 12345, 999999]) {
      const rows = splitArtistPayoutAcrossLineup(cents, 70, [
        slot('a', 40),
        slot('b', 17),
        slot('c', 13),
      ]);
      expect(sum(rows)).toBe(cents);
    }
  });

  it('falls back to the slots\' own total when the show has no artist percent', () => {
    const rows = splitArtistPayoutAcrossLineup(1000, null, [slot('a', 50), slot('b', 50)]);
    expect(sum(rows)).toBe(1000);
    expect(rows[0].amountCents).toBe(500);
  });

  it('returns nothing when there is no percentage to divide by', () => {
    expect(splitArtistPayoutAcrossLineup(5000, 0, [slot('a', 0)])).toEqual([]);
    expect(splitArtistPayoutAcrossLineup(5000, null, [])).toEqual([]);
  });

  // The regression this function was hardened for. The caller filters to
  // ACCEPTED slots; a show is not supposed to be able to sell tickets with a
  // pending/declined slot, but if that invariant ever breaks, the last act
  // must not silently pocket the missing act's entire share.
  it('does not hand a dropped act\'s share to whoever sorts last', () => {
    const full = splitArtistPayoutAcrossLineup(7000, 70, [slot('a', 35), slot('b', 35)]);
    expect(sum(full)).toBe(7000);

    // 'b' declined and was filtered out upstream; only 'a' (35 of 70) remains.
    const partial = splitArtistPayoutAcrossLineup(7000, 70, [slot('a', 35)]);
    expect(partial).toEqual([{ profileId: 'a', amountCents: 3500 }]);
    // Not 7000 — the undistributed half stays unallocated rather than
    // being overpaid to the one remaining act.
    expect(sum(partial)).toBe(3500);
  });

  it('caps distribution when accepted splits somehow exceed the artist share', () => {
    const rows = splitArtistPayoutAcrossLineup(7000, 70, [slot('a', 60), slot('b', 60)]);
    expect(sum(rows)).toBeLessThanOrEqual(7000);
  });
});

describe('buildPayableEntries', () => {
  const show = {
    id: 'show1',
    venueProfileId: 'venue1',
    headlinerProfileId: 'artist1',
    artistPayoutPercent: 70,
  };

  const order = {
    id: 'order1',
    affiliatePromoterProfileId: null,
    taxLocalCents: 0,
    taxStateCents: 0,
    taxCountryCents: 0,
    taxInternationalCents: 0,
    venuePayoutCents: 2000,
    artistPayoutCents: 7000,
    promoterPayoutCents: 1000,
  };

  it('writes NO artist payable when Stripe already routed the act their share', () => {
    /* The double-pay guard. On a destination charge the act's share never
       reached the platform — it went to their account with the charge, and the
       platform received only the application fee (venue + promoter + tax +
       processing). An ARTIST_PAYOUT entry here would have the payout cron
       transfer that share a SECOND time, out of money belonging to the venue,
       the promoter and a tax authority. Nothing downstream would catch it: the
       entry looks like any other artist payout and the transfer succeeds. */
    const entries = buildPayableEntries(show, { ...order, settlementAccountId: 'acct_artist' }, []);
    expect(entries.filter((e) => e.category === 'ARTIST_PAYOUT')).toHaveLength(0);

    // Everything the platform DOES hold is still recorded, unchanged.
    const venue = entries.filter((e) => e.category === 'VENUE_PAYOUT');
    expect(venue).toHaveLength(1);
    expect(venue[0].amountCents).toBe(2000);
    expect(entries.filter((e) => e.category === 'PROMOTER_AFFILIATE')).toHaveLength(1);
  });

  it('suppresses the lineup payables too, not just the single-act one', () => {
    /* A lineup is never settled on behalf of one act in the first place — the
       purchase route takes the platform branch for it. This asserts the guard
       covers that shape anyway, because the two decisions live in different
       files and only one of them is here. */
    const slots = [
      { profileId: 'act1', splitPercent: 40 },
      { profileId: 'act2', splitPercent: 30 },
    ];
    expect(buildPayableEntries(show, order, slots).filter((e) => e.category === 'ARTIST_PAYOUT').length)
      .toBeGreaterThan(0);
    expect(
      buildPayableEntries(show, { ...order, settlementAccountId: 'acct_artist' }, slots)
        .filter((e) => e.category === 'ARTIST_PAYOUT'),
    ).toHaveLength(0);
  });

  it('pays the headliner directly when the show has no lineup', () => {
    const entries = buildPayableEntries(show, order, []);
    const artist = entries.filter((e) => e.category === 'ARTIST_PAYOUT');
    expect(artist).toHaveLength(1);
    expect(artist[0].profileId).toBe('artist1');
    expect(artist[0].amountCents).toBe(7000);
  });

  it('splits across the lineup instead of paying the headliner once', () => {
    const entries = buildPayableEntries(show, order, [slot('a', 50), slot('b', 20)]);
    const artist = entries.filter((e) => e.category === 'ARTIST_PAYOUT');
    expect(artist).toHaveLength(2);
    expect(artist.map((e) => e.profileId)).toEqual(['a', 'b']);
    expect(artist.reduce((t, e) => t + (e.amountCents as number), 0)).toBe(7000);
    // The headliner must not also be paid the full share on top of the split.
    expect(artist.some((e) => e.profileId === 'artist1' && e.amountCents === 7000)).toBe(false);
  });

  it('still books venue, promoter and tax entries alongside a lineup split', () => {
    const entries = buildPayableEntries(
      { ...show },
      { ...order, taxLocalCents: 150, taxStateCents: 75 },
      [slot('a', 70)],
    );
    const byCategory = Object.fromEntries(entries.map((e) => [e.category, e.amountCents]));
    expect(byCategory.VENUE_PAYOUT).toBe(2000);
    expect(byCategory.PROMOTER_AFFILIATE).toBe(1000);
    expect(byCategory.TAX_LOCAL).toBe(150);
    expect(byCategory.TAX_STATE).toBe(75);
  });

  it('omits zero-value entries entirely', () => {
    const entries = buildPayableEntries(show, { ...order, promoterPayoutCents: 0, venuePayoutCents: 0 }, []);
    expect(entries.some((e) => e.category === 'PROMOTER_AFFILIATE')).toBe(false);
    expect(entries.some((e) => e.category === 'VENUE_PAYOUT')).toBe(false);
  });

  it('books every entry as PENDING against the right order and show', () => {
    const entries = buildPayableEntries(show, order, [slot('a', 70)]);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.status).toBe('PENDING');
      expect(entry.ticketOrderId).toBe('order1');
      expect(entry.showId).toBe('show1');
    }
  });
});
