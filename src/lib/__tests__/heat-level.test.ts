import { describe, expect, it } from 'vitest';
import { HEAT_LABEL, HEAT_THRESHOLDS, HEAT_TOKEN, heatLevel } from '../heat-level';

describe('heatLevel', () => {
  it('places each threshold on the hotter side of its boundary', () => {
    // Off-by-one here is invisible in the product — a card one hype short of
    // "hot" simply draws a different dot — so the boundary is pinned.
    expect(heatLevel(HEAT_THRESHOLDS.fire)).toBe('fire');
    expect(heatLevel(HEAT_THRESHOLDS.fire - 1)).toBe('hot');
    expect(heatLevel(HEAT_THRESHOLDS.hot)).toBe('hot');
    expect(heatLevel(HEAT_THRESHOLDS.hot - 1)).toBe('warm');
    expect(heatLevel(HEAT_THRESHOLDS.warm)).toBe('warm');
    expect(heatLevel(HEAT_THRESHOLDS.warm - 1)).toBe('cold');
  });

  it('reads a missing or malformed count as cold, never as hot', () => {
    // The count arrives over JSON. A wrong answer that renders the hottest
    // dot on an empty show is worse than one that renders the coldest.
    expect(heatLevel(0)).toBe('cold');
    expect(heatLevel(-5)).toBe('cold');
    expect(heatLevel(Number.NaN)).toBe('cold');
    expect(heatLevel(Number.POSITIVE_INFINITY)).toBe('cold');
  });

  it('paints every level from a token, so both themes swap', () => {
    // A literal here survives the theme switch and stops matching the ground —
    // the exact defect `audit:shell`'s colour check exists to catch, which it
    // cannot see through a TS object.
    for (const value of Object.values(HEAT_TOKEN)) {
      expect(value).toMatch(/^var\(--heat-[a-z]+\)$/);
    }
  });

  it('labels every level, so the dot is not a bare bullet to a screen reader', () => {
    for (const level of Object.keys(HEAT_TOKEN) as Array<keyof typeof HEAT_TOKEN>) {
      expect(HEAT_LABEL[level]?.length).toBeGreaterThan(0);
    }
  });
});
