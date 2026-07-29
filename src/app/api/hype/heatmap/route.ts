import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const ip = readClientAddress(request);
    const rl = await consumeRateLimit(`hype-heatmap:ip:${ip}`, { limit: 60, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests.' },
        { status: 429, headers: rateLimitHeaders(rl) }
      );
    }

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
      LIMIT 20
    `;

    const cities = rows.map((row, i) => ({
      city: row.city,
      count: Number(row.count),
      rank: i + 1,
    }));

    return NextResponse.json(
      { cities },
      {
        headers: {
          'Cache-Control': 'public, max-age=300',
        },
      },
    );
  } catch (err) {
    log.error('[api/hype/heatmap]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
