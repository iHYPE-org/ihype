/**
 * Sponsorship pricing for the self-serve advertiser (`/advertise`).
 *
 * WHY THIS IS NOT PRICED PER IMPRESSION ANY MORE (2026-09-10, owner: "Let's
 * move to your suggestion and we can always adjust if we go to scale").
 *
 * The old model sold "spots per day" at a per-spot rate and quoted an
 * impression count beside it — LOCAL was $0.15 a spot a day against 800
 * impressions, a $0.19 CPM — while delivery charged a flat 9c an impression,
 * a $90 CPM. The two disagreed by 480x, and the buyer took the loss both
 * ways: a $45 local campaign quoted 240,000 impressions, delivered 500,
 * went dark for the rest of its run, and was refunded nothing.
 *
 * Neither number was reachable. A break airs every 15 minutes with two spots
 * (`station-breaks.ts`), so the station makes EIGHT impressions per
 * listener-hour. Filling one LOCAL buyer at the quoted rate needed 100
 * listener-hours a day; GLOBAL needed 5,250. Impressions were being sold out
 * of inventory that does not exist.
 *
 * So the unit is time, not impressions:
 *
 *   - A sponsor buys a TERM (months) at a flat monthly rate. What they are
 *     buying is presence in the rotation, which is what the delivery engine
 *     already gives: `resolveWeightedAdBreakClips` orders by `impressions:
 *     asc`, so airtime is shared EQUALLY among live sponsors. The serving
 *     side was always built for this and only the storefront thought in CPM.
 *   - Impressions are the DELIVERY REPORT, never the meter. Nothing decrements
 *     a budget, so a sponsor cannot go dark mid-term.
 *   - The charter says iHYPE is "funded like radio", ads restricted to
 *     music-related sources forever, as a 501(c)(3). That is underwriting,
 *     and underwriting is sold by the month.
 *
 * WHEN TO REVISIT. Per-impression pricing becomes viable once the station
 * can forecast inventory — roughly, once a month's listener-hours are large
 * and steady enough that a CPM promise is one you can keep. Until then the
 * failure mode of CPM is overselling the local businesses this platform most
 * needs to keep.
 */

export type AdScope = 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'GLOBAL';

export const AD_SCOPES: AdScope[] = ['LOCAL', 'REGIONAL', 'NATIONAL', 'GLOBAL'];

export const AD_SCOPE_LABELS: Record<AdScope, string> = {
  LOCAL: 'Local',
  REGIONAL: 'Regional',
  NATIONAL: 'National',
  GLOBAL: 'Global',
};

export const AD_SCOPE_DESCRIPTIONS: Record<AdScope, string> = {
  LOCAL: 'Your city',
  REGIONAL: 'State/metro',
  NATIONAL: 'US-wide',
  GLOBAL: 'Worldwide',
};

/**
 * Dollars per month, per tier.
 *
 * LOCAL is the product. The advertiser base is music-related businesses by
 * charter — venues, studios, instrument shops, labels, festivals — and those
 * are overwhelmingly local: a Portland guitar shop does not want Berlin
 * airtime and should not pay for it. The wider tiers exist for labels and
 * festivals that really do work across cities, not as an upsell.
 *
 * $25 is also the practical floor: Stripe takes 2.9% + $0.30, which is 8.9%
 * of a $5 sponsorship and 4.1% of a $25 one.
 *
 * Deliberately no prepay discount in this first version. A flat rate makes
 * the pro-rata refund on early cancellation exactly `total x unused/term`,
 * which is a sentence a sponsor can check. A term discount is an easy lever
 * later if commitment needs encouraging.
 */
export const SPONSORSHIP_MONTHLY_USD: Record<AdScope, number> = {
  LOCAL: 25,
  REGIONAL: 60,
  NATIONAL: 150,
  GLOBAL: 300,
};

export const SPONSORSHIP_TERMS_MONTHS = [1, 3, 6, 12] as const;
export type SponsorshipTermMonths = (typeof SPONSORSHIP_TERMS_MONTHS)[number];

/** A month of airtime, in days. Keeps `Ad.runDays` and the pause/resume shift honest. */
export const DAYS_PER_SPONSORSHIP_MONTH = 30;

export function isAdScope(value: unknown): value is AdScope {
  return typeof value === 'string' && (AD_SCOPES as string[]).includes(value);
}

export function isSponsorshipTerm(value: unknown): value is SponsorshipTermMonths {
  return typeof value === 'number' && (SPONSORSHIP_TERMS_MONTHS as readonly number[]).includes(value);
}

export type SponsorshipQuote = {
  scope: AdScope;
  months: SponsorshipTermMonths;
  monthlyCents: number;
  totalCents: number;
  /** The run length written to `Ad.runDays` once payment clears. */
  runDays: number;
};

/**
 * The one place a sponsorship price is computed. Called client-side for the
 * live figure and server-side to verify it, because a client-submitted total
 * is never trusted.
 */
export function quoteSponsorship(scope: AdScope, months: SponsorshipTermMonths): SponsorshipQuote {
  const monthlyCents = Math.round(SPONSORSHIP_MONTHLY_USD[scope] * 100);
  return {
    scope,
    months,
    monthlyCents,
    totalCents: monthlyCents * months,
    runDays: months * DAYS_PER_SPONSORSHIP_MONTH,
  };
}
