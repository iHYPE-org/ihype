import { stripeCutOf } from '@/lib/stripe-fees';
import { describe, it, expect } from 'vitest';
import {
  validateTicketSplit,
  calculateTicketOrderPayouts,
  calculateTicketTaxes,
  calculateTicketOrderFinancials,
  calculateDirectChargeApplicationFee,
  ARTIST_SHARE_PERCENT,
  VENUE_SHARE_PERCENT,
  PLATFORM_COMMISSION_PERCENT,
} from '../ticketing';

const CHARTER = { venuePayoutPercent: VENUE_SHARE_PERCENT, artistPayoutPercent: ARTIST_SHARE_PERCENT };

describe('the charter split (2026-09-25)', () => {
  it('is 75% artist, 25% venue, 0% iHYPE', () => {
    expect(ARTIST_SHARE_PERCENT).toBe(75);
    expect(VENUE_SHARE_PERCENT).toBe(25);
    expect(PLATFORM_COMMISSION_PERCENT).toBe(0);
  });
});

describe('validateTicketSplit', () => {
  it('accepts the charter split', () => {
    expect(() => validateTicketSplit(CHARTER)).not.toThrow();
  });

  it('refuses the retired 70/20 artist/venue pair, which no longer sums to the whole', () => {
    expect(() => validateTicketSplit({ venuePayoutPercent: 20, artistPayoutPercent: 70 })).toThrow('must total 100%');
  });

  it('rejects negative and fractional percentages', () => {
    expect(() => validateTicketSplit({ venuePayoutPercent: -1, artistPayoutPercent: 101 })).toThrow('cannot be negative');
    expect(() => validateTicketSplit({ venuePayoutPercent: 24.5, artistPayoutPercent: 75.5 })).toThrow('whole numbers');
  });
});

describe('calculateTicketOrderPayouts', () => {
  const base = { ...CHARTER, ticketPriceCents: 2000, quantity: 3 };

  it('splits the whole face value 75/25 when there is no fee', () => {
    const r = calculateTicketOrderPayouts(base);
    expect(r.subtotalCents).toBe(6000);
    expect(r.venuePayoutCents).toBe(1500);
    expect(r.artistPayoutCents).toBe(4500);
    expect(r.promoterPayoutCents).toBe(0);
    expect(r.platformCommissionCents).toBe(0);
  });

  it('takes the fee off the top, then splits what is left', () => {
    const r = calculateTicketOrderPayouts({ ...base, stripeFeeCents: 204 });
    expect(r.netCents).toBe(5796);
    expect(r.venuePayoutCents).toBe(Math.round(5796 * 0.25));
    expect(r.artistPayoutCents + r.venuePayoutCents).toBe(5796);
    expect(r.stripeFeeCents + r.artistPayoutCents + r.venuePayoutCents).toBe(r.subtotalCents);
  });

  it('gives the rounding remainder to the artist, so the shares always sum to the net', () => {
    for (let fee = 0; fee < 60; fee += 7) {
      for (const price of [999, 1333, 1801]) {
        const r = calculateTicketOrderPayouts({ ...CHARTER, ticketPriceCents: price, quantity: 1, stripeFeeCents: fee });
        expect(r.artistPayoutCents + r.venuePayoutCents).toBe(price - fee);
      }
    }
  });

  it('refuses a price the card fee would swallow', () => {
    expect(() => calculateTicketOrderPayouts({ ...CHARTER, ticketPriceCents: 30, quantity: 1, stripeFeeCents: 31 })).toThrow('too low');
  });

  it('rejects a non-positive price, zero quantity and fractional cents', () => {
    expect(() => calculateTicketOrderPayouts({ ...base, ticketPriceCents: 0 })).toThrow();
    expect(() => calculateTicketOrderPayouts({ ...base, quantity: 0 })).toThrow();
    expect(() => calculateTicketOrderPayouts({ ...base, ticketPriceCents: 19.99 })).toThrow();
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

  /* Row 513: the buyer's country is Cloudflare's ISO code and the venue's is
     free text. "US" against "USA" used to read as a cross-border sale. */
  it('treats a spelled-out venue country as the same country as the edge code', () => {
    for (const venueCountry of ['USA', 'United States', 'united states of america', 'U.S.A.']) {
      const result = calculateTicketTaxes({
        ...base,
        buyerLocation: { stateRegion: 'ME', country: 'US', postalCode: '04101' },
        venueLocation: { stateRegion: 'Maine', country: venueCountry, postalCode: '04101' }
      });
      expect(result.internationalCents, venueCountry).toBe(0);
      expect(result.countryCents, venueCountry).toBeGreaterThan(0);
      expect(result.stateCents, venueCountry).toBeGreaterThan(0);
      expect(result.localCents, venueCountry).toBeGreaterThan(0);
    }
  });

  it('still charges the cross-border rate between two different countries, however spelled', () => {
    const result = calculateTicketTaxes({
      ...base,
      buyerLocation: { country: 'DE', stateRegion: null, postalCode: null },
      venueLocation: { country: 'USA', stateRegion: 'ME', postalCode: '04101' }
    });
    expect(result.internationalCents).toBeGreaterThan(0);
    expect(result.countryCents).toBe(0);
  });

  it('reads Germany and DE as one country', () => {
    const result = calculateTicketTaxes({
      ...base,
      buyerLocation: { country: 'DE', stateRegion: null, postalCode: null },
      venueLocation: { country: 'Germany', stateRegion: null, postalCode: null }
    });
    expect(result.internationalCents).toBe(0);
    expect(result.countryCents).toBeGreaterThan(0);
  });
});

describe('calculateTicketOrderFinancials — the fee comes off the top', () => {
  const base = { ...CHARTER, ticketPriceCents: 1800, quantity: 1 };

  it('charges the buyer face value plus tax and nothing else', () => {
    const f = calculateTicketOrderFinancials(base);
    expect(f.totalChargeCents).toBe(1800);
    expect(f.processingFeeCents).toBe(0);
    expect(f.reserveFeeCents).toBe(0);
  });

  it('estimates the Stripe fee on the whole charge and splits the rest 75/25', () => {
    const f = calculateTicketOrderFinancials(base);
    expect(f.stripeFeeCents).toBe(stripeCutOf(1800));
    expect(f.stripeFeeCents).toBe(82);
    expect(f.netCents).toBe(1718);
    expect(f.venuePayoutCents).toBe(430);
    expect(f.artistPayoutCents).toBe(1288);
  });

  it('charges the fee on tax too, and takes it from the face value, never from the tax', () => {
    const f = calculateTicketOrderFinancials({
      ...base,
      buyerLocation: { country: 'US', stateRegion: 'ME', postalCode: '04101' },
      venueLocation: { country: 'US', stateRegion: 'ME', postalCode: '04101' },
    });
    expect(f.totalTaxCents).toBeGreaterThan(0);
    expect(f.totalChargeCents).toBe(1800 + f.totalTaxCents);
    expect(f.stripeFeeCents).toBe(stripeCutOf(f.totalChargeCents));
    // Every cent of the charge is one of: Stripe's fee, the artist, the venue, the tax.
    expect(f.stripeFeeCents + f.artistPayoutCents + f.venuePayoutCents + f.totalTaxCents).toBe(f.totalChargeCents);
  });

  it('holds exactly across prices and quantities', () => {
    for (const ticketPriceCents of [500, 1000, 1999, 2500, 15000]) {
      for (const quantity of [1, 2, 7]) {
        const f = calculateTicketOrderFinancials({ ...CHARTER, ticketPriceCents, quantity });
        expect(f.stripeFeeCents + f.artistPayoutCents + f.venuePayoutCents).toBe(f.subtotalCents);
        expect(f.promoterPayoutCents).toBe(0);
      }
    }
  });
});

describe('venue-direct charges', () => {
  it('claims exactly the artist share, so the venue keeps its quarter and the tax', () => {
    const f = calculateTicketOrderFinancials({ ...CHARTER, ticketPriceCents: 1800, quantity: 1 });
    const { applicationFeeCents } = calculateDirectChargeApplicationFee({
      artistPayoutCents: f.artistPayoutCents,
      totalChargeCents: f.totalChargeCents,
    });
    expect(applicationFeeCents).toBe(f.artistPayoutCents);
    const venueNets = f.totalChargeCents - stripeCutOf(f.totalChargeCents) - applicationFeeCents;
    expect(venueNets).toBe(f.venuePayoutCents);
  });

  it('refuses a fee that would leave the merchant nothing', () => {
    expect(() => calculateDirectChargeApplicationFee({ artistPayoutCents: 500, totalChargeCents: 500 })).toThrow('less than');
    expect(() => calculateDirectChargeApplicationFee({ artistPayoutCents: -1, totalChargeCents: 500 })).toThrow();
  });
});
