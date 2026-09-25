import { formatUsd } from '@/lib/format-locale';
import type { Locale } from '@/lib/i18n/locales';
import { stripeCutOf } from '@/lib/stripe-fees';
import US_SALES_TAX from '@/lib/tax/us-sales-tax-rates.json';
export const PLATFORM_COMMISSION_PERCENT = 0;

/**
 * THE SPLIT: 75% to the artist, 25% to the venue, 0% to iHYPE — of what is
 * left of the face value after Stripe's fee (owner, 2026-09-25: "Take fee off
 * the top for sure. It should be a split POST fee between artist/venue", with
 * 75/25 and no sale until the venue is the merchant).
 *
 * It replaced the 70/20/10 charter split. The 10% promoter pool is gone: a
 * HYPE link still records who referred a sale, and earns nothing.
 *
 * ## Why the fee comes off the top
 *
 * The venue is the merchant of record on every sale (see the purchase route),
 * and Stripe debits its fee from the merchant. Left there, the whole fee would
 * fall on the venue's quarter: $3.20 of a $100 ticket is 12.8% of a $25
 * share. Taking it off the face value first spreads it 75/25, the same as the
 * money, so neither party pays for the other's share of the charge.
 *
 * ## What "the fee" is here
 *
 * An ESTIMATE at Stripe's standard US rate (`stripeCutOf`), computed on the
 * whole charge — face value plus tax, because Stripe charges on everything it
 * processes. The application fee that carries the artist's share is fixed when
 * the checkout session is created, before the card brand is known, so an Amex
 * or international card (which cost more) leaves the venue a few cents under
 * 25%. That gap is stated rather than hidden; see DESIGN_SYNC row 520.
 *
 * Tax is never part of the split. The venue collects and remits it as the
 * merchant, so the fee is taken from the face value, not from the tax.
 */
export const ARTIST_SHARE_PERCENT = 75;
export const VENUE_SHARE_PERCENT = 25;

type SplitInput = {
  venuePayoutPercent: number;
  artistPayoutPercent: number;
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
  /** The venue's address. Admission is taxed where the event takes place. */
  venueLocation?: TaxLocation | null;
  /** The venue's own combined rate in parts per million (`Profile.ticketTaxRatePpm`).
   *  When set — including 0, a confirmed exemption — it replaces the table. */
  venueTaxRatePpm?: number | null;
};

export type TicketTaxBreakdown = {
  localCents: number;
  stateCents: number;
  countryCents: number;
  internationalCents: number;
  totalTaxCents: number;
  /** Where the rate came from: the venue's own figure, the published state
   *  table, or nowhere (no US state on file, so no tax is added). */
  rateSource: TaxRateSource;
};

export type TaxRateSource = 'venue' | 'table' | 'none';

/** The highest rate a venue may state: 25%. Real combined admissions rates
 *  are well under this; the ceiling exists so a typo cannot charge a buyer
 *  double. The database carries the same bound as a CHECK constraint. */
export const MAX_VENUE_TAX_RATE_PPM = 250_000;

export function isValidVenueTaxRatePpm(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_VENUE_TAX_RATE_PPM;
}

export function validateTicketSplit({ venuePayoutPercent, artistPayoutPercent }: SplitInput) {
  if (!Number.isInteger(venuePayoutPercent) || !Number.isInteger(artistPayoutPercent)) {
    throw new Error('Venue and artist payout percentages must be whole numbers.');
  }
  if (venuePayoutPercent < 0 || artistPayoutPercent < 0) {
    throw new Error('Payout percentages cannot be negative.');
  }
  if (venuePayoutPercent + artistPayoutPercent !== 100 - PLATFORM_COMMISSION_PERCENT) {
    throw new Error('Venue and artist percentages must total 100%.');
  }
}

/**
 * The split of one order's net face value — the face value less Stripe's fee.
 *
 * The artist absorbs the rounding remainder, the convention the lineup split
 * and the display bar already follow, so the two shares always sum to the net
 * exactly and no cent is left in anyone's balance unassigned.
 */
export function calculateTicketOrderPayouts({
  ticketPriceCents,
  quantity,
  venuePayoutPercent,
  artistPayoutPercent,
  stripeFeeCents = 0,
}: OrderInput & {
  /** Stripe's fee, taken off the face value before the split. */
  stripeFeeCents?: number;
}) {
  validateTicketSplit({ venuePayoutPercent, artistPayoutPercent });

  if (!Number.isInteger(ticketPriceCents) || ticketPriceCents <= 0) {
    throw new Error('Ticket price must be a positive whole number of cents.');
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Ticket quantity must be a positive whole number.');
  }
  if (!Number.isInteger(stripeFeeCents) || stripeFeeCents < 0) {
    throw new Error('Stripe fee must be a non-negative whole number of cents.');
  }

  const subtotalCents = ticketPriceCents * quantity;
  /* A fee the face value cannot cover leaves nothing to split; a ticket that
     cheap cannot be sold through a card processor at all, so it is refused
     rather than priced at a loss to the venue. */
  if (stripeFeeCents >= subtotalCents) {
    throw new Error('Ticket price is too low to cover the card processing fee.');
  }
  const netCents = subtotalCents - stripeFeeCents;
  const venuePayoutCents = Math.round(netCents * (venuePayoutPercent / 100));
  const artistPayoutCents = netCents - venuePayoutCents;

  return {
    subtotalCents,
    stripeFeeCents,
    netCents,
    venuePayoutCents,
    artistPayoutCents,
    /** No promoter share since 2026-09-25; kept on the order row as 0. */
    promoterPayoutCents: 0,
    platformCommissionCents: 0,
  };
}

function normalizeLocationValue(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

/* ONE SPELLING PER PLACE (2026-09-24, DESIGN_SYNC row 513).

   The buyer's side of every comparison below comes from Cloudflare's edge
   (`cf-ipcountry` is an ISO code, `US`; `cf-region-code` is a subdivision
   code, `ME`), and the venue's side is whatever the owner typed into a free
   80-character field (the demo seed alone writes `USA`). Compared raw, `us`
   never equalled `usa`, so a Portland fan buying a Portland ticket was charged
   the 7% cross-border rate instead of the domestic one — an overcharge on
   every sale at a venue that spelled its country out. Both sides are reduced
   to one code first: an ISO 3166-1 alpha-2 for a country (every English
   region name Intl knows, plus the common short forms), a two-letter code for
   a US state. Anything unrecognised is compared as typed, exactly as before. */
const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'us', 'u.s.': 'us', 'u.s.a.': 'us', 'u.s': 'us', america: 'us',
  'united states of america': 'us', uk: 'gb', 'u.k.': 'gb', england: 'gb',
  scotland: 'gb', wales: 'gb', 'northern ireland': 'gb', 'great britain': 'gb',
};

let countryNames: Map<string, string> | null = null;
function countryNameIndex(): Map<string, string> {
  if (countryNames) return countryNames;
  const index = new Map<string, string>();
  try {
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    for (let a = 65; a <= 90; a += 1) {
      for (let b = 65; b <= 90; b += 1) {
        const code = String.fromCharCode(a, b);
        const name = names.of(code);
        if (name && name !== code) index.set(name.toLowerCase(), code.toLowerCase());
      }
    }
  } catch {
    // No Intl region names: codes and the alias table still work.
  }
  countryNames = index;
  return index;
}

export function normalizeCountry(value?: string | null): string | null {
  const raw = normalizeLocationValue(value);
  if (!raw) return null;
  if (COUNTRY_ALIASES[raw]) return COUNTRY_ALIASES[raw];
  if (/^[a-z]{2}$/.test(raw)) return raw;
  return countryNameIndex().get(raw) ?? raw;
}

const US_STATE_CODES: Record<string, string> = {
  alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar', california: 'ca', colorado: 'co',
  connecticut: 'ct', delaware: 'de', 'district of columbia': 'dc', florida: 'fl', georgia: 'ga',
  hawaii: 'hi', idaho: 'id', illinois: 'il', indiana: 'in', iowa: 'ia', kansas: 'ks', kentucky: 'ky',
  louisiana: 'la', maine: 'me', maryland: 'md', massachusetts: 'ma', michigan: 'mi', minnesota: 'mn',
  mississippi: 'ms', missouri: 'mo', montana: 'mt', nebraska: 'ne', nevada: 'nv', 'new hampshire': 'nh',
  'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny', 'north carolina': 'nc', 'north dakota': 'nd',
  ohio: 'oh', oklahoma: 'ok', oregon: 'or', pennsylvania: 'pa', 'rhode island': 'ri',
  'south carolina': 'sc', 'south dakota': 'sd', tennessee: 'tn', texas: 'tx', utah: 'ut', vermont: 'vt',
  virginia: 'va', washington: 'wa', 'west virginia': 'wv', wisconsin: 'wi', wyoming: 'wy',
  'puerto rico': 'pr',
};

export function normalizeStateRegion(value?: string | null): string | null {
  const raw = normalizeLocationValue(value);
  if (!raw) return null;
  // `US-ME`, the ISO 3166-2 form, is the same state as `ME`.
  const iso = /^[a-z]{2}-([a-z0-9]{1,3})$/.exec(raw);
  if (iso) return iso[1];
  return US_STATE_CODES[raw] ?? raw;
}

/**
 * TICKET TAX IS THE VENUE'S JURISDICTION, READ FROM A PUBLISHED TABLE.
 *
 * Admission is taxed where the event takes place, not where the buyer happens
 * to be, and the venue is the merchant that remits it — so the only location
 * that decides the rate is the venue's. The rates are the Tax Foundation's
 * "State and Local Sales Tax Rates" as of 2026-01-01 (`us-sales-tax-rates.json`,
 * derived from the workbook committed at `data/tax/` by
 * `scripts/import-sales-tax-rates.mjs`):
 *
 *   state  the statewide rate (CA, UT and VA include their mandatory
 *          statewide local add-ons, as the source does)
 *   local  the POPULATION-WEIGHTED AVERAGE of local rates in that state —
 *          an estimate, because a venue's own city or county rate is not in
 *          any statewide table
 *
 * There is no federal sales tax in the United States, so `countryCents` and
 * `internationalCents` are always 0; they stay on the breakdown because the
 * order columns and payable categories they fill predate this table. A venue
 * outside the US, or with no recognisable state, is charged no tax here.
 *
 * WHAT THE TABLE DOES NOT KNOW, stated because the tax line is on a receipt:
 * many states exempt admissions from sales tax or tax them under a separate
 * amusement tax at a different rate, and some cities add an admissions tax of
 * their own. So a venue may state its own rate (`Profile.ticketTaxRatePpm`,
 * set in the profile editor), and when it has, that figure replaces the table
 * entirely — see `venueTaxRatePpm` below.
 */
export const SALES_TAX_SOURCE = US_SALES_TAX.source;

export function salesTaxRatesForVenue(venueLocation?: TaxLocation | null): { stateRatePpm: number; avgLocalRatePpm: number } | null {
  const country = normalizeCountry(venueLocation?.country);
  if (country !== 'us') return null;
  const state = normalizeStateRegion(venueLocation?.stateRegion);
  if (!state) return null;
  return (US_SALES_TAX.rates as Record<string, { stateRatePpm: number; avgLocalRatePpm: number }>)[state] ?? null;
}

const applyPpm = (cents: number, ppm: number) => Math.round((cents * ppm) / 1_000_000);

export function calculateTicketTaxes({
  ticketPriceCents,
  quantity,
  venueLocation,
  venueTaxRatePpm
}: TicketTaxInput): TicketTaxBreakdown {
  if (!Number.isInteger(ticketPriceCents) || ticketPriceCents <= 0) {
    throw new Error('Ticket price must be a positive whole number of cents.');
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Ticket quantity must be a positive whole number.');
  }

  const subtotalCents = ticketPriceCents * quantity;

  /* THE VENUE'S OWN RATE WINS. It is the merchant, it remits the tax, and it
     knows what the table cannot: an admissions exemption, a separate
     amusement tax, a city's own ticket tax. The whole figure is carried on
     `stateCents` (the order columns predate the override) and `rateSource`
     tells a reader not to label it "state". An out-of-range value — which the
     editor and the CHECK constraint both refuse — is ignored rather than
     trusted. */
  if (venueTaxRatePpm != null && isValidVenueTaxRatePpm(venueTaxRatePpm)) {
    const venueCents = applyPpm(subtotalCents, venueTaxRatePpm);
    return {
      localCents: 0,
      stateCents: venueCents,
      countryCents: 0,
      internationalCents: 0,
      totalTaxCents: venueCents,
      rateSource: 'venue',
    };
  }

  const rates = salesTaxRatesForVenue(venueLocation);
  const stateCents = rates ? applyPpm(subtotalCents, rates.stateRatePpm) : 0;
  const localCents = rates ? applyPpm(subtotalCents, rates.avgLocalRatePpm) : 0;

  return {
    localCents,
    stateCents,
    countryCents: 0,
    internationalCents: 0,
    totalTaxCents: localCents + stateCents,
    rateSource: rates ? 'table' : 'none',
  };
}

export function calculateTicketOrderFinancials(input: OrderInput & TicketTaxInput) {
  const taxes = calculateTicketTaxes(input);
  const subtotalCents = input.ticketPriceCents * input.quantity;

  /* The buyer pays the face value and its tax, and nothing else: no
     processing line and no protection reserve. The venue is the merchant, so
     Stripe's fee is the sellers' cost, taken off the top below; the reserve
     funded disputes iHYPE carried as merchant, and iHYPE carries none now. */
  const totalChargeCents = subtotalCents + taxes.totalTaxCents;
  const stripeFeeCents = stripeCutOf(totalChargeCents);
  const payouts = calculateTicketOrderPayouts({ ...input, stripeFeeCents });

  return {
    ...payouts,
    ...taxes,
    reserveFeeCents: 0,
    /** What the BUYER paid on top of face value and tax: nothing. */
    processingFeeCents: 0,
    totalChargeCents,
  };
}

export function formatCurrencyFromCents(amountCents: number, locale: Locale) {
  return formatUsd(locale, amountCents, 2);
}

export function formatPercent(value: number) {
  return `${value}%`;
}

/**
 * The application fee on a VENUE-DIRECT charge: exactly the artist's share,
 * which iHYPE pays onward, and not one cent more.
 *
 * The charge is created ON the venue's Connect account (`Stripe-Account`
 * header). Stripe deducts its processing fee and the application fee from that
 * account, and the venue keeps the rest — its 25% of the net face value plus
 * the tax it collects and remits as merchant. So the platform does not decide
 * what the venue receives; it decides what it TAKES, and the venue's share is
 * the remainder.
 *
 * ## Who ends up with what, on an $18 ticket with no tax
 *
 *   buyer charged            1800   (face value; no processing line)
 *   Stripe takes               82   from the VENUE's account, as merchant
 *   net face                 1718   split 75/25
 *   application fee          1289   → iHYPE, then out again to the artist
 *   venue keeps               429   = 1800 − 82 − 1289, its 25% of the net
 *
 * The 82 is the standard-rate estimate. Stripe's real cut on an Amex or
 * international card is higher, and the difference comes out of the venue's
 * side, because the application fee was fixed when the session was created.
 */
export function calculateDirectChargeApplicationFee({
  artistPayoutCents,
  totalChargeCents,
}: {
  artistPayoutCents: number;
  /** Only for the sanity check below — Stripe caps the fee at the charge. */
  totalChargeCents: number;
}): { applicationFeeCents: number } {
  if (!Number.isInteger(artistPayoutCents) || artistPayoutCents < 0) {
    throw new Error('The onward share must be a non-negative whole number of cents.');
  }
  const applicationFeeCents = artistPayoutCents;
  /* Stripe requires the fee to be LESS than the charge, not merely equal: a
     fee equal to the whole charge leaves the merchant nothing to pay Stripe
     from. Reaching this means the split is wrong upstream, so it fails here
     rather than at the moment a fan tries to pay. */
  if (applicationFeeCents >= totalChargeCents) {
    throw new Error('Application fee must be less than the total charge.');
  }
  return { applicationFeeCents };
}
