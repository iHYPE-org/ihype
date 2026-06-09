import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const city = request.nextUrl.searchParams.get('city')?.toLowerCase();
    if (!city) return NextResponse.json({ shows: [] });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const topHyped = await db.hypeEvent.groupBy({
      by: ['showId'],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { showId: true },
      orderBy: { _count: { showId: 'desc' } },
      take: 20,
    });

    if (topHyped.length === 0) return NextResponse.json({ shows: [] });

    const showIds = topHyped.map((h) => h.showId);
    const shows = await db.show.findMany({
      where: {
        id: { in: showIds },
        status: { in: ['SCHEDULED', 'LIVE'] },
        tags: { hasSome: [city] },
      },
      select: { id: true, title: true, hypeCount: true, startsAt: true, slug: true },
      take: 5,
    });

    return NextResponse.json({ shows });
  } catch (err) {
    console.error('[api/trending-local] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
