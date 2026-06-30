import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

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

    const events = await db.profileHypeEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { profile: { select: { city: true } } },
    });

    // Aggregate by city in JS since Prisma groupBy doesn't support relation fields
    const counts = new Map<string, number>();
    for (const e of events) {
      const city = e.profile?.city?.trim();
      if (!city) continue;
      counts.set(city, (counts.get(city) ?? 0) + 1);
    }

    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    const cities = sorted.map(([city, count], i) => ({
      city,
      count,
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
    console.error('[api/hype/heatmap] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
