import { describe, expect, it } from 'vitest';
import { orderActShareCents, orderActsShareCents, sumActShares } from '@/lib/artist-share';

const keepsAll = { settlementMode: 'VENUE_KEEPS_ALL', subtotalCents: 2500, artistPayoutCents: 0 };
const legacy = { settlementMode: 'VENUE_DIRECT', subtotalCents: 2500, artistPayoutCents: 1875 };

describe('an act’s share of an order', () => {
  it('is the face value times the signed split, not the 0 the sale recorded', () => {
    expect(orderActShareCents(keepsAll, 60)).toBe(1500);
    // 4.3: the half cent goes to the act.
    expect(orderActShareCents({ ...keepsAll, subtotalCents: 1001 }, 50)).toBe(501);
  });

  it('keeps the recorded payout for an order sold under an older mode', () => {
    expect(orderActShareCents(legacy, 60)).toBe(1875);
    expect(orderActShareCents(legacy, null)).toBe(1875);
  });

  it('is null, never 0, when a split-agreement order has no signed split to apply', () => {
    expect(orderActShareCents(keepsAll, null)).toBeNull();
  });

  it('sums per show and counts the orders it could not price', () => {
    const orders = [
      { ...keepsAll, showId: 's1' },
      { ...keepsAll, showId: 's1', subtotalCents: 5000 },
      { ...keepsAll, showId: 's2' },
      { ...legacy, showId: 's3' },
    ];
    expect(sumActShares(orders, new Map([['s1', 40]]))).toEqual({ cents: 1000 + 2000 + 1875, unsignedOrders: 1 });
  });

  it('adds sibling splits for the organiser’s one acts column', () => {
    expect(orderActsShareCents(keepsAll, [40, 20])).toBe(1500);
    expect(orderActsShareCents(keepsAll, [])).toBeNull();
    expect(orderActsShareCents(legacy, [])).toBe(1875);
  });
});
