import { db } from '@/lib/db';
import { SCOPE_ORDER, allocateScopeSlots } from '@/lib/ad-scope-mix';
import { buildAutoAdBreak, type AdvertisingScope, type ShowAdClip } from '@/lib/show-composer';

// Server-only (imports @/lib/db) — never import this from a client component.
// Two resolvers: `resolveAdBreakClips` for a show's own configured scope, and
// `resolveWeightedAdBreakClips` for the always-on station, which mixes all
// four. There is no DJ ad-break picker any more; show creation is gone.

const SCOPE_TO_DB: Record<AdvertisingScope, string> = {
  local: 'LOCAL',
  regional: 'REGIONAL',
  national: 'NATIONAL',
  global: 'GLOBAL',
};

type ScopedAd = {
  id: string;
  title: string;
  audioUrl: string | null;
  audioDurationSecs: number | null;
  budgetCents: number;
  spentCents: number;
};

/**
 * Every APPROVED, in-flight, budget-remaining spot for one scope, fewest
 * impressions first so delivery spreads across campaigns rather than pinning
 * to whichever was created first.
 *
 * Prisma cannot compare two columns (`spentCents < budgetCents`) in a WHERE
 * without raw SQL, so a batch is fetched and exhausted rows are dropped in JS.
 * Shared by both resolvers below — eligibility is one definition, or the
 * single-scope and weighted paths would disagree about what is airable.
 */
async function viableAdsForScope(scope: AdvertisingScope): Promise<ScopedAd[]> {
  const now = new Date();
  const candidates = await db.ad.findMany({
    where: {
      status: 'APPROVED',
      scope: SCOPE_TO_DB[scope] ?? SCOPE_TO_DB.local,
      audioUrl: { not: null },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: { impressions: 'asc' },
    take: 20,
    select: { id: true, title: true, audioUrl: true, audioDurationSecs: true, budgetCents: true, spentCents: true },
  });
  return candidates.filter((ad) => ad.budgetCents === 0 || ad.spentCents < ad.budgetCents);
}

function toClip(ad: ScopedAd, scope: AdvertisingScope): ShowAdClip {
  return {
    clipId: `mkt_${ad.id}`,
    title: ad.title,
    url: ad.audioUrl as string,
    scope,
    mimeType: 'audio/mpeg',
    durationSeconds: ad.audioDurationSecs ?? undefined,
    notes: 'Marketplace ad — purchased via the Coverage Builder.',
  };
}

/**
 * Real, purchased spots for ONE scope — a show's configured reach — falling
 * back to the placeholder catalogue when that scope has no inventory. This is
 * a filter, not a mixture; for the station's weighted blend see
 * `resolveWeightedAdBreakClips`.
 */
export async function resolveAdBreakClips(scope: AdvertisingScope, targetSeconds = 90): Promise<ShowAdClip[]> {
  const viable = await viableAdsForScope(scope);
  if (viable.length) return viable.slice(0, 4).map((ad) => toClip(ad, scope));
  return buildAutoAdBreak(scope, targetSeconds);
}

/**
 * A break drawn across ALL FOUR scopes, weighted local-most to global-least.
 *
 * This is what the always-on station airs. `resolveAdBreakClips` above takes a
 * single scope and is a filter; a break is a mixture, and asking it for
 * `'national'` — which the station did — meant a local advertiser's spot could
 * never air at all, on the cheapest tier and the one a venue down the road is
 * most likely to buy.
 *
 * The weighting lives in `ad-scope-mix.ts` and is unit-tested there. This
 * function is the IO around it: one query per scope, then fill the allocation.
 *
 * **Known limit, stated rather than hidden:** the station is a single rotation
 * positioned off the wall clock, shared by every listener, and it carries no
 * geography. So "local" here means the platform's own market, not the
 * individual listener's — everyone hears the same local spots. Per-listener
 * targeting needs either per-region rotations or ad breaks resolved after the
 * clock position, because varying break lengths per listener would desync the
 * shared position that makes it one station. Selling a 'local' spot on a
 * single-city platform is honest today; it stops being honest the moment a
 * second market exists.
 *
 * Falls back to the placeholder catalogue only when NO scope has real
 * inventory — the same fail-soft as the single-scope path, for the same
 * reason: an unmonetised station is not a safe default when advertising is the
 * platform's only revenue.
 */
export async function resolveWeightedAdBreakClips(slots = 4, targetSeconds = 90): Promise<ShowAdClip[]> {
  const perScope = await Promise.all(
    SCOPE_ORDER.map(async (scope) => [scope, await viableAdsForScope(scope)] as const),
  );
  const pools = Object.fromEntries(perScope) as Record<AdvertisingScope, ScopedAd[]>;
  const available = Object.fromEntries(
    SCOPE_ORDER.map((scope) => [scope, pools[scope].length]),
  ) as Record<AdvertisingScope, number>;

  const allocation = allocateScopeSlots(slots, available);
  const picked: ShowAdClip[] = [];
  // Most local first, so a short break that gets truncated downstream keeps
  // the spots the weighting says matter most.
  for (const scope of SCOPE_ORDER) {
    for (const ad of pools[scope].slice(0, allocation[scope])) {
      picked.push(toClip(ad, scope));
    }
  }

  return picked.length ? picked : buildAutoAdBreak('local', targetSeconds);
}
