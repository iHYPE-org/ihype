import { spawnSync } from 'node:child_process';
import { stripeCutOf } from '@/lib/stripe-fees';
import US_SALES_TAX from '@/lib/tax/us-sales-tax-rates.json';
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
  SALES_TAX_SOURCE,
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

describe('calculateTicketTaxes — the venue\'s state, from the Tax Foundation table', () => {
  const base = { ticketPriceCents: 1000, quantity: 2 };

  it('charges no tax when the venue has no address', () => {
    expect(calculateTicketTaxes(base).totalTaxCents).toBe(0);
  });

  it('charges the published state rate plus the state\'s average local rate', () => {
    // New York, 2026-01-01: 4% state, 4.5416% population-weighted local.
    const result = calculateTicketTaxes({ ...base, venueLocation: { country: 'US', stateRegion: 'NY' } });
    expect(result.stateCents).toBe(80);
    expect(result.localCents).toBe(91);
    expect(result.totalTaxCents).toBe(171);
  });

  it('reads the table at its own precision: Minnesota\'s 6.875%', () => {
    const result = calculateTicketTaxes({ ticketPriceCents: 10000, quantity: 1, venueLocation: { country: 'US', stateRegion: 'MN' } });
    expect(result.stateCents).toBe(688);
    expect(result.localCents).toBe(126);
  });

  it('charges nothing in a state with no sales tax', () => {
    for (const stateRegion of ['OR', 'NH', 'MT', 'DE']) {
      expect(calculateTicketTaxes({ ...base, venueLocation: { country: 'US', stateRegion } }).totalTaxCents, stateRegion).toBe(0);
    }
  });

  it('never adds a negative local line (New Jersey\'s average local rate is below zero in the source)', () => {
    const result = calculateTicketTaxes({ ...base, venueLocation: { country: 'US', stateRegion: 'NJ' } });
    expect(result.localCents).toBe(0);
    expect(result.stateCents).toBe(Math.round(2000 * 0.06625));
  });

  it('has no federal or cross-border line: the US has no federal sales tax', () => {
    const result = calculateTicketTaxes({ ...base, venueLocation: { country: 'US', stateRegion: 'CA' } });
    expect(result.countryCents).toBe(0);
    expect(result.internationalCents).toBe(0);
    expect(result.totalTaxCents).toBe(result.stateCents + result.localCents);
  });

  it('reads a spelled-out state and country, and the ISO form', () => {
    const expected = calculateTicketTaxes({ ...base, venueLocation: { country: 'US', stateRegion: 'ME' } });
    expect(expected.stateCents).toBe(110);
    for (const venueLocation of [
      { country: 'USA', stateRegion: 'Maine' },
      { country: 'United States', stateRegion: 'US-ME' },
      { country: 'u.s.a.', stateRegion: 'maine' },
    ]) {
      expect(calculateTicketTaxes({ ...base, venueLocation }), JSON.stringify(venueLocation)).toEqual(expected);
    }
  });

  it('charges no tax for a venue outside the US or with an unrecognised state', () => {
    expect(calculateTicketTaxes({ ...base, venueLocation: { country: 'Germany', stateRegion: null } }).totalTaxCents).toBe(0);
    expect(calculateTicketTaxes({ ...base, venueLocation: { country: 'US', stateRegion: 'Atlantis' } }).totalTaxCents).toBe(0);
    expect(calculateTicketTaxes({ ...base, venueLocation: { country: null, stateRegion: 'NY' } }).totalTaxCents).toBe(0);
  });

  it('covers all fifty states and DC, and names its source', () => {
    expect(Object.keys(US_SALES_TAX.rates)).toHaveLength(51);
    expect(SALES_TAX_SOURCE.asOf).toBe('2026-01-01');
    expect(SALES_TAX_SOURCE.publisher).toBe('Tax Foundation');
  });

  it('matches the committed workbook it was derived from', () => {
    const result = spawnSync(process.execPath, ['scripts/import-sales-tax-rates.mjs', '--check'], { encoding: 'utf8' });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('rejects invalid ticket price', () => {
    expect(() => calculateTicketTaxes({ ticketPriceCents: -100, quantity: 1 })).toThrow();
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
