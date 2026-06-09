import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') ?? '');
    const lng = parseFloat(searchParams.get('lng') ?? '');
    const radiusKm = parseFloat(searchParams.get('radius') ?? '50');

    if (isNaN(lat) || isNaN(lng)) {
      // Fall back to recently added shows
      const shows = await db.show.findMany({
        where: { status: 'SCHEDULED', startsAt: { gte: new Date() } },
        orderBy: [{ hypeCount: 'desc' }, { startsAt: 'asc' }],
        take: 10,
        select: { id: true, slug: true, title: true, startsAt: true, hypeCount: true, venueProfile: { select: { name: true, city: true, stateRegion: true } } }
      });
      return NextResponse.json({ shows });
    }

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

    return NextResponse.json({ shows });
  } catch (err) {
    console.error('[api/shows/nearby] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
