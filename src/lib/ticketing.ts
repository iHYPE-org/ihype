import { calculateProcessingFee } from '@/lib/stripe-fees';
export const PLATFORM_COMMISSION_PERCENT = 0;
export const DEFAULT_PROMOTER_AFFILIATE_PERCENT = 10;
export const MAX_PROMOTER_AFFILIATE_PERCENT = 10;

type SplitInput = {
  venuePayoutPercent: number;
  artistPayoutPercent: number;
  promoterPayoutPercent?: number;
};

type OrderInput = SplitInput & {
  ticketPriceCents: number;
  quantity: number;
  /**
   * Whether a promoter is actually being credited on THIS order — the charter's
   * "10% promoters (if applicable)", where the parenthesis is load-bearing.
   *
   * It has to be a per-order input rather than a property of the show, and that
   * asymmetry is what hid the bug: `Show.promoterPayoutPercent` is configured
   * when the show is created, but whether a promoter is involved is only known
   * at purchase, from the referral cookie. So the percentage was applied to
   * every order and the share was withheld whether or not anyone had earned it.
   *
   * Defaults to true so an existing caller that genuinely has a promoter keeps
   * today's arithmetic exactly; the purchase route passes the real answer.
   */
  hasAffiliatePromoter?: boolean;
};

type TaxLocation = {
  postalCode?: string | null;
  stateRegion?: string | null;
  country?: string | null;
};

type TicketTaxInput = {
  ticketPriceCents: number;
  quantity: number;
  buyerLocation?: TaxLocation | null;
  venueLocation?: TaxLocation | null;
};

export type TicketTaxBreakdown = {
  localCents: number;
  stateCents: number;
  countryCents: number;
  internationalCents: number;
  totalTaxCents: number;
};

export function getRemainingPayoutPercent(promoterPayoutPercent = DEFAULT_PROMOTER_AFFILIATE_PERCENT) {
  return 100 - PLATFORM_COMMISSION_PERCENT - promoterPayoutPercent;
}

export function validateTicketSplit({
  venuePayoutPercent,
  artistPayoutPercent,
  promoterPayoutPercent = DEFAULT_PROMOTER_AFFILIATE_PERCENT
}: SplitInput) {
  if (!Number.isInteger(venuePayoutPercent) || !Number.isInteger(artistPayoutPercent)) {
    throw new Error('Venue and artist payout percentages must be whole numbers.');
  }

  if (!Number.isInteger(promoterPayoutPercent)) {
    throw new Error('Affiliate promoter percentage must be a whole number.');
  }

  if (promoterPayoutPercent < 0 || promoterPayoutPercent > MAX_PROMOTER_AFFILIATE_PERCENT) {
    throw new Error(`Affiliate promoter payout must be between 0% and ${MAX_PROMOTER_AFFILIATE_PERCENT}%.`);
  }

  if (venuePayoutPercent < 0 || artistPayoutPercent < 0) {
    throw new Error('Payout percentages cannot be negative.');
  }

  const remainingPayoutPercent = getRemainingPayoutPercent(promoterPayoutPercent);

  if (venuePayoutPercent + artistPayoutPercent !== remainingPayoutPercent) {
    throw new Error(
      `Venue and artist percentages must total ${remainingPayoutPercent}% when the affiliate promoter share is ${promoterPayoutPercent}%.`
    );
  }
}

export function calculateTicketOrderPayouts({
  ticketPriceCents,
  quantity,
  venuePayoutPercent,
  artistPayoutPercent,
  promoterPayoutPercent = DEFAULT_PROMOTER_AFFILIATE_PERCENT,
  hasAffiliatePromoter = true
}: OrderInput) {
  validateTicketSplit({
    venuePayoutPercent,
    artistPayoutPercent,
    promoterPayoutPercent
  });

  if (!Number.isInteger(ticketPriceCents) || ticketPriceCents <= 0) {
    throw new Error('Ticket price must be a positive whole number of cents.');
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Ticket quantity must be a positive whole number.');
  }

  const subtotalCents = ticketPriceCents * quantity;

  /**
   * NO PROMOTER MEANS NO PROMOTER SHARE — the charter's "(if applicable)".
   *
   * Until 2026-08-27 the 10% came off every order regardless. `buildPayableEntries`
   * then wrote a PROMOTER_AFFILIATE entry with a null profileId labelled
   * "Promoter affiliate pool", and `triggerShowPayouts()` cannot pay an entry
   * with no connected account — so on a show nobody promoted, a tenth of every
   * ticket was withheld from the artist and the venue and parked in iHYPE's
   * balance permanently. The platform takes 0%, so there was no charter basis
   * for holding it, and nothing reported it: the entry looked like the tax
   * entries, which legitimately stay PENDING.
   *
   * The unearned share is redistributed PROPORTIONALLY, preserving the
   * configured artist:venue ratio (70:20). Neither party gains at the other's
   * expense — on a default show the artist takes 77.78% and the venue 22.22%,
   * which is the same 7:2 relationship the charter states.
   *
   * The formula is deliberately one expression for both cases rather than a
   * branch: with a promoter, `distributable` is 90% of the subtotal and the
   * ratio puts the venue back on exactly 20% and the artist on 70%, identical
   * to the old arithmetic. A branch would have let the two paths drift.
   *
   * The artist absorbs the rounding remainder, the same convention the lineup
   * split and the display bar already follow, so the shares always sum to the
   * face value exactly.
   */
  const promoterPayoutCents = hasAffiliatePromoter
    ? Math.round(subtotalCents * (promoterPayoutPercent / 100))
    : 0;
  const distributableCents = subtotalCents - promoterPayoutCents;
  const venueShareOfRest = venuePayoutPercent / (venuePayoutPercent + artistPayoutPercent);
  const venuePayoutCents = Math.round(distributableCents * venueShareOfRest);
  const artistPayoutCents = distributableCents - venuePayoutCents;

  return {
    subtotalCents,
    venuePayoutCents,
    artistPayoutCents,
    promoterPayoutCents,
    platformCommissionCents: 0
  };
}

function normalizeLocationValue(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function hasSamePostalCode(buyerLocation?: TaxLocation | null, venueLocation?: TaxLocation | null) {
  return Boolean(
    normalizeLocationValue(buyerLocation?.postalCode) &&
      normalizeLocationValue(buyerLocation?.postalCode) === normalizeLocationValue(venueLocation?.postalCode)
  );
}

function hasSameStateRegion(buyerLocation?: TaxLocation | null, venueLocation?: TaxLocation | null) {
  return Boolean(
    normalizeLocationValue(buyerLocation?.stateRegion) &&
      normalizeLocationValue(buyerLocation?.stateRegion) === normalizeLocationValue(venueLocation?.stateRegion) &&
      hasSameCountry(buyerLocation, venueLocation)
  );
}

function hasSameCountry(buyerLocation?: TaxLocation | null, venueLocation?: TaxLocation | null) {
  return Boolean(
    normalizeLocationValue(buyerLocation?.country) &&
      normalizeLocationValue(buyerLocation?.country) === normalizeLocationValue(venueLocation?.country)
  );
}

export function calculateTicketTaxes({
  ticketPriceCents,
  quantity,
  buyerLocation,
  venueLocation
}: TicketTaxInput): TicketTaxBreakdown {
  if (!Number.isInteger(ticketPriceCents) || ticketPriceCents <= 0) {
    throw new Error('Ticket price must be a positive whole number of cents.');
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Ticket quantity must be a positive whole number.');
  }

  const subtotalCents = ticketPriceCents * quantity;
  const buyerCountry = normalizeLocationValue(buyerLocation?.country);
  const venueCountry = normalizeLocationValue(venueLocation?.country);

  if (!buyerCountry && !venueCountry) {
    return {
      localCents: 0,
      stateCents: 0,
      countryCents: 0,
      internationalCents: 0,
      totalTaxCents: 0
    };
  }

  const isSameCountry = hasSameCountry(buyerLocation, venueLocation);
  const isSameStateRegion = hasSameStateRegion(buyerLocation, venueLocation);
  const isSamePostalCode = hasSamePostalCode(buyerLocation, venueLocation);

  const localCents = isSamePostalCode ? Math.round(subtotalCents * 0.02) : 0;
  const stateCents = isSameStateRegion ? Math.round(subtotalCents * 0.03) : 0;
  const countryCents = isSameCountry ? Math.round(subtotalCents * 0.025) : 0;
  const internationalCents = buyerCountry && venueCountry && !isSameCountry ? Math.round(subtotalCents * 0.07) : 0;
  const totalTaxCents = localCents + stateCents + countryCents + internationalCents;

  return {
    localCents,
    stateCents,
    countryCents,
    internationalCents,
    totalTaxCents
  };
}

export function calculateTicketOrderFinancials(input: OrderInput & TicketTaxInput) {
  const payouts = calculateTicketOrderPayouts(input);
  const taxes = calculateTicketTaxes(input);

  /**
   * The buyer pays Stripe's fee; iHYPE absorbs nothing (nonprofit — the
   * platform's cut is $0 and that includes processing).
   *
   * It is added AFTER the payouts are computed, and deliberately not fed back
   * into them: the 70/20/10 split is a split of face value, so an artist is
   * paid the same whether the buyer's card cost 30¢ or 85¢ to charge. Feeding
   * the fee into the split would quietly hand a slice of Stripe's cut to the
   * artist and leave the platform short by the rest.
   *
   * Grossed up over subtotal + taxes, because Stripe charges on everything it
   * processes — see `stripe-fees.ts` for why a flat percentage under-collects.
   */
  const processing = calculateProcessingFee(payouts.subtotalCents + taxes.totalTaxCents);

  return {
    ...payouts,
    ...taxes,
    processingFeeCents: processing.feeCents,
    totalChargeCents: payouts.subtotalCents + taxes.totalTaxCents + processing.feeCents
  };
}

export function formatCurrencyFromCents(amountCents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amountCents / 100);
}

export function formatPercent(value: number) {
  return `${value}%`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Destination charges: what the platform keeps, and what Stripe routes for us
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * The application fee for a destination charge — everything the platform holds
 * back from a charge whose destination is the act being paid.
 *
 * ## Why the split is expressed this way round
 *
 * On a destination charge Stripe moves the WHOLE charge to the destination
 * account and then pulls `application_fee_amount` back to the platform. So the
 * only number we control is what comes back, and what the destination keeps is
 * whatever we do not claim. Writing it as `total - destination` rather than
 * `venue + promoter + tax + fee` is deliberate: those are the same figure only
 * while every component is accounted for, and the subtraction cannot silently
 * omit one. A missed component would not fail — it would quietly overpay the
 * destination out of the tax money.
 *
 * ## What each party ends up with, on an $18 ticket with no tax
 *
 *   buyer charged            1885   (face 1800 + 85 grossed-up processing)
 *   application fee           625   → platform
 *     Stripe takes             85   from the platform's fee, not the artist's
 *     platform retains        540   = venue 360 + promoter 180
 *   destination keeps        1260   = the artist's 70% of FACE VALUE, whole
 *
 * The artist's share is unaffected by what the buyer's card cost to process,
 * which is the same rule `calculateProcessingFee` already encodes and the
 * reason the fee is grossed up rather than deducted.
 *
 * ## Taxes ride with the platform, on purpose
 *
 * Tax is collected from the buyer and remitted by iHYPE, so it must not reach
 * the destination account. It is inside the application fee for exactly that
 * reason — `buildPayableEntries` still writes the TAX_* entries against it.
 *
 * ## Lineups
 *
 * A destination charge has ONE destination. With accepted lineup slots the
 * headliner's own slice is routed atomically and the remaining acts stay
 * platform-held payables, so `destinationPayoutCents` is the slice being routed
 * rather than the whole artist share. Callers pass what they mean.
 */
export function calculateDestinationChargeSplit({
  totalChargeCents,
  destinationPayoutCents,
}: {
  /** What Stripe is asked to charge: face value + tax + grossed-up processing. */
  totalChargeCents: number;
  /** The share routed straight to the destination account, of FACE VALUE. */
  destinationPayoutCents: number;
}): { applicationFeeCents: number; destinationKeepsCents: number } {
  if (!Number.isInteger(totalChargeCents) || totalChargeCents <= 0) {
    throw new Error('Total charge must be a positive whole number of cents.');
  }
  if (!Number.isInteger(destinationPayoutCents) || destinationPayoutCents < 0) {
    throw new Error('Destination payout must be a non-negative whole number of cents.');
  }
  /* Stripe caps `application_fee_amount` at the charge amount, and a
     destination that keeps a negative share is not a rounding artefact — it
     means a caller has passed a payout larger than the charge, which is a
     split miscalculation upstream. Fail loudly rather than let Stripe reject
     it at the moment of purchase. */
  if (destinationPayoutCents > totalChargeCents) {
    throw new Error('Destination payout cannot exceed the total charge.');
  }
  return {
    applicationFeeCents: totalChargeCents - destinationPayoutCents,
    destinationKeepsCents: destinationPayoutCents,
  };
}
