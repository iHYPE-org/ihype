import { db } from '@/lib/db';

export interface HeatmapCity {
  city: string;
  count: number;
  rank: number;
}

/** Real top HYPE-activity cities over the last 30 days, ranked by ProfileHypeEvent count. */
export async function getHypeHeatmap(limit = 20): Promise<HeatmapCity[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Grouped in Postgres (Prisma groupBy can't group on a relation field)
  // instead of pulling every hype event of the last 30 days into Node.
  const rows = await db.$queryRaw<{ city: string; count: bigint }[]>`
    SELECT p."city" AS city, COUNT(*)::bigint AS count
    FROM "ProfileHypeEvent" e
    JOIN "Profile" p ON p."id" = e."profileId"
    WHERE e."createdAt" >= ${since} AND p."city" IS NOT NULL AND trim(p."city") <> ''
    GROUP BY p."city"
    ORDER BY count DESC
    LIMIT ${limit}
  `;

  return rows.map((row, i) => ({ city: row.city, count: Number(row.count), rank: i + 1 }));
}
