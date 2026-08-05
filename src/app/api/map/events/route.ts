import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { clusterPoints, isHotEvent } from '@/lib/map-bbox';
import { MAP_CACHE_HEADERS, bboxWhere, isMapRequestFailure, parseMapRequest } from '@/lib/map-query';
import { isPublicVenueCoordinate } from '@/lib/public-location';
import { areMapsEnabledRuntime } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

export type MapEventPin = {
  id: string;
  slug: string;
  title: string;
  venueName: string | null;
  venueSlug: string | null;
  venueCity: string | null;
  startsAt: string;
  latitude: number;
  longitude: number;
  /** Face value in whole dollars — the pin IS the price pill. A show that is
   *  not ticketed through iHYPE has no face value, and the pill reads "Free"
   *  rather than "$0", which would look like a bug. */
  price: number | null;
  isTicketed: boolean;
  sold: number;
  capacity: number;
  hot: boolean;
  genre: string | null;
};

export type MapCluster = {
  latitude: number;
  longitude: number;
  count: number;
  label: string;
};

/**
 * Events inside a bounding box, for the Map module's event layer.
 *
 * A show has no coordinates of its own — it borrows its venue's, which is why
 * every row here goes through `isPublicVenueCoordinate`. That is the single
 * place iHYPE's location boundary is decided (venues may publish an exact
 * location when discoverable; artists and fans never do), and a show at a
 * non-discoverable venue therefore has no pin rather than a coarse one.
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

    const shows = await db.show.findMany({
      where: {
        status: 'SCHEDULED',
        moderationStatus: 'APPROVED',
        startsAt: { gte: new Date() },
        venueProfile: { is: { type: 'VENUE', discoverable: true, ...bboxWhere(queryBbox) } },
        ...(genre
          ? { OR: [{ tags: { has: genre } }, { headlinerProfile: { is: { genres: { has: genre } } } }] }
          : {}),
      },
      // Hype-first so that when the cap bites it drops the least-wanted shows,
      // not an arbitrary page of them.
      orderBy: [{ hypeCount: 'desc' }, { startsAt: 'asc' }],
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        startsAt: true,
        isTicketed: true,
        ticketPriceCents: true,
        ticketCapacity: true,
        ticketsSoldCount: true,
        tags: true,
        venueProfile: {
          select: {
            type: true, discoverable: true, name: true, slug: true, city: true,
            latitude: true, longitude: true,
          },
        },
      },
    });

    const pins: MapEventPin[] = [];
    for (const show of shows) {
      const venue = show.venueProfile;
      if (!venue || !isPublicVenueCoordinate(venue)) continue;
      const capacity = show.ticketCapacity ?? 0;
      const sold = show.ticketsSoldCount;
      pins.push({
        id: show.id,
        slug: show.slug,
        title: show.title,
        venueName: venue.name,
        venueSlug: venue.slug,
        venueCity: venue.city,
        startsAt: show.startsAt.toISOString(),
        latitude: venue.latitude!,
        longitude: venue.longitude!,
        price: show.isTicketed && show.ticketPriceCents > 0 ? Math.round(show.ticketPriceCents / 100) : null,
        isTicketed: show.isTicketed,
        sold,
        capacity,
        hot: isHotEvent(sold, capacity),
        genre: show.tags[0] ?? null,
      });
    }

    if (clustered) {
      const clusters: MapCluster[] = clusterPoints(pins, cellDegrees).map((cluster) => ({
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        count: cluster.count,
        label: cluster.sample.venueCity ?? cluster.sample.venueName ?? 'Shows',
      }));
      return NextResponse.json({ layer: 'events', clustered: true, clusters, total: pins.length }, { headers: MAP_CACHE_HEADERS });
    }

    return NextResponse.json(
      { layer: 'events', clustered: false, pins, total: pins.length, capped: shows.length >= limit },
      { headers: MAP_CACHE_HEADERS },
    );
  } catch (error) {
    log.error('[api/map/events]', error instanceof Error ? error : { error: String(error) }, 'error');
    return NextResponse.json({ error: 'Map data is temporarily unavailable.' }, { status: 500 });
  }
}
