import { describe, it, expect } from 'vitest';
import {
  validateTicketSplit,
  calculateTicketOrderPayouts,
  calculateTicketTaxes,
  calculateTicketOrderFinancials,
  getRemainingPayoutPercent,
  PLATFORM_COMMISSION_PERCENT,
  DEFAULT_PROMOTER_AFFILIATE_PERCENT
} from '../ticketing';

describe('platform constants', () => {
  it('charges zero platform commission', () => {
    expect(PLATFORM_COMMISSION_PERCENT).toBe(0);
  });

  it('defaults promoter affiliate to 5%', () => {
    expect(DEFAULT_PROMOTER_AFFILIATE_PERCENT).toBe(5);
  });
});

describe('getRemainingPayoutPercent', () => {
  it('returns 95% with default 5% promoter', () => {
    expect(getRemainingPayoutPercent()).toBe(95);
  });

  it('returns 90% when promoter takes 10%', () => {
    expect(getRemainingPayoutPercent(10)).toBe(90);
  });

  it('returns 100% when promoter takes 0%', () => {
    expect(getRemainingPayoutPercent(0)).toBe(100);
  });
});

describe('validateTicketSplit', () => {
  it('accepts a valid 45/45/5/5 split', () => {
    expect(() =>
      validateTicketSplit({ venuePayoutPercent: 45, artistPayoutPercent: 50 })
    ).not.toThrow();
  });

  it('accepts a valid split with explicit promoter', () => {
    expect(() =>
      validateTicketSplit({ venuePayoutPercent: 45, artistPayoutPercent: 50, promoterPayoutPercent: 5 })
    ).not.toThrow();
  });

  it('accepts zero-promoter split summing to 100%', () => {
    expect(() =>
      validateTicketSplit({ venuePayoutPercent: 50, artistPayoutPercent: 50, promoterPayoutPercent: 0 })
    ).not.toThrow();
  });

  it('rejects when venue + artist do not sum to remaining percent', () => {
    expect(() =>
      validateTicketSplit({ venuePayoutPercent: 50, artistPayoutPercent: 50 })
    ).toThrow('must total 95%');
  });

  it('rejects negative venue percent', () => {
    expect(() =>
      validateTicketSplit({ venuePayoutPercent: -1, artistPayoutPercent: 96 })
    ).toThrow('cannot be negative');
  });

  it('rejects promoter percent above maximum', () => {
    expect(() =>
      validateTicketSplit({ venuePayoutPercent: 45, artistPayoutPercent: 44, promoterPayoutPercent: 11 })
    ).toThrow('between 0%');
  });

  it('rejects non-integer percentages', () => {
    expect(() =>
      validateTicketSplit({ venuePayoutPercent: 45.5, artistPayoutPercent: 49.5 })
    ).toThrow('whole numbers');
  });
});

describe('calculateTicketOrderPayouts', () => {
  const base = {
    ticketPriceCents: 2000,
    quantity: 2,
    venuePayoutPercent: 45,
    artistPayoutPercent: 50,
    promoterPayoutPercent: 5
  };

  it('computes subtotal correctly', () => {
    const result = calculateTicketOrderPayouts(base);
    expect(result.subtotalCents).toBe(4000);
  });

  it('venue receives 45% of subtotal', () => {
    const result = calculateTicketOrderPayouts(base);
    expect(result.venuePayoutCents).toBe(1800);
  });

  it('promoter receives 5% of subtotal', () => {
    const result = calculateTicketOrderPayouts(base);
    expect(result.promoterPayoutCents).toBe(200);
  });

  it('artist receives the remainder after venue and promoter', () => {
    const result = calculateTicketOrderPayouts(base);
    expect(result.artistPayoutCents).toBe(2000);
    expect(result.venuePayoutCents + result.artistPayoutCents + result.promoterPayoutCents).toBe(4000);
  });

  it('platform takes zero commission', () => {
    const result = calculateTicketOrderPayouts(base);
    expect(result.platformCommissionCents).toBe(0);
  });

  it('payouts sum exactly to subtotal', () => {
    const result = calculateTicketOrderPayouts(base);
    const total = result.venuePayoutCents + result.artistPayoutCents + result.promoterPayoutCents;
    expect(total).toBe(result.subtotalCents);
  });

  it('handles single ticket at $10', () => {
    const result = calculateTicketOrderPayouts({
      ticketPriceCents: 1000,
      quantity: 1,
      venuePayoutPercent: 45,
      artistPayoutPercent: 50,
      promoterPayoutPercent: 5
    });
    expect(result.subtotalCents).toBe(1000);
    expect(result.venuePayoutCents + result.artistPayoutCents + result.promoterPayoutCents).toBe(1000);
  });

  it('rejects negative ticket price', () => {
    expect(() =>
      calculateTicketOrderPayouts({ ...base, ticketPriceCents: -1 })
    ).toThrow('non-negative');
  });

  it('rejects zero quantity', () => {
    expect(() =>
      calculateTicketOrderPayouts({ ...base, quantity: 0 })
    ).toThrow('positive');
  });

  it('rejects fractional price (not integer cents)', () => {
    expect(() =>
      calculateTicketOrderPayouts({ ...base, ticketPriceCents: 19.99 })
    ).toThrow('whole number');
  });
});

describe('calculateTicketTaxes', () => {
  const base = { ticketPriceCents: 1000, quantity: 2 };
  const nyLocation = { stateRegion: 'NY', country: 'US', postalCode: '10001' };

  it('returns zero tax when no location provided', () => {
    const result = calculateTicketTaxes(base);
    expect(result.totalTaxCents).toBe(0);
  });

  it('applies only international tax for cross-country purchase', () => {
    const result = calculateTicketTaxes({
      ...base,
      buyerLocation: { country: 'GB', stateRegion: null, postalCode: null },
      venueLocation: { country: 'US', stateRegion: 'NY', postalCode: '10001' }
    });
    expect(result.internationalCents).toBeGreaterThan(0);
    expect(result.countryCents).toBe(0);
    expect(result.stateCents).toBe(0);
    expect(result.localCents).toBe(0);
  });

  it('applies country + state + local tax for same postal code', () => {
    const result = calculateTicketTaxes({
      ...base,
      buyerLocation: nyLocation,
      venueLocation: nyLocation
    });
    expect(result.localCents).toBeGreaterThan(0);
    expect(result.stateCents).toBeGreaterThan(0);
    expect(result.countryCents).toBeGreaterThan(0);
    expect(result.internationalCents).toBe(0);
  });

  it('applies only country + state tax when same state but different postal', () => {
    const result = calculateTicketTaxes({
      ...base,
      buyerLocation: { stateRegion: 'NY', country: 'US', postalCode: '10002' },
      venueLocation: nyLocation
    });
    expect(result.localCents).toBe(0);
    expect(result.stateCents).toBeGreaterThan(0);
    expect(result.countryCents).toBeGreaterThan(0);
    expect(result.internationalCents).toBe(0);
  });

  it('applies only country tax when same country but different state', () => {
    const result = calculateTicketTaxes({
      ...base,
      buyerLocation: { stateRegion: 'CA', country: 'US', postalCode: '90001' },
      venueLocation: nyLocation
    });
    expect(result.stateCents).toBe(0);
    expect(result.localCents).toBe(0);
    expect(result.countryCents).toBeGreaterThan(0);
    expect(result.internationalCents).toBe(0);
  });

  it('total equals sum of components', () => {
    const result = calculateTicketTaxes({
      ...base,
      buyerLocation: nyLocation,
      venueLocation: nyLocation
    });
    expect(result.totalTaxCents).toBe(
      result.localCents + result.stateCents + result.countryCents + result.internationalCents
    );
  });

  it('rejects invalid ticket price', () => {
    expect(() => calculateTicketTaxes({ ticketPriceCents: -100, quantity: 1 })).toThrow();
  });
});

describe('calculateTicketOrderFinancials', () => {
  it('total charge equals subtotal plus tax', () => {
    const result = calculateTicketOrderFinancials({
      ticketPriceCents: 2500,
      quantity: 1,
      venuePayoutPercent: 45,
      artistPayoutPercent: 50,
      promoterPayoutPercent: 5,
      buyerLocation: { stateRegion: 'NY', country: 'US', postalCode: '10001' },
      venueLocation: { stateRegion: 'NY', country: 'US', postalCode: '10001' }
    });
    expect(result.totalChargeCents).toBe(result.subtotalCents + result.totalTaxCents);
  });

  it('payouts still sum to subtotal regardless of tax', () => {
    const result = calculateTicketOrderFinancials({
      ticketPriceCents: 5000,
      quantity: 3,
      venuePayoutPercent: 45,
      artistPayoutPercent: 50,
      promoterPayoutPercent: 5,
      buyerLocation: { country: 'GB', stateRegion: null, postalCode: null },
      venueLocation: { country: 'US', stateRegion: 'NY', postalCode: '10001' }
    });
    expect(result.venuePayoutCents + result.artistPayoutCents + result.promoterPayoutCents)
      .toBe(result.subtotalCents);
  });
});
