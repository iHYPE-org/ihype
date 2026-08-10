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

    // The MAP date strip. `dates` is a comma-separated list of YYYY-MM-DD, and
    // it is a SET of days rather than a span — Friday and Sunday with nothing
    // between them is a legal selection, which is what anyone planning a
    // weekend actually wants. Design System 8's map document is explicit about
    // that, and about the consequence: a venue with nothing booked on the
    // chosen days drops OFF the map rather than sitting there as a dead pin.
    //
    // Each day becomes a half-open [00:00, next 00:00) window in the SERVER's
    // zone. That is the same approximation the rest of the product makes about
    // "a night" and it is worth naming: a member in another timezone asking for
    // Friday gets Friday where the show is, which is the one they mean.
    // Absent or unparseable = no date filter at all, i.e. the previous
    // behaviour, so an old client keeps working.
    const dateParam = new URL(request.url).searchParams.get('dates');
    const days = (dateParam ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
      .slice(0, 31);
    const dayWindows = days
      .map((day) => {
        const from = new Date(`${day}T00:00:00`);
        if (Number.isNaN(from.getTime())) return null;
        const to = new Date(from.getTime() + 86_400_000);
        return { startsAt: { gte: from, lt: to } };
      })
      .filter((window): window is { startsAt: { gte: Date; lt: Date } } => window !== null);

    const shows = await db.show.findMany({
      where: {
        status: 'SCHEDULED',
        moderationStatus: 'APPROVED',
        // Past days are never returned even when explicitly asked for: the strip
        // only offers future days, so a past date in the query is a stale client
        // or a hand-edited URL, not a request to browse history.
        startsAt: { gte: new Date() },
        // AND, not a second top-level OR: `genre` below already uses `OR`, and
        // in an object literal the later spread would silently replace this one
        // — a genre-filtered map would quietly ignore the date strip.
        ...(dayWindows.length ? { AND: [{ OR: dayWindows }] } : {}),
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
