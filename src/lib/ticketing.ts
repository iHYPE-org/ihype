export const PLATFORM_COMMISSION_PERCENT = 0;
export const DEFAULT_PROMOTER_AFFILIATE_PERCENT = 5;
export const MAX_PROMOTER_AFFILIATE_PERCENT = 10;
export const PROMOTER_POOL_PERCENT = DEFAULT_PROMOTER_AFFILIATE_PERCENT;
export const REMAINING_PAYOUT_PERCENT = 100 - PLATFORM_COMMISSION_PERCENT - PROMOTER_POOL_PERCENT;

type SplitInput = {
  venuePayoutPercent: number;
  artistPayoutPercent: number;
  promoterPayoutPercent?: number;
};

type OrderInput = SplitInput & {
  ticketPriceCents: number;
  quantity: number;
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
  promoterPayoutPercent = DEFAULT_PROMOTER_AFFILIATE_PERCENT
}: OrderInput) {
  validateTicketSplit({
    venuePayoutPercent,
    artistPayoutPercent,
    promoterPayoutPercent
  });

  if (!Number.isInteger(ticketPriceCents) || ticketPriceCents < 0) {
    throw new Error('Ticket price must be a non-negative whole number of cents.');
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Ticket quantity must be a positive whole number.');
  }

  const subtotalCents = ticketPriceCents * quantity;
  const venuePayoutCents = Math.round(subtotalCents * (venuePayoutPercent / 100));
  const promoterPayoutCents = Math.round(subtotalCents * (promoterPayoutPercent / 100));
  const artistPayoutCents = subtotalCents - venuePayoutCents - promoterPayoutCents;

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
  if (!Number.isInteger(ticketPriceCents) || ticketPriceCents < 0) {
    throw new Error('Ticket price must be a non-negative whole number of cents.');
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

  return {
    ...payouts,
    ...taxes,
    totalChargeCents: payouts.subtotalCents + taxes.totalTaxCents
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
