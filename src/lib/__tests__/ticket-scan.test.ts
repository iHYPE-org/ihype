import { describe, it, expect } from 'vitest';
import {
  calculateTicketOrderPayouts,
  PLATFORM_COMMISSION_PERCENT,
  MAX_PROMOTER_AFFILIATE_PERCENT
} from '../ticketing';

// Tests for ticket scan business logic constraints
// The actual scan HTTP handler is in /api/tickets/[serializedId]/scan/route.ts
// These tests cover the payout math that runs before/after a scan.

describe('ticket scan: payout invariants', () => {
  it('payouts never exceed the ticket price', () => {
    const result = calculateTicketOrderPayouts({
      ticketPriceCents: 1500,
      quantity: 1,
      venuePayoutPercent: 50,
      artistPayoutPercent: 45,
      promoterPayoutPercent: 5
    });
    const total = result.venuePayoutCents + result.artistPayoutCents + result.promoterPayoutCents;
    expect(total).toBeLessThanOrEqual(1500);
  });

  it('platform takes no commission', () => {
    expect(PLATFORM_COMMISSION_PERCENT).toBe(0);
  });

  it('promoter affiliate cap is 10%', () => {
    expect(MAX_PROMOTER_AFFILIATE_PERCENT).toBe(10);
  });

  it('calculates payouts for multi-ticket scanned order', () => {
    const result = calculateTicketOrderPayouts({
      ticketPriceCents: 2000,
      quantity: 4,
      venuePayoutPercent: 50,
      artistPayoutPercent: 45,
      promoterPayoutPercent: 5
    });
    expect(result.venuePayoutCents).toBe(4000); // 50% of $80
    expect(result.artistPayoutCents).toBe(3600); // 45% of $80
    expect(result.promoterPayoutCents).toBe(400); // 5% of $80
  });

  it('handles zero quantity gracefully', () => {
    const result = calculateTicketOrderPayouts({
      ticketPriceCents: 2000,
      quantity: 0,
      venuePayoutPercent: 50,
      artistPayoutPercent: 45,
      promoterPayoutPercent: 5
    });
    expect(result.venuePayoutCents).toBe(0);
    expect(result.artistPayoutCents).toBe(0);
    expect(result.promoterPayoutCents).toBe(0);
  });
});
