import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { detectRequestLocation } from '@/lib/request-location';
import { bboxWhere } from '@/lib/map-query';
import { haversineKm } from '@/lib/fan-demand';

export const dynamic = 'force-dynamic';

/**
 * The venues a fan can ask an artist to play — "near them or that they love"
 * (owner, 2026-09-01). Three lists, each real:
 *
 *  - **loved**: venues the fan follows.
 *  - **nearby**: venues within NEARBY_RADIUS_KM of the fan's location — their
 *    own profile location if they gave one, else the request's edge
 *    geolocation — sorted by distance; a city match when there are no
 *    coordinates on either side.
 *  - **matches**: a name search, so a fan can ask for a room in a city they
 *    are visiting.
 *
 * Signed-in only (it reads the caller's follows and location) and never
 * cached: `private, no-store`. Returns venue identity and city only — no
 * addresses, no coordinates — the fan is choosing a room, not mapping it.
 */
const NEARBY_RADIUS_KM = 80;
const VENUE_SELECT = { id: true, slug: true, name: true, city: true, stateRegion: true } as const;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });

  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 80);

  const ownProfile = await db.profile.findFirst({
    where: { ownerId: session.user.id, OR: [{ latitude: { not: null } }, { city: { not: null } }] },
    orderBy: { createdAt: 'asc' },
    select: { city: true, stateRegion: true, latitude: true, longitude: true },
  }).catch(() => null);
  const edge = ownProfile ? null : await detectRequestLocation().catch(() => null);
  const latitude = ownProfile?.latitude ?? edge?.latitude ?? null;
  const longitude = ownProfile?.longitude ?? edge?.longitude ?? null;
  const city = ownProfile?.city ?? edge?.city ?? null;

  const nearbyWhere =
    latitude !== null && longitude !== null
      ? bboxWhere({
          // 1° of latitude is ~111 km everywhere; a degree of longitude shrinks
          // with the cosine of the latitude, so widen it accordingly.
          south: latitude - NEARBY_RADIUS_KM / 111,
          north: latitude + NEARBY_RADIUS_KM / 111,
          west: longitude - NEARBY_RADIUS_KM / (111 * Math.max(0.2, Math.cos((latitude * Math.PI) / 180))),
          east: longitude + NEARBY_RADIUS_KM / (111 * Math.max(0.2, Math.cos((latitude * Math.PI) / 180))),
        })
      : city
        ? { city: { equals: city, mode: 'insensitive' as const } }
        : null;

  const [loved, nearbyRows, matches] = await Promise.all([
    db.follow.findMany({
      where: { followerId: session.user.id, followeeProfile: { type: 'VENUE' } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { followeeProfile: { select: VENUE_SELECT } },
    }).then((rows) => rows.map((row) => row.followeeProfile)).catch(() => []),
    nearbyWhere
      ? db.profile.findMany({
          where: { type: 'VENUE', discoverable: true, ...nearbyWhere },
          take: 40,
          select: { ...VENUE_SELECT, latitude: true, longitude: true },
        }).catch(() => [])
      : Promise.resolve([]),
    q.length >= 2
      ? db.profile.findMany({
          where: { type: 'VENUE', discoverable: true, name: { contains: q, mode: 'insensitive' } },
          orderBy: { hypeCount: 'desc' },
          take: 8,
          select: VENUE_SELECT,
        }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const nearby = nearbyRows
    .map((venue) => ({
      id: venue.id, slug: venue.slug, name: venue.name, city: venue.city, stateRegion: venue.stateRegion,
      distanceKm:
        latitude !== null && longitude !== null && venue.latitude !== null && venue.longitude !== null
          ? Math.round(haversineKm(latitude, longitude, venue.latitude, venue.longitude))
          : null,
    }))
    // The bbox is a square; the radius is a circle. Trim the corners.
    .filter((venue) => venue.distanceKm === null || venue.distanceKm <= NEARBY_RADIUS_KM)
    .sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 10);

  return NextResponse.json(
    { loved, nearby, matches, location: { city } },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
