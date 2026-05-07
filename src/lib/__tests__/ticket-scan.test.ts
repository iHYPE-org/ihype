import { describe, it, expect } from 'vitest';
import {
  calculateTicketOrderPayouts,
  calculateTicketTaxes,
  calculateTicketOrderFinancials,
  validateTicketSplit,
  formatCurrencyFromCents,
  formatPercent,
  getRemainingPayoutPercent,
  PLATFORM_COMMISSION_PERCENT
} from '../ticketing';

// ---------------------------------------------------------------------------
// Ticket scan flow — verifying financial integrity at scan/check-in time
// ---------------------------------------------------------------------------

describe('ticket scan: payout integrity checks', () => {
  it('payouts are deterministic for the same inputs', () => {
    const input = {
      ticketPriceCents: 4500,
      quantity: 2,
      venuePayoutPercent: 45,
      artistPayoutPercent: 50,
      promoterPayoutPercent: 5
    };
    const first = calculateTicketOrderPayouts(input);
    const second = calculateTicketOrderPayouts(input);
    expect(first).toEqual(second);
  });

  it('platform takes zero commission on any ticket price', () => {
    for (const price of [500, 1000, 5000, 25000]) {
      const result = calculateTicketOrderPayouts({
        ticketPriceCents: price,
        quantity: 1,
        venuePayoutPercent: 45,
        artistPayoutPercent: 50,
        promoterPayoutPercent: 5
      });
      expect(result.platformCommissionCents).toBe(0);
      expect(PLATFORM_COMMISSION_PERCENT).toBe(0);
    }
  });

  it('remaining payout percent reflects promoter share correctly', () => {
    expect(getRemainingPayoutPercent(5)).toBe(95);
    expect(getRemainingPayoutPercent(0)).toBe(100);
    expect(getRemainingPayoutPercent(10)).toBe(90);
  });
});

describe('ticket scan: tax verification by venue location', () => {
  const venueLocation = { stateRegion: 'WA', country: 'US', postalCode: '98101' };

  it('no taxes for buyer with no location data', () => {
    const result = calculateTicketTaxes({
      ticketPriceCents: 3000,
      quantity: 1,
      venueLocation
    });
    expect(result.totalTaxCents).toBe(0);
    expect(result.localCents).toBe(0);
    expect(result.stateCents).toBe(0);
    expect(result.countryCents).toBe(0);
    expect(result.internationalCents).toBe(0);
  });

  it('international buyer incurs international tax only', () => {
    const result = calculateTicketTaxes({
      ticketPriceCents: 5000,
      quantity: 1,
      buyerLocation: { country: 'AU', stateRegion: null, postalCode: null },
      venueLocation
    });
    expect(result.internationalCents).toBeGreaterThan(0);
    expect(result.countryCents).toBe(0);
    expect(result.stateCents).toBe(0);
    expect(result.localCents).toBe(0);
  });

  it('local buyer (same postal code) gets all tax tiers applied', () => {
    const result = calculateTicketTaxes({
      ticketPriceCents: 5000,
      quantity: 1,
      buyerLocation: venueLocation,
      venueLocation
    });
    // local + state + country tiers, no international
    expect(result.localCents).toBeGreaterThan(0);
    expect(result.stateCents).toBeGreaterThan(0);
    expect(result.countryCents).toBeGreaterThan(0);
    expect(result.internationalCents).toBe(0);
    // total adds up
    expect(result.totalTaxCents).toBe(
      result.localCents + result.stateCents + result.countryCents + result.internationalCents
    );
  });

  it('tax breakdown is proportional to ticket price', () => {
    const base = calculateTicketTaxes({ ticketPriceCents: 1000, quantity: 1, buyerLocation: venueLocation, venueLocation });
    const double = calculateTicketTaxes({ ticketPriceCents: 2000, quantity: 1, buyerLocation: venueLocation, venueLocation });
    expect(double.totalTaxCents).toBe(base.totalTaxCents * 2);
  });
});

describe('ticket scan: complete order validation', () => {
  const validOrder = {
    ticketPriceCents: 2000,
    quantity: 1,
    venuePayoutPercent: 45,
    artistPayoutPercent: 50,
    promoterPayoutPercent: 5,
    buyerLocation: { stateRegion: 'NY', country: 'US', postalCode: '10001' },
    venueLocation: { stateRegion: 'NY', country: 'US', postalCode: '10001' }
  };

  it('total charge is subtotal + all taxes', () => {
    const result = calculateTicketOrderFinancials(validOrder);
    expect(result.totalChargeCents).toBe(result.subtotalCents + result.totalTaxCents);
  });

  it('payouts never exceed subtotal (taxes are buyer-side surcharges)', () => {
    const result = calculateTicketOrderFinancials(validOrder);
    const payoutTotal = result.venuePayoutCents + result.artistPayoutCents + result.promoterPayoutCents;
    expect(payoutTotal).toBeLessThanOrEqual(result.subtotalCents);
    expect(payoutTotal).toBe(result.subtotalCents); // exactly equal since platform takes 0%
  });

  it('rejects fractional ticket prices at scan validation', () => {
    expect(() =>
      calculateTicketOrderFinancials({ ...validOrder, ticketPriceCents: 19.99 })
    ).toThrow('whole number');
  });

  it('rejects zero quantity (no tickets to scan)', () => {
    expect(() =>
      calculateTicketOrderFinancials({ ...validOrder, quantity: 0 })
    ).toThrow('positive');
  });

  it('rejects negative ticket price', () => {
    expect(() =>
      calculateTicketOrderFinancials({ ...validOrder, ticketPriceCents: -500 })
    ).toThrow();
  });
});

describe('ticket scan: split validation at check-in', () => {
  it('validates a 45/50/5 split', () => {
    expect(() =>
      validateTicketSplit({ venuePayoutPercent: 45, artistPayoutPercent: 50, promoterPayoutPercent: 5 })
    ).not.toThrow();
  });

  it('rejects mismatched split totals', () => {
    expect(() =>
      validateTicketSplit({ venuePayoutPercent: 40, artistPayoutPercent: 40, promoterPayoutPercent: 5 })
    ).toThrow();
  });

  it('rejects non-integer promoter percent', () => {
    expect(() =>
      validateTicketSplit({ venuePayoutPercent: 45, artistPayoutPercent: 50, promoterPayoutPercent: 4.5 })
    ).toThrow('whole number');
  });
});

describe('ticket scan: display formatting', () => {
  it('formats $0 correctly', () => {
    expect(formatCurrencyFromCents(0)).toBe('$0.00');
  });

  it('formats a typical ticket price of $35.00', () => {
    expect(formatCurrencyFromCents(3500)).toBe('$35.00');
  });

  it('formats a large ticket price', () => {
    expect(formatCurrencyFromCents(100000)).toBe('$1,000.00');
  });

  it('formats percent values', () => {
    expect(formatPercent(5)).toBe('5%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(100)).toBe('100%');
  });
});
