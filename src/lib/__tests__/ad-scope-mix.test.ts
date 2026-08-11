import { describe, expect, it } from 'vitest';
import { SCOPE_ORDER, SCOPE_WEIGHTS, allocateScopeSlots } from '@/lib/ad-scope-mix';

const plenty = { local: 99, regional: 99, national: 99, global: 99 };
const total = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

describe('allocateScopeSlots', () => {
  it('weights local most and global least', () => {
    const got = allocateScopeSlots(15, plenty);
    expect(got.local).toBeGreaterThan(got.regional);
    expect(got.regional).toBeGreaterThan(got.national);
    expect(got.national).toBeGreaterThanOrEqual(got.global);
    expect(total(got)).toBe(15);
  });

  it('always fills exactly the requested number of slots', () => {
    for (const slots of [1, 2, 3, 4, 5, 8, 13, 40]) {
      expect(total(allocateScopeSlots(slots, plenty)), `slots=${slots}`).toBe(slots);
    }
  });

  it('gives a single slot to the most local scope with inventory', () => {
    expect(allocateScopeSlots(1, plenty).local).toBe(1);
    expect(allocateScopeSlots(1, { ...plenty, local: 0 }).regional).toBe(1);
    expect(allocateScopeSlots(1, { local: 0, regional: 0, national: 0, global: 4 }).global).toBe(1);
  });

  it('never allocates a scope more spots than it has', () => {
    const available = { local: 1, regional: 2, national: 0, global: 50 };
    const got = allocateScopeSlots(10, available);
    for (const scope of SCOPE_ORDER) {
      expect(got[scope], scope).toBeLessThanOrEqual(available[scope]);
    }
    // Still a full break: the surplus cascaded rather than being dropped.
    expect(total(got)).toBe(10);
  });

  it('cascades a capped scope to the next most local one, not to global', () => {
    // Local can only cover one slot; regional is the next most local with
    // inventory, so it should absorb the surplus ahead of national/global.
    const got = allocateScopeSlots(6, { local: 1, regional: 50, national: 50, global: 50 });
    expect(got.local).toBe(1);
    expect(got.regional).toBeGreaterThan(got.national);
    expect(total(got)).toBe(6);
  });

  it('returns nothing when no scope has inventory', () => {
    expect(total(allocateScopeSlots(4, { local: 0, regional: 0, national: 0, global: 0 }))).toBe(0);
  });

  it('returns nothing for a non-positive or non-finite slot count', () => {
    for (const slots of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(total(allocateScopeSlots(slots, plenty)), `slots=${slots}`).toBe(0);
    }
  });

  it('keeps the weight table ordered local-most to global-least', () => {
    // The ordering IS the product rule, so it is asserted rather than assumed
    // to survive someone retuning the numbers.
    const weights = SCOPE_ORDER.map((scope) => SCOPE_WEIGHTS[scope]);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
    expect(new Set(weights).size).toBe(weights.length);
  });
});
