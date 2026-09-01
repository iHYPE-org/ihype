import { db } from '@/lib/db';
import { getProfileInsights } from '@/lib/profile-insights';
import { STAT_CATALOG, type StatKey } from '@/lib/profile-stats-catalog';

// Re-exported for callers that already import the picker types from here —
// but anything that only needs the catalog/role-filtering (in particular
// the client-side PageEditor.tsx picker) should import from
// profile-stats-catalog.ts directly, NOT this file, since this file pulls
// in @/lib/db (Prisma) at module scope and must never reach a client bundle
// or a plain-vitest unit test (same constraint documented on profile-editor-schema.ts).
export { STAT_CATALOG, statOptionsForRole, type StatDef, type StatKey } from '@/lib/profile-stats-catalog';

export type PinnedStatValue = { key: StatKey; label: string; value: number; isPercent: boolean };

const PERCENT_KEYS = new Set<StatKey>(['trackCompletionRate']);

/**
 * Real values only, for the specific stat keys a profile has chosen to pin —
 * never fabricated. Reuses the existing owner-only insight aggregates for
 * creator roles, and a lightweight fan-specific query for LISTENER profiles.
 * Safe to call for a public page render (no session/ownership check here —
 * callers must only pass profile.pinnedStats, which the owner already
 * chose to make public via the page editor).
 */
export async function getPinnedStatValues(
  profileId: string,
  profileType: string,
  keys: readonly string[],
): Promise<PinnedStatValue[]> {
  const validKeys = keys.filter((k): k is StatKey => k in STAT_CATALOG).slice(0, 4);
  if (validKeys.length === 0) return [];

  const needsInsights = validKeys.some((k) =>
    ['hypeTotal', 'followerCount', 'monthlyListeners', 'trackCompletionRate', 'ticketsSold'].includes(k)
  );
  const needsFanStats = validKeys.some((k) => ['showsAttended', 'artistsHyped', 'ticketsBought', 'asksMade', 'asksBooked'].includes(k));

  const [insights, fanStats] = await Promise.all([
    needsInsights ? getProfileInsights(profileId, profileType) : Promise.resolve(null),
    needsFanStats ? getFanStatsForProfile(profileId) : Promise.resolve(null),
  ]);

  const raw: Partial<Record<StatKey, number>> = {
    hypeTotal: insights?.hypeTotal,
    followerCount: insights?.followerCount,
    monthlyListeners: insights?.listeners?.distinctListeners,
    trackCompletionRate: insights?.trackCompletionRate,
    ticketsSold: insights?.ticketsSold,
    showsAttended: fanStats?.showsAttended,
    artistsHyped: fanStats?.artistsHyped,
    ticketsBought: fanStats?.ticketsBought,
    asksMade: fanStats?.asksMade,
    asksBooked: fanStats?.asksBooked,
  };

  return validKeys
    .filter((key) => typeof raw[key] === 'number')
    .map((key) => ({
      key,
      label: STAT_CATALOG[key].label,
      value: raw[key] as number,
      isPercent: PERCENT_KEYS.has(key),
    }));
}

async function getFanStatsForProfile(profileId: string) {
  const profile = await db.profile.findUnique({ where: { id: profileId }, select: { ownerId: true } });
  if (!profile) return { showsAttended: 0, artistsHyped: 0, ticketsBought: 0, asksMade: 0, asksBooked: 0 };

  const userId = profile.ownerId;
  const [hypeGivenShows, hypeGivenProfiles, ticketOrders, asksMade, asksBooked] = await Promise.all([
    db.hypeEvent.count({ where: { userId } }),
    db.profileHypeEvent.count({ where: { userId } }),
    db.ticketOrder.aggregate({
      where: { buyerUserId: userId, status: 'CAPTURED' },
      _sum: { quantity: true },
      _count: { id: true },
    }),
    db.venueConnectionRequest.count({ where: { requesterId: userId } }),
    db.venueConnectionRequest.count({ where: { requesterId: userId, status: 'BOOKED' } }),
  ]);

  return {
    showsAttended: ticketOrders._count.id,
    artistsHyped: hypeGivenShows + hypeGivenProfiles,
    ticketsBought: ticketOrders._sum.quantity ?? 0,
    asksMade,
    asksBooked,
  };
}
