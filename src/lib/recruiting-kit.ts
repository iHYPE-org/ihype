import { db } from '@/lib/db';
import { getDemoOwnerExclusion } from '@/lib/runtime-flags';
import type { ProfileType } from '@prisma/client/edge';

/** Real top-cities-by-hype for a profile type, used by the recruiting kit pages' "where demand is hottest" bars — never fabricated. */
export async function getCityHeatForRole(types: ProfileType[], take = 3): Promise<{ label: string; score: number }[]> {
  const rows = await db.profile.groupBy({
    by: ['city'],
    where: { type: { in: types }, discoverable: true, city: { not: null }, ...getDemoOwnerExclusion() },
    _sum: { hypeCount: true },
    orderBy: { _sum: { hypeCount: 'desc' } },
    take,
  });
  return rows
    .filter((r) => r.city)
    .map((r) => ({ label: r.city as string, score: r._sum.hypeCount ?? 0 }))
    .filter((r) => r.score > 0);
}
