import { stripeCutOf } from '@/lib/stripe-fees';
import { describe, it, expect } from 'vitest';
import {
  validateTicketSplit,
  calculateTicketOrderPayouts,
  calculateTicketTaxes,
  calculateTicketOrderFinancials,
  calculateDestinationChargeSplit,
  calculateDirectChargeApplicationFee,
  getRemainingPayoutPercent,
  PLATFORM_COMMISSION_PERCENT,
  DEFAULT_PROMOTER_AFFILIATE_PERCENT
} from '../ticketing';

describe('platform constants', () => {
  it('charges zero platform commission', () => {
    expect(PLATFORM_COMMISSION_PERCENT).toBe(0);
  });

  it('defaults promoter affiliate to 10%', () => {
    expect(DEFAULT_PROMOTER_AFFILIATE_PERCENT).toBe(10);
  });
});

describe('getRemainingPayoutPercent', () => {
  it('returns 90% with default 10% promoter', () => {
    expect(getRemainingPayoutPercent()).toBe(90);
  });

  it('returns 90% when promoter takes 10%', () => {
    expect(getRemainingPayoutPercent(10)).toBe(90);
  });

  it('returns 100% when promoter takes 0%', () => {
    expect(getRemainingPayoutPercent(0)).toBe(100);
  });
});

describe('validateTicketSplit', () => {
  it('accepts a valid 70/20/10 split', () => {
    expect(() =>
      validateTicketSplit({ venuePayoutPercent: 20, artistPayoutPercent: 70 })
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
    ).toThrow('must total 90%');
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

  it('rejects non-positive ticket price', () => {
    expect(() =>
      calculateTicketOrderPayouts({ ...base, ticketPriceCents: 0 })
    ).toThrow('positive');
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
  it('total charge is subtotal + tax + the buyer-paid Stripe fee', () => {
    const result = calculateTicketOrderFinancials({
      ticketPriceCents: 2500,
      quantity: 1,
      venuePayoutPercent: 45,
      artistPayoutPercent: 50,
      promoterPayoutPercent: 5,
      buyerLocation: { stateRegion: 'NY', country: 'US', postalCode: '10001' },
      venueLocation: { stateRegion: 'NY', country: 'US', postalCode: '10001' }
    });
    // iHYPE is a nonprofit and absorbs no fee, so processing rides on top of
    // the charge rather than coming out of it.
    expect(result.processingFeeCents).toBeGreaterThan(0);
    // Four named components and nothing else. The reserve joined this sum on
    // 2026-08-27; it is charged on top of face value like processing is, and
    // like processing it is not part of anyone's share.
    expect(result.totalChargeCents).toBe(
      result.subtotalCents + result.totalTaxCents + result.reserveFeeCents + result.processingFeeCents,
    );
    // And the quoted fee really does cover what Stripe takes — over the
    // reserve too, which is why the reserve is inside the gross-up.
    expect(result.totalChargeCents - stripeCutOf(result.totalChargeCents))
      .toBeGreaterThanOrEqual(result.subtotalCents + result.totalTaxCents + result.reserveFeeCents);
  });

  it('keeps the processing fee out of the split entirely', () => {
    const result = calculateTicketOrderFinancials({
      ticketPriceCents: 2500,
      quantity: 2,
      venuePayoutPercent: 20,
      artistPayoutPercent: 70,
      promoterPayoutPercent: 10,
      buyerLocation: { stateRegion: 'NY', country: 'US', postalCode: '10001' },
      venueLocation: { stateRegion: 'NY', country: 'US', postalCode: '10001' }
    });
    // The 70/20/10 is a split of FACE VALUE. An artist is paid the same
    // whether the buyer's card cost 30¢ or 85¢ to charge — folding the fee in
    // would hand a slice of Stripe's cut to the artist and leave the platform
    // short by the rest.
    const payouts = result.venuePayoutCents + result.artistPayoutCents + result.promoterPayoutCents;
    expect(payouts).toBe(result.subtotalCents);
    expect(payouts).not.toBe(result.totalChargeCents);
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

describe('the promoter share is only withheld when a promoter earned it', () => {
  /* The charter says "10% promoters (if applicable)", and the parenthesis was
     not implemented: the share came off every order, then sat in an unpayable
     PROMOTER_AFFILIATE entry with a null profileId. On a show nobody promoted,
     a tenth of every ticket was withheld from the artist and the venue and held
     by a platform that takes 0%. */
  const show = { ticketPriceCents: 1800, quantity: 1, venuePayoutPercent: 20, artistPayoutPercent: 70 };

  it('splits 70/20/10 when a promoter is credited', () => {
    const payouts = calculateTicketOrderPayouts({ ...show, hasAffiliatePromoter: true });
    expect(payouts.artistPayoutCents).toBe(1260);
    expect(payouts.venuePayoutCents).toBe(360);
    expect(payouts.promoterPayoutCents).toBe(180);
  });

  it('redistributes the promoter share proportionally when there is none', () => {
    const payouts = calculateTicketOrderPayouts({ ...show, hasAffiliatePromoter: false });
    expect(payouts.promoterPayoutCents).toBe(0);
    // 7:2 preserved — 77.78% / 22.22% of face value, not 80/20.
    expect(payouts.venuePayoutCents).toBe(400);
    expect(payouts.artistPayoutCents).toBe(1400);
  });

  it('always sums to the face value exactly, promoter or not', () => {
    for (const hasAffiliatePromoter of [true, false]) {
      // Prices chosen to force rounding in both directions.
      for (const ticketPriceCents of [1, 7, 333, 1799, 1800, 2501, 99999]) {
        const p = calculateTicketOrderPayouts({ ...show, ticketPriceCents, hasAffiliatePromoter });
        expect(p.artistPayoutCents + p.venuePayoutCents + p.promoterPayoutCents)
          .toBe(p.subtotalCents);
        expect(p.artistPayoutCents).toBeGreaterThanOrEqual(0);
        expect(p.venuePayoutCents).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('defaults to withholding the share, so an existing caller is unchanged', () => {
    const explicit = calculateTicketOrderPayouts({ ...show, hasAffiliatePromoter: true });
    const defaulted = calculateTicketOrderPayouts({ ...show });
    expect(defaulted).toEqual(explicit);
  });
});

describe('the destination-charge split', () => {
  /* On a destination charge Stripe moves the whole charge to the destination
     and pulls the application fee back, so the only number we control is what
     comes back. These pin the arithmetic that decides how much of a fan's
     payment never passes through iHYPE at all. */

  it('leaves the artist their full share of face value, whole', () => {
    // $18 face, no tax: buyer charged 1885, artist keeps 1260 (70% of 1800).
    const financials = calculateTicketOrderFinancials({
      ticketPriceCents: 1800, quantity: 1, venuePayoutPercent: 20, artistPayoutPercent: 70,
      hasAffiliatePromoter: true,
    });
    const split = calculateDestinationChargeSplit({
      totalChargeCents: financials.totalChargeCents,
      destinationPayoutCents: financials.artistPayoutCents,
    });

    // 1800 face + 27 reserve + 86 grossed-up processing.
    expect(financials.totalChargeCents).toBe(1913);
    expect(split.destinationKeepsCents).toBe(1260);
    expect(split.applicationFeeCents).toBe(653);

    /* The load-bearing property: after Stripe takes its cut from the
       PLATFORM's fee, what remains is exactly venue + promoter. If this ever
       fails, someone is being paid out of the processing fee. */
    /* The load-bearing property: after Stripe takes its cut from the
       PLATFORM's fee, what remains covers venue + promoter + reserve. If it
       ever falls SHORT, someone is being paid out of the processing fee.

       Not exact equality, and the slack is meaningful: both the reserve and
       the gross-up round UP, so the platform retains up to a couple of cents
       more than the exact figure. That direction is deliberate and consistent
       across this module — a half-cent left behind would be the platform
       absorbing a cost, and the rule is that it never does. Asserting equality
       here would be asserting that rounding does not happen. */
    const owed = financials.venuePayoutCents + financials.promoterPayoutCents + financials.reserveFeeCents;
    const platformRetains = split.applicationFeeCents - stripeCutOf(financials.totalChargeCents);
    expect(platformRetains).toBeGreaterThanOrEqual(owed);
    expect(platformRetains - owed).toBeLessThanOrEqual(2);
  });

  it('keeps tax on the platform side, never on the destination', () => {
    const financials = calculateTicketOrderFinancials({
      ticketPriceCents: 1800, quantity: 1, venuePayoutPercent: 20, artistPayoutPercent: 70,
      hasAffiliatePromoter: true,
      buyerLocation: { postalCode: '04101', stateRegion: 'ME', country: 'US' },
      venueLocation: { postalCode: '04101', stateRegion: 'ME', country: 'US' },
    });
    expect(financials.totalTaxCents).toBeGreaterThan(0);

    const split = calculateDestinationChargeSplit({
      totalChargeCents: financials.totalChargeCents,
      destinationPayoutCents: financials.artistPayoutCents,
    });
    // The artist's share is of face value and does not move because tax was
    // collected; the whole of the tax sits inside the platform's fee, which is
    // what lets buildPayableEntries write the TAX_* entries against it.
    expect(split.destinationKeepsCents).toBe(1260);
    const owed = financials.venuePayoutCents + financials.promoterPayoutCents
      + financials.totalTaxCents + financials.reserveFeeCents;
    const platformRetains = split.applicationFeeCents - stripeCutOf(financials.totalChargeCents);
    expect(platformRetains).toBeGreaterThanOrEqual(owed);
    expect(platformRetains - owed).toBeLessThanOrEqual(2);
  });

  it('holds when no promoter is credited and the share redistributes', () => {
    const financials = calculateTicketOrderFinancials({
      ticketPriceCents: 1800, quantity: 1, venuePayoutPercent: 20, artistPayoutPercent: 70,
      hasAffiliatePromoter: false,
    });
    const split = calculateDestinationChargeSplit({
      totalChargeCents: financials.totalChargeCents,
      destinationPayoutCents: financials.artistPayoutCents,
    });
    expect(split.destinationKeepsCents).toBe(1400); // 77.78% of face
    const owed = financials.venuePayoutCents + financials.reserveFeeCents; // promoter 0
    const platformRetains = split.applicationFeeCents - stripeCutOf(financials.totalChargeCents);
    expect(platformRetains).toBeGreaterThanOrEqual(owed);
    expect(platformRetains - owed).toBeLessThanOrEqual(2);
  });

  it('refuses a destination payout larger than the charge', () => {
    // Not a rounding artefact — it means the split upstream is wrong, and
    // Stripe would reject it at the moment of purchase instead.
    expect(() => calculateDestinationChargeSplit({
      totalChargeCents: 1000, destinationPayoutCents: 1001,
    })).toThrow(/cannot exceed/i);
  });

  it('accepts a destination that keeps nothing', () => {
    // A free show, or an act whose whole share is held back — legal, and the
    // application fee is simply the entire charge.
    const split = calculateDestinationChargeSplit({ totalChargeCents: 500, destinationPayoutCents: 0 });
    expect(split.applicationFeeCents).toBe(500);
  });
});

describe('the protection reserve', () => {
  const base = { ticketPriceCents: 1800, quantity: 1, venuePayoutPercent: 20, artistPayoutPercent: 70 };

  it('is 1.5% of face value, and does not touch the split', () => {
    const f = calculateTicketOrderFinancials({ ...base, hasAffiliatePromoter: true });
    expect(f.reserveFeeCents).toBe(27); // ceil(1800 * 0.015)
    // The charter is a split of FACE VALUE. Nobody's share moves because a
    // reserve was collected, exactly as nobody's share moves for processing.
    expect(f.artistPayoutCents).toBe(1260);
    expect(f.venuePayoutCents).toBe(360);
    expect(f.promoterPayoutCents).toBe(180);
  });

  it('is inside the gross-up, so Stripe cannot eat into it', () => {
    /* Stripe charges on everything it processes, including the reserve. If the
       reserve were added after the gross-up, the platform would pay Stripe's
       percentage of its own protection fund — the same under-collection
       stripe-fees.ts exists to prevent. */
    const f = calculateTicketOrderFinancials({ ...base, hasAffiliatePromoter: true });
    const keptAfterStripe = f.totalChargeCents - stripeCutOf(f.totalChargeCents);
    expect(keptAfterStripe).toBeGreaterThanOrEqual(
      f.subtotalCents + f.totalTaxCents + f.reserveFeeCents,
    );
  });

  it('adds up: every cent the buyer pays is one of four named things', () => {
    for (const ticketPriceCents of [1, 500, 1799, 1800, 4250, 99999]) {
      for (const hasAffiliatePromoter of [true, false]) {
        const f = calculateTicketOrderFinancials({ ...base, ticketPriceCents, hasAffiliatePromoter });
        expect(f.totalChargeCents).toBe(
          f.subtotalCents + f.totalTaxCents + f.reserveFeeCents + f.processingFeeCents,
        );
        // ...and the face value is exactly the three shares, still.
        expect(f.artistPayoutCents + f.venuePayoutCents + f.promoterPayoutCents)
          .toBe(f.subtotalCents);
      }
    }
  });

  it('leaves the destination charge routing only the act share', () => {
    // The reserve stays with the platform like tax does: it must never reach
    // the act's account, or it could not pay for the dispute it exists for.
    const f = calculateTicketOrderFinancials({ ...base, hasAffiliatePromoter: true });
    const split = calculateDestinationChargeSplit({
      totalChargeCents: f.totalChargeCents,
      destinationPayoutCents: f.artistPayoutCents,
    });
    const owed = f.venuePayoutCents + f.promoterPayoutCents + f.reserveFeeCents;
    const platformRetains = split.applicationFeeCents - stripeCutOf(f.totalChargeCents);
    // Never short; over only by the rounding this module always takes in the
    // platform's favour rather than the parties'.
    expect(platformRetains).toBeGreaterThanOrEqual(owed);
    expect(platformRetains - owed).toBeLessThanOrEqual(2);
  });
});

describe('venue-direct charges', () => {
  const base = { ticketPriceCents: 1800, quantity: 1, venuePayoutPercent: 20, artistPayoutPercent: 70 };

  it('charges no protection reserve, because the venue carries the risk', () => {
    /* The reserve funds refunds and disputes for whoever the merchant is. On a
       direct charge Stripe debits the VENUE's account, so a reserve collected
       by iHYPE would be a fee with no cost behind it. */
    const f = calculateTicketOrderFinancials({ ...base, hasAffiliatePromoter: true, platformBearsRisk: false });
    expect(f.reserveFeeCents).toBe(0);
    expect(f.totalChargeCents).toBe(1885); // 1800 face + 85 processing, nothing else
    // Cheaper for the buyer than the platform-settled mode, by exactly the reserve.
    const platformSettled = calculateTicketOrderFinancials({ ...base, hasAffiliatePromoter: true });
    expect(platformSettled.totalChargeCents - f.totalChargeCents).toBe(platformSettled.reserveFeeCents + 1);
  });

  it('claims only what must be paid onward, leaving the venue its 20%', () => {
    const f = calculateTicketOrderFinancials({ ...base, hasAffiliatePromoter: true, platformBearsRisk: false });
    const { applicationFeeCents } = calculateDirectChargeApplicationFee({
      artistPayoutCents: f.artistPayoutCents,
      promoterPayoutCents: f.promoterPayoutCents,
      totalChargeCents: f.totalChargeCents,
    });
    expect(applicationFeeCents).toBe(1440); // artist 1260 + promoter 180

    /* What the venue nets: the charge, less Stripe's cut (taken from THEIR
       account, since they are the merchant), less what iHYPE claimed. On a
       standard card that is their 20% of face, to the cent. */
    const venueNets = f.totalChargeCents - stripeCutOf(f.totalChargeCents) - applicationFeeCents;
    expect(venueNets).toBe(f.venuePayoutCents);
  });

  it('leaves tax with the venue, who is the one remitting it', () => {
    const f = calculateTicketOrderFinancials({
      ...base, hasAffiliatePromoter: true, platformBearsRisk: false,
      buyerLocation: { postalCode: '04101', stateRegion: 'ME', country: 'US' },
      venueLocation: { postalCode: '04101', stateRegion: 'ME', country: 'US' },
    });
    expect(f.totalTaxCents).toBeGreaterThan(0);
    const { applicationFeeCents } = calculateDirectChargeApplicationFee({
      artistPayoutCents: f.artistPayoutCents,
      promoterPayoutCents: f.promoterPayoutCents,
      totalChargeCents: f.totalChargeCents,
    });
    // iHYPE's fee does not grow by a cent when tax is collected — the merchant
    // of record keeps it and remits it, and here that is the venue.
    expect(applicationFeeCents).toBe(f.artistPayoutCents + f.promoterPayoutCents);
    const venueNets = f.totalChargeCents - stripeCutOf(f.totalChargeCents) - applicationFeeCents;
    expect(venueNets).toBe(f.venuePayoutCents + f.totalTaxCents);
  });

  it('refuses a fee that would leave the merchant nothing', () => {
    // Stripe requires the fee to be LESS than the charge. Reaching this means
    // the split is wrong upstream; fail before a fan tries to pay.
    expect(() => calculateDirectChargeApplicationFee({
      artistPayoutCents: 900, promoterPayoutCents: 100, totalChargeCents: 1000,
    })).toThrow(/less than the total charge/i);
  });
});
