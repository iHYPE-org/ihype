import { describe, expect, it } from 'vitest';
import { quoteAdCampaign, isAdScope, isAdRunLengthDays, AD_SCOPES, MIN_SPOTS_PER_DAY, MAX_SPOTS_PER_DAY } from '@/lib/ad-pricing';

describe('quoteAdCampaign', () => {
  it('computes daily/total cost from the per-scope rate', () => {
    const q = quoteAdCampaign('LOCAL', 6, 14);
    expect(q.ratePerSpotCents).toBe(15); // $0.15/spot
    expect(q.dailyCostCents).toBe(15 * 6);
    expect(q.totalCostCents).toBe(15 * 6 * 14);
  });

  it('scales cost up with broader coverage tiers', () => {
    const local = quoteAdCampaign('LOCAL', 6, 14).totalCostCents;
    const regional = quoteAdCampaign('REGIONAL', 6, 14).totalCostCents;
    const national = quoteAdCampaign('NATIONAL', 6, 14).totalCostCents;
    const global = quoteAdCampaign('GLOBAL', 6, 14).totalCostCents;
    expect(local).toBeLessThan(regional);
    expect(regional).toBeLessThan(national);
    expect(national).toBeLessThan(global);
  });

  it('clamps spots per day to the allowed range', () => {
    expect(quoteAdCampaign('REGIONAL', 0, 14).spotsPerDay).toBe(MIN_SPOTS_PER_DAY);
    expect(quoteAdCampaign('REGIONAL', 9999, 14).spotsPerDay).toBe(MAX_SPOTS_PER_DAY);
  });

  it('never divides by zero for effective CPM', () => {
    const q = quoteAdCampaign('LOCAL', MIN_SPOTS_PER_DAY, 7);
    expect(Number.isFinite(q.effectiveCpmCents)).toBe(true);
  });

  it('produces identical numbers for identical inputs (server/client parity)', () => {
    const a = quoteAdCampaign('NATIONAL', 10, 30);
    const b = quoteAdCampaign('NATIONAL', 10, 30);
    expect(a).toEqual(b);
  });
});

describe('isAdScope / isAdRunLengthDays', () => {
  it('accepts every real scope and rejects garbage', () => {
    for (const scope of AD_SCOPES) expect(isAdScope(scope)).toBe(true);
    expect(isAdScope('local')).toBe(false); // case-sensitive — must be uppercase
    expect(isAdScope('MOON')).toBe(false);
    expect(isAdScope(undefined)).toBe(false);
  });

  it('accepts only the four defined run lengths', () => {
    expect(isAdRunLengthDays(7)).toBe(true);
    expect(isAdRunLengthDays(14)).toBe(true);
    expect(isAdRunLengthDays(30)).toBe(true);
    expect(isAdRunLengthDays(90)).toBe(true);
    expect(isAdRunLengthDays(10)).toBe(false);
    expect(isAdRunLengthDays('14')).toBe(false);
  });
});
