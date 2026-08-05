import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { clusterPoints } from '@/lib/map-bbox';
import { MAP_CACHE_HEADERS, bboxWhere, isMapRequestFailure, parseMapRequest } from '@/lib/map-query';
import { isPublicVenueCoordinate } from '@/lib/public-location';
import { areMapsEnabledRuntime } from '@/lib/runtime-flags';
import type { MapCluster } from '@/app/api/map/events/route';

export const dynamic = 'force-dynamic';

export type MapVenuePin = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  addressLine1: string | null;
  latitude: number;
  longitude: number;
  capacity: number | null;
  upcomingCount: number;
  genres: string[];
  verified: boolean;
};

/**
 * Venues inside a bounding box, for the Map module's venue layer.
 *
 * Venues are the one profile type that may publish an exact coordinate, and
 * only while `discoverable` — both conditions are checked by
 * `isPublicVenueCoordinate` rather than re-implemented here.
 */
export async function GET(request: Request) {
  try {
    if (!(await areMapsEnabledRuntime())) {
      return NextResponse.json(
        { error: 'Map lookups are temporarily paused.', code: 'MAPS_PAUSED' },
        { status: 503, headers: { 'Retry-After': '300' } },
      );
    }
    const parsed = parseMapRequest(request.url);
    if (isMapRequestFailure(parsed)) return parsed.error;
    const { queryBbox, genre, clustered, cellDegrees, limit } = parsed;

    const venues = await db.profile.findMany({
      where: {
        type: 'VENUE',
        discoverable: true,
        ...bboxWhere(queryBbox),
        ...(genre ? { genres: { has: genre } } : {}),
      },
      orderBy: [{ hypeCount: 'desc' }, { name: 'asc' }],
      take: limit,
      select: {
        id: true, slug: true, name: true, city: true, addressLine1: true,
        latitude: true, longitude: true, capacity: true, genres: true,
        isVerified: true, verified: true, type: true, discoverable: true,
        _count: { select: { hostedShows: true } },
      },
    });

    const pins: MapVenuePin[] = venues
      .filter(isPublicVenueCoordinate)
      .map((venue) => ({
        id: venue.id,
        slug: venue.slug,
        name: venue.name,
        city: venue.city,
        addressLine1: venue.addressLine1,
        latitude: venue.latitude!,
        longitude: venue.longitude!,
        capacity: venue.capacity,
        upcomingCount: venue._count.hostedShows,
        genres: venue.genres.slice(0, 3),
        verified: venue.isVerified || venue.verified,
      }));

    if (clustered) {
      const clusters: MapCluster[] = clusterPoints(pins, cellDegrees).map((cluster) => ({
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        count: cluster.count,
        label: cluster.sample.city ?? cluster.sample.name,
      }));
      return NextResponse.json({ layer: 'venues', clustered: true, clusters, total: pins.length }, { headers: MAP_CACHE_HEADERS });
    }

    return NextResponse.json(
      { layer: 'venues', clustered: false, pins, total: pins.length, capped: venues.length >= limit },
      { headers: MAP_CACHE_HEADERS },
    );
  } catch (error) {
    log.error('[api/map/venues]', error instanceof Error ? error : { error: String(error) }, 'error');
    return NextResponse.json({ error: 'Map data is temporarily unavailable.' }, { status: 500 });
  }
}
