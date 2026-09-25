import { describe, it, expect } from 'vitest';
import {
  calculateTicketOrderFinancials,
  validateTicketSplit,
  formatCurrencyFromCents
} from '../ticketing';

describe('show purchase: full order financials', () => {
  it('calculates a $20 ticket under the 75/25 split', () => {
    const result = calculateTicketOrderFinancials({
      ticketPriceCents: 2000,
      quantity: 1,
      venuePayoutPercent: 25,
      artistPayoutPercent: 75,
      buyerLocation: { country: 'US', postalCode: null, stateRegion: null },
      venueLocation: { country: 'US', postalCode: null, stateRegion: null }
    });
    expect(result.subtotalCents).toBe(2000);
    expect(result.venuePayoutCents + result.artistPayoutCents + result.stripeFeeCents).toBe(result.subtotalCents);
  });

  it('calculates a multi-ticket order', () => {
    const result = calculateTicketOrderFinancials({
      ticketPriceCents: 1000,
      quantity: 3,
      venuePayoutPercent: 25,
      artistPayoutPercent: 75,
      buyerLocation: { country: 'US', postalCode: null, stateRegion: null },
      venueLocation: { country: 'US', postalCode: null, stateRegion: null }
    });
    expect(result.subtotalCents).toBe(3000);
  });

  it('rejects split that does not total 100%', () => {
    expect(() =>
      validateTicketSplit({ venuePayoutPercent: 30, artistPayoutPercent: 30 })
    ).toThrow();
  });

  it('rejects zero-priced ticket', () => {
    expect(() =>
      calculateTicketOrderFinancials({
        ticketPriceCents: 0,
        quantity: 1,
        venuePayoutPercent: 25,
        artistPayoutPercent: 75
      })
    ).toThrow();
  });
});

describe('formatCurrencyFromCents', () => {
  it('formats zero', () => {
    expect(formatCurrencyFromCents(0, 'en')).toBe('$0.00');
  });

  it('formats $25.50', () => {
    expect(formatCurrencyFromCents(2550, 'en')).toBe('$25.50');
  });

  it('formats negative as credit', () => {
    expect(formatCurrencyFromCents(-100, 'en')).toMatch(/-?\$1\.00|-1\.00/);
  });
});
