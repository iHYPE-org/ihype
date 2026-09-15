import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  CONNECT_PAYOUT_CATEGORIES,
  PAYOUT_HOLD_DAYS,
  describePayableRelease,
  isConnectPayoutCategory,
  payoutHoldEndsAt,
} from '../payout-release';
import { payoutReleaseLabel } from '../i18n-enum-labels';

const NOW = new Date('2026-09-15T12:00:00.000Z');
const day = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

function entry(over: Partial<Parameters<typeof describePayableRelease>[0]> = {}) {
  return {
    category: 'ARTIST_PAYOUT',
    hasPayoutDestination: true,
    show: { status: 'ENDED', startsAt: day(-30) },
    ...over,
  };
}

describe('describePayableRelease', () => {
  it('a tax entry is never released automatically, whatever the show did', () => {
    for (const category of ['TAX_LOCAL', 'TAX_STATE', 'TAX_COUNTRY', 'TAX_INTERNATIONAL']) {
      expect(describePayableRelease(entry({ category }), NOW)).toEqual({ kind: 'manual-remittance' });
    }
  });

  it('a payee with no Connect account is waiting on themselves, not on the show', () => {
    // The blocker order is the point: a profile with no destination is skipped
    // on every run for ever, so it must beat "the show has not ended yet".
    expect(describePayableRelease(entry({ hasPayoutDestination: false }), NOW).kind).toBe('no-destination');
    expect(
      describePayableRelease(
        entry({ hasPayoutDestination: false, show: { status: 'SCHEDULED', startsAt: day(30) } }),
        NOW,
      ).kind,
    ).toBe('no-destination');
  });

  it('a show that has not ended is awaiting the show', () => {
    for (const status of ['DRAFT', 'SCHEDULED', 'LIVE', 'CANCELED']) {
      expect(describePayableRelease(entry({ show: { status, startsAt: day(-30) } }), NOW).kind)
        .toBe('awaiting-show');
    }
  });

  it('an ended show inside the hold reports the day the hold lifts', () => {
    const startsAt = day(-3);
    const state = describePayableRelease(entry({ show: { status: 'ENDED', startsAt } }), NOW);
    expect(state.kind).toBe('holding');
    if (state.kind !== 'holding') throw new Error('unreachable');
    expect(state.releasesOn.toISOString()).toBe(payoutHoldEndsAt(startsAt).toISOString());
    expect(state.releasesOn.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('the hold boundary is exclusive at exactly the hold length and due one ms later', () => {
    // A payable whose hold ends on this very instant has not yet been paid by
    // the cron (its filter is `startsAt <= now - HOLD`), so the member should
    // read "due", not "held until now".
    const exact = new Date(NOW.getTime() - PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
    expect(describePayableRelease(entry({ show: { status: 'ENDED', startsAt: exact } }), NOW).kind).toBe('due');
    const oneMsShort = new Date(exact.getTime() + 1);
    expect(describePayableRelease(entry({ show: { status: 'ENDED', startsAt: oneMsShort } }), NOW).kind)
      .toBe('holding');
  });

  it('an unreadable show is unknown rather than a promise', () => {
    expect(describePayableRelease(entry({ show: null }), NOW)).toEqual({ kind: 'unknown' });
  });

  it('every state renders a sentence, and none of them says "once the show ends"', () => {
    const t = (_key: string, fallback?: string) => fallback ?? '';
    const kinds = ['manual-remittance', 'no-destination', 'awaiting-show', 'holding', 'due', 'unknown'];
    for (const kind of kinds) {
      const text = payoutReleaseLabel(t, kind, { releasesOn: '25 Sep 2026', holdDays: PAYOUT_HOLD_DAYS });
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toContain('{');
      // The sentence this module exists to delete.
      expect(text.toLowerCase()).not.toContain('once the show ends');
    }
  });
});

describe('the promise and the payout cron read the same conditions', () => {
  const cron = fs.readFileSync(path.join(process.cwd(), 'src/lib/show-payouts.ts'), 'utf8');

  it('show-payouts imports the constants rather than restating them', () => {
    expect(cron).toContain("from '@/lib/payout-release'");
    // Two copies of "when does a payable pay" is how the stale sentence
    // survived the day PAYOUT_HOLD_DAYS was introduced.
    expect(cron).not.toMatch(/const\s+PAYOUT_HOLD_DAYS\s*=/);
    expect(cron).not.toMatch(/const\s+CONNECT_PAYOUT_CATEGORIES\s*(:|=)/);
  });

  it('the cron still filters on every condition the member-facing states name', () => {
    expect(cron).toContain('PAYOUT_HOLD_DAYS');
    expect(cron).toContain('CONNECT_PAYOUT_CATEGORIES');
    expect(cron).toMatch(/profileId:\s*\{\s*not:\s*null\s*\}/);
    expect(cron).toMatch(/status:\s*'ENDED'/);
    expect(cron).toContain('stripeConnectAccountId');
  });

  it('only the three transferable categories are connect categories', () => {
    expect([...CONNECT_PAYOUT_CATEGORIES].sort())
      .toEqual(['ARTIST_PAYOUT', 'PROMOTER_AFFILIATE', 'VENUE_PAYOUT']);
    expect(isConnectPayoutCategory('TAX_LOCAL')).toBe(false);
    expect(isConnectPayoutCategory('ARTIST_PAYOUT')).toBe(true);
  });
});
