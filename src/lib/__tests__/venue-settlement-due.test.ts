import { describe, expect, it } from 'vitest';
import { nextActSettlement } from '@/lib/venue-settlement-due';
import { settlementDateFor } from '@/lib/split-agreement';

const keepsAll = (subtotalCents: number) => ({ settlementMode: 'VENUE_KEEPS_ALL', subtotalCents, artistPayoutCents: 0 });
const legacy = { settlementMode: 'VENUE_DIRECT', subtotalCents: 1800, artistPayoutCents: 1288 };
const start = new Date('2026-10-06T00:00:00Z');

describe('what a venue owes its acts, and by when', () => {
  it('is the face value times each unpaid act’s split, due on the settlement date', () => {
    const due = nextActSettlement([{
      startsAt: start,
      agreements: [{ splitPercent: 60, payment: null }, { splitPercent: 20, payment: { paidMarkedAt: null, artistConfirmedAt: null } }],
      orders: [keepsAll(1800), keepsAll(1800)],
    }]);
    expect(due).toEqual({ dueAt: settlementDateFor(start), owedCents: 2 * (1080 + 360), shows: 1 });
  });

  it('drops an act the venue already marked paid, or that confirmed', () => {
    const due = nextActSettlement([{
      startsAt: start,
      agreements: [
        { splitPercent: 60, payment: { paidMarkedAt: new Date(), artistConfirmedAt: null } },
        { splitPercent: 20, payment: { paidMarkedAt: null, artistConfirmedAt: new Date() } },
      ],
      orders: [keepsAll(1800)],
    }]);
    expect(due).toBeNull();
  });

  it('never counts a legacy order — its act is paid by the payout cron, not the venue', () => {
    expect(nextActSettlement([{ startsAt: start, agreements: [{ splitPercent: 60, payment: null }], orders: [legacy] }])).toBeNull();
  });

  it('reads the soonest date across shows and the total across them', () => {
    const later = new Date('2026-11-01T00:00:00Z');
    const due = nextActSettlement([
      { startsAt: later, agreements: [{ splitPercent: 50, payment: null }], orders: [keepsAll(1000)] },
      { startsAt: start, agreements: [{ splitPercent: 50, payment: null }], orders: [keepsAll(2000)] },
    ]);
    expect(due).toEqual({ dueAt: settlementDateFor(start), owedCents: 500 + 1000, shows: 2 });
  });

  it('is null, not zero, with no sale or no agreement', () => {
    expect(nextActSettlement([{ startsAt: start, agreements: [{ splitPercent: 60, payment: null }], orders: [] }])).toBeNull();
    expect(nextActSettlement([{ startsAt: start, agreements: [], orders: [keepsAll(1800)] }])).toBeNull();
  });
});
