import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') ?? '');
    const lng = parseFloat(searchParams.get('lng') ?? '');
    const radiusParam = parseFloat(searchParams.get('radius') ?? '50');
    // Postgres treats NaN as greater than every number, so an unclamped or
    // non-finite radius would match all shows.
    const radiusKm = Number.isFinite(radiusParam) ? Math.min(Math.max(radiusParam, 1), 500) : 50;

    // Results only change as shows are created/updated — let the CDN absorb
    // repeat lookups for the same coordinates.
    const cacheHeaders = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' };

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      // Fall back to recently added shows
      const shows = await db.show.findMany({
        where: { status: 'SCHEDULED', startsAt: { gte: new Date() } },
        orderBy: [{ hypeCount: 'desc' }, { startsAt: 'asc' }],
        take: 10,
        select: { id: true, slug: true, title: true, startsAt: true, hypeCount: true, venueProfile: { select: { name: true, city: true, stateRegion: true } } }
      });
      return NextResponse.json({ shows }, { headers: cacheHeaders });
    }

    // Cheap bounding box so the (latitude, longitude) index prunes rows
    // before the per-row Haversine trig runs. 1° latitude ≈ 111.32 km;
    // longitude degrees shrink by cos(lat), clamped so polar latitudes
    // don't divide by ~0 (the box just degrades to a full longitude span).
    const latDelta = radiusKm / 111.32;
    const lngDelta = radiusKm / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));

    // Use Haversine via raw query for proximity
    const shows = await db.$queryRaw<Array<{ id: string; slug: string; title: string; startsAt: Date; hypeCount: number; venueName: string | null; venueCity: string | null }>>`
      SELECT s.id, s.slug, s.title, s."startsAt", s."hypeCount",
             p.name as "venueName", p.city as "venueCity"
      FROM "Show" s
      LEFT JOIN "Profile" p ON s."venueProfileId" = p.id
      WHERE s.status = 'SCHEDULED'
        AND s."startsAt" >= NOW()
        AND p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
        AND p.latitude BETWEEN ${lat - latDelta} AND ${lat + latDelta}
        AND p.longitude BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
        AND (
          6371 * acos(
            cos(radians(${lat})) * cos(radians(p.latitude)) *
            cos(radians(p.longitude) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(p.latitude))
          )
        ) <= ${radiusKm}
      ORDER BY s."hypeCount" DESC, s."startsAt" ASC
      LIMIT 20
    `;

    return NextResponse.json({ shows }, { headers: cacheHeaders });
  } catch (err) {
    console.error('[api/shows/nearby] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
