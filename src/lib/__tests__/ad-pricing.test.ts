import { describe, expect, it } from 'vitest';
import {
  quoteSponsorship,
  isAdScope,
  isSponsorshipTerm,
  AD_SCOPES,
  SPONSORSHIP_TERMS_MONTHS,
  SPONSORSHIP_MONTHLY_USD,
  DAYS_PER_SPONSORSHIP_MONTH,
} from '@/lib/ad-pricing';
import { STATION_AD_INTERVAL_SECS, ADS_PER_BREAK } from '@/lib/station-breaks';

describe('quoteSponsorship', () => {
  it('is the monthly rate times the term, with no hidden discount', () => {
    const q = quoteSponsorship('LOCAL', 3);
    expect(q.monthlyCents).toBe(2500);
    expect(q.totalCents).toBe(7500);
    expect(q.runDays).toBe(90);
  });

  it('gives every tier a whole number of cents', () => {
    for (const scope of AD_SCOPES) {
      for (const months of SPONSORSHIP_TERMS_MONTHS) {
        const q = quoteSponsorship(scope, months);
        expect(Number.isInteger(q.monthlyCents)).toBe(true);
        expect(Number.isInteger(q.totalCents)).toBe(true);
        expect(q.totalCents).toBe(q.monthlyCents * months);
        expect(q.runDays).toBe(months * DAYS_PER_SPONSORSHIP_MONTH);
      }
    }
  });

  it('clears Stripe’s fixed fee at every tier', () => {
    /* 2.9% + $0.30 is 8.9% of a $5 sponsorship and 4.1% of a $25 one. The
       cheapest thing anyone can buy has to be worth processing. */
    const cheapest = Math.min(...AD_SCOPES.map((s) => quoteSponsorship(s, 1).totalCents));
    const fee = cheapest * 0.029 + 30;
    expect(cheapest).toBeGreaterThanOrEqual(2500);
    expect(fee / cheapest).toBeLessThan(0.05);
  });

  it('prices the tiers in ascending order of reach', () => {
    const rates = AD_SCOPES.map((s) => SPONSORSHIP_MONTHLY_USD[s]);
    expect(rates).toEqual([...rates].sort((a, b) => a - b));
  });
});

describe('the unit is time because impressions were never sellable', () => {
  /* THE ARITHMETIC THAT ENDED PER-IMPRESSION PRICING. A break airs every
     STATION_AD_INTERVAL_SECS with ADS_PER_BREAK spots, so the station makes
     eight impressions per listener-hour. The retired quote sold a LOCAL spot
     against 800 impressions a day, which needed 100 listener-hours a day to
     fill ONE buyer, while delivery charged a flat 9c an impression — a $90
     CPM against a quoted $0.19. If either constant below changes, the case
     for time-based pricing is worth re-reading rather than assumed. */
  it('the station makes eight impressions per listener-hour', () => {
    const perHour = (3600 / STATION_AD_INTERVAL_SECS) * ADS_PER_BREAK;
    expect(perHour).toBe(8);
  });

  it('no quote promises a number of impressions', () => {
    const q = quoteSponsorship('GLOBAL', 12) as Record<string, unknown>;
    expect(q.dailyImpressions).toBeUndefined();
    expect(q.totalImpressions).toBeUndefined();
    expect(q.effectiveCpmCents).toBeUndefined();
  });
});

describe('input guards', () => {
  it('accepts only the four tiers', () => {
    expect(isAdScope('LOCAL')).toBe(true);
    expect(isAdScope('local')).toBe(false);
    expect(isAdScope('CITY')).toBe(false);
    expect(isAdScope(null)).toBe(false);
  });

  it('accepts only the offered terms', () => {
    expect(isSponsorshipTerm(1)).toBe(true);
    expect(isSponsorshipTerm(12)).toBe(true);
    expect(isSponsorshipTerm(2)).toBe(false);
    expect(isSponsorshipTerm('3')).toBe(false);
    expect(isSponsorshipTerm(0)).toBe(false);
  });
});
