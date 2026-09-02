import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client/edge';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { coarsenFanCoordinates, isPublicVenueCoordinate } from '@/lib/public-location';
import { areMapsEnabledRuntime } from '@/lib/runtime-flags';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!(await areMapsEnabledRuntime())) {
      return NextResponse.json({ error: 'Map lookups are temporarily paused.', code: 'MAPS_PAUSED' }, { status: 503, headers: { 'Retry-After': '300' } });
    }
    // Same budget as /api/search: an unauthenticated Haversine + ILIKE query
    // whose CDN key includes the coordinates, so a random `lat` per request
    // defeated the cache (second security scan, 2026-09-02).
    const rl = await consumeRateLimit(`shows-nearby:${readClientAddress(request)}`, { limit: 60, windowMs: 60 * 1000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    const { searchParams } = new URL(request.url);
    const requestedLat = parseFloat(searchParams.get('lat') ?? '');
    const requestedLng = parseFloat(searchParams.get('lng') ?? '');
    const approximateLocation = coarsenFanCoordinates(requestedLat, requestedLng);
    const radiusParam = parseFloat(searchParams.get('radius') ?? '50');
    // Postgres treats NaN as greater than every number, so an unclamped or
    // non-finite radius would match all shows.
    const radiusKm = Number.isFinite(radiusParam) ? Math.min(Math.max(radiusParam, 1), 500) : 50;
    const query = (searchParams.get('q') ?? '').trim().slice(0, 80);
    const filter = searchParams.get('filter') ?? 'tonight';
    const genre = (searchParams.get('genre') ?? '').trim().slice(0, 40);
    const date = searchParams.get('date') ?? '';
    const hypeOnly = searchParams.get('hypeOnly') === '1';
    const session = hypeOnly ? await auth().catch(() => null) : null;
    const hypedProfileIds = hypeOnly && session?.user?.id
      ? (await db.profileHypeEvent.findMany({ where: { userId: session.user.id }, take: 500, select: { profileId: true } })).map((hype) => hype.profileId)
      : [];

    // Results only change as shows are created/updated — let the CDN absorb
    // repeat lookups for the same coordinates.
    const cacheHeaders = { 'Cache-Control': hypeOnly ? 'private, no-store' : 'public, s-maxage=60, stale-while-revalidate=300' };

    if (!approximateLocation) {
      // Fall back to recently added shows
      const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
      const shows = await db.show.findMany({
        where: {
          status: 'SCHEDULED',
          startsAt: selectedDate ? { gte: selectedDate, lt: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000) } : { gte: new Date() },
          AND: [
            ...(query ? [{ OR: [{ title: { contains: query, mode: 'insensitive' as const } }, { venueProfile: { name: { contains: query, mode: 'insensitive' as const } } }, { headlinerProfile: { name: { contains: query, mode: 'insensitive' as const } } }] }] : []),
            ...(genre ? [{ OR: [{ tags: { has: genre } }, { headlinerProfile: { genres: { has: genre } } }] }] : []),
          ],
          ...(filter === 'tour' ? { headlinerProfileId: { not: null } } : {}),
          ...(hypeOnly ? { headlinerProfileId: { in: hypedProfileIds } } : {}),
        },
        orderBy: [{ hypeCount: 'desc' }, { startsAt: 'asc' }],
        take: 10,
        select: { id: true, slug: true, title: true, startsAt: true, hypeCount: true, venueProfile: { select: { type: true, discoverable: true, name: true, slug: true, city: true, stateRegion: true, latitude: true, longitude: true } } }
      });
      return NextResponse.json({
        shows: shows.map(({ venueProfile, ...show }) => ({
          ...show,
          venueName: venueProfile?.name ?? null,
          venueCity: venueProfile?.city ?? null,
          venueSlug: venueProfile?.slug ?? null,
          latitude: venueProfile && isPublicVenueCoordinate(venueProfile) ? venueProfile.latitude : null,
          longitude: venueProfile && isPublicVenueCoordinate(venueProfile) ? venueProfile.longitude : null,
          locationPrecision: venueProfile && isPublicVenueCoordinate(venueProfile) ? 'exact-venue' : 'none',
        })),
      }, { headers: cacheHeaders });
    }

    const { latitude: lat, longitude: lng } = approximateLocation;

    // Cheap bounding box so the (latitude, longitude) index prunes rows
    // before the per-row Haversine trig runs. 1° latitude ≈ 111.32 km;
    // longitude degrees shrink by cos(lat), clamped so polar latitudes
    // don't divide by ~0 (the box just degrades to a full longitude span).
    const latDelta = radiusKm / 111.32;
    const lngDelta = radiusKm / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));

    const conditions: Prisma.Sql[] = [
      Prisma.sql`s.status = 'SCHEDULED'`,
      Prisma.sql`s."moderationStatus" = 'APPROVED'`,
      Prisma.sql`s."startsAt" >= NOW()`,
      Prisma.sql`p.latitude IS NOT NULL`,
      Prisma.sql`p.longitude IS NOT NULL`,
      Prisma.sql`p.type = 'VENUE'`,
      Prisma.sql`p.discoverable = TRUE`,
      Prisma.sql`p.latitude BETWEEN ${lat - latDelta} AND ${lat + latDelta}`,
      Prisma.sql`p.longitude BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}`,
      Prisma.sql`(6371 * acos(LEAST(1, GREATEST(-1, cos(radians(${lat})) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(${lng})) + sin(radians(${lat})) * sin(radians(p.latitude)))))) <= ${radiusKm}`,
    ];
    if (query) {
      const pattern = `%${query}%`;
      conditions.push(Prisma.sql`(s.title ILIKE ${pattern} OR p.name ILIKE ${pattern} OR hp.name ILIKE ${pattern} OR p.city ILIKE ${pattern})`);
    }
    if (genre) conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM unnest(COALESCE(s.tags, ARRAY[]::text[]) || COALESCE(hp.genres, ARRAY[]::text[])) AS tag WHERE LOWER(tag) = LOWER(${genre}))`);
    if (filter === 'tour') conditions.push(Prisma.sql`s."headlinerProfileId" IS NOT NULL`);
    if (filter === 'tonight') conditions.push(Prisma.sql`s."startsAt" < NOW() + INTERVAL '24 hours'`);
    if (filter === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      conditions.push(Prisma.sql`s."startsAt" >= ${start} AND s."startsAt" < ${end}`);
    }
    if (hypeOnly) {
      conditions.push(hypedProfileIds.length ? Prisma.sql`s."headlinerProfileId" IN (${Prisma.join(hypedProfileIds)})` : Prisma.sql`FALSE`);
    }

    // Use Haversine via raw query for proximity
    const shows = await db.$queryRaw<Array<{ id: string; slug: string; title: string; startsAt: Date; hypeCount: number; venueName: string | null; venueCity: string | null; venueSlug: string | null; latitude: number; longitude: number }>>(Prisma.sql`
      SELECT s.id, s.slug, s.title, s."startsAt", s."hypeCount",
             p.name as "venueName", p.city as "venueCity", p.slug as "venueSlug",
             p.latitude, p.longitude
      FROM "Show" s
      LEFT JOIN "Profile" p ON s."venueProfileId" = p.id
      LEFT JOIN "Profile" hp ON s."headlinerProfileId" = hp.id
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY s."hypeCount" DESC, s."startsAt" ASC
      LIMIT 20
    `);

    return NextResponse.json({
      shows: shows.map((show) => ({ ...show, locationPrecision: 'exact-venue' })),
    }, { headers: cacheHeaders });
  } catch (err) {
    log.error('[api/shows/nearby]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
