import { describe, it, expect } from 'vitest';
import {
  calculateTicketOrderPayouts,
  calculateTicketTaxes,
  calculateTicketOrderFinancials,
  validateTicketSplit,
  formatCurrencyFromCents,
  formatPercent,
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
      venuePayoutPercent: 25,
      artistPayoutPercent: 75
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
        venuePayoutPercent: 25,
        artistPayoutPercent: 75
      });
      expect(result.platformCommissionCents).toBe(0);
      expect(PLATFORM_COMMISSION_PERCENT).toBe(0);
    }
  });

});

describe('ticket scan: tax verification by venue location', () => {
  const venueLocation = { stateRegion: 'WA', country: 'US', postalCode: '98101' };

  it('taxes a Washington venue at 6.5% state plus the 3.0133% average local rate', () => {
    const result = calculateTicketTaxes({ ticketPriceCents: 5000, quantity: 1, venueLocation });
    expect(result.stateCents).toBe(325);
    expect(result.localCents).toBe(151);
    expect(result.countryCents).toBe(0);
    expect(result.internationalCents).toBe(0);
    expect(result.totalTaxCents).toBe(476);
  });

  it('tax breakdown is proportional to ticket price', () => {
    const base = calculateTicketTaxes({ ticketPriceCents: 1000, quantity: 1, venueLocation });
    const double = calculateTicketTaxes({ ticketPriceCents: 2000, quantity: 1, venueLocation });
    expect(double.totalTaxCents).toBe(base.totalTaxCents * 2);
  });
});

describe('ticket scan: complete order validation', () => {
  const validOrder = {
    ticketPriceCents: 2000,
    quantity: 1,
    venuePayoutPercent: 25,
    artistPayoutPercent: 75,
    buyerLocation: { stateRegion: 'NY', country: 'US', postalCode: '10001' },
    venueLocation: { stateRegion: 'NY', country: 'US', postalCode: '10001' }
  };

  it('total charge is face value plus tax, and nothing else', () => {
    const result = calculateTicketOrderFinancials(validOrder);
    expect(result.totalChargeCents).toBe(result.subtotalCents + result.totalTaxCents);
  });

  it('the shares and Stripe fee account for the whole face value (platform takes 0%)', () => {
    const result = calculateTicketOrderFinancials(validOrder);
    const payoutTotal = result.venuePayoutCents + result.artistPayoutCents;
    expect(payoutTotal + result.stripeFeeCents).toBe(result.subtotalCents);
    expect(result.promoterPayoutCents).toBe(0);
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
  it('validates the 75/25 charter split', () => {
    expect(() =>
      validateTicketSplit({ venuePayoutPercent: 25, artistPayoutPercent: 75 })
    ).not.toThrow();
  });

  it('rejects mismatched split totals', () => {
    expect(() =>
      validateTicketSplit({ venuePayoutPercent: 20, artistPayoutPercent: 70 })
    ).toThrow();
  });

  it('rejects non-integer percentages', () => {
    expect(() =>
      validateTicketSplit({ venuePayoutPercent: 24.5, artistPayoutPercent: 75.5 })
    ).toThrow('whole number');
  });
});

describe('ticket scan: display formatting', () => {
  it('formats $0 correctly', () => {
    expect(formatCurrencyFromCents(0, 'en')).toBe('$0.00');
  });

  it('formats a typical ticket price of $35.00', () => {
    expect(formatCurrencyFromCents(3500, 'en')).toBe('$35.00');
  });

  it('formats a large ticket price', () => {
    expect(formatCurrencyFromCents(100000, 'en')).toBe('$1,000.00');
  });

  it('formats percent values', () => {
    expect(formatPercent(5)).toBe('5%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(100)).toBe('100%');
  });
});
