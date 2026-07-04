// Coverage-tier pricing for the self-serve Ad campaign builder (/advertise).
// Rates match the Advertise.dc.html design spec. Shared between the client
// calculator (src/components/AdvertisePage.tsx) and the server route
// (src/app/api/advertise/campaigns/route.ts), which recomputes the same
// numbers server-side rather than trusting a client-submitted budget.

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

// Dollars per spot per day.
export const AD_SCOPE_RATE_USD: Record<AdScope, number> = {
  LOCAL: 0.15,
  REGIONAL: 0.35,
  NATIONAL: 0.80,
  GLOBAL: 1.50,
};

// Estimated impressions generated per spot per day, by tier.
const AD_SCOPE_IMPRESSIONS_PER_SPOT: Record<AdScope, number> = {
  LOCAL: 800,
  REGIONAL: 3000,
  NATIONAL: 14000,
  GLOBAL: 42000,
};

export const AD_RUN_LENGTHS_DAYS = [7, 14, 30, 90] as const;
export type AdRunLengthDays = (typeof AD_RUN_LENGTHS_DAYS)[number];

export const MIN_SPOTS_PER_DAY = 1;
export const MAX_SPOTS_PER_DAY = 50;

export function isAdScope(value: unknown): value is AdScope {
  return typeof value === 'string' && (AD_SCOPES as string[]).includes(value);
}

export function isAdRunLengthDays(value: unknown): value is AdRunLengthDays {
  return typeof value === 'number' && (AD_RUN_LENGTHS_DAYS as readonly number[]).includes(value);
}

export type AdCampaignQuote = {
  scope: AdScope;
  spotsPerDay: number;
  runDays: number;
  ratePerSpotCents: number;
  dailyCostCents: number;
  totalCostCents: number;
  dailyImpressions: number;
  totalImpressions: number;
  effectiveCpmCents: number;
};

/**
 * Single source of truth for campaign cost/reach math. Called client-side
 * for the live calculator display, and server-side to independently verify
 * the budget a client submits (never trust a client-supplied budgetCents).
 */
export function quoteAdCampaign(scope: AdScope, spotsPerDay: number, runDays: number): AdCampaignQuote {
  const spots = Math.min(MAX_SPOTS_PER_DAY, Math.max(MIN_SPOTS_PER_DAY, Math.round(spotsPerDay)));
  const days = Math.max(1, Math.round(runDays));
  const ratePerSpotCents = Math.round(AD_SCOPE_RATE_USD[scope] * 100);
  const dailyCostCents = ratePerSpotCents * spots;
  const totalCostCents = dailyCostCents * days;
  const dailyImpressions = AD_SCOPE_IMPRESSIONS_PER_SPOT[scope] * spots;
  const totalImpressions = dailyImpressions * days;
  const effectiveCpmCents = totalImpressions > 0 ? Math.round((totalCostCents / totalImpressions) * 1000) : 0;

  return {
    scope,
    spotsPerDay: spots,
    runDays: days,
    ratePerSpotCents,
    dailyCostCents,
    totalCostCents,
    dailyImpressions,
    totalImpressions,
    effectiveCpmCents,
  };
}
