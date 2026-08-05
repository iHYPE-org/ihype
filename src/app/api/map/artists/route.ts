import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { MAP_CACHE_HEADERS, bboxWhere, isMapRequestFailure, parseMapRequest } from '@/lib/map-query';
import { areMapsEnabledRuntime } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

export type MapArtistCity = {
  /** `city, stateRegion` — the key the artists were grouped on. */
  city: string;
  latitude: number;
  longitude: number;
  count: number;
  /** Up to five artists in that city, hype-ranked, for the sheet's list. */
  artists: Array<{ id: string; slug: string; name: string; genres: string[]; hypeCount: number; verified: boolean }>;
};

/**
 * Artists inside a bounding box, **aggregated by city** — which
 * `BACKEND_REWRITE.md` §5 specifies (`GET /v1/map/artists → artists aggregated
 * by city`) and which this codebase's location boundary requires anyway.
 *
 * An artist has no usable coordinate here, by design and not by omission:
 * `sanitizeStoredProfileLocation` nulls `latitude`/`longitude` for every
 * non-VENUE profile on write, and `sanitizePublicLocation` strips them again on
 * read. Artists keep only a self-authored broad label (`city`/`stateRegion`).
 *
 * So the city's position is borrowed from the **venues** in it, whose exact
 * coordinates are already public when discoverable. That means:
 *   - the pin can never be more precise than "a venue in this city", which is
 *     the precision the artist actually consented to publish; and
 *   - a city with no discoverable venue yields no artist bubble at all. That is
 *     a real gap rather than a hidden one — it is reported as `unplacedCount`
 *     so the caller can say so instead of quietly showing fewer artists.
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
    const { queryBbox, genre, limit } = parsed;

    // The city anchors come first: they bound which cities can be shown at all,
    // so there is no point loading artists from a city we cannot place.
    const venues = await db.profile.findMany({
      where: { type: 'VENUE', discoverable: true, ...bboxWhere(queryBbox) },
      take: 400,
      select: { city: true, stateRegion: true, latitude: true, longitude: true },
    });

    const anchors = new Map<string, { latSum: number; lngSum: number; count: number }>();
    for (const venue of venues) {
      if (!venue.city || venue.latitude === null || venue.longitude === null) continue;
      if (!Number.isFinite(venue.latitude) || !Number.isFinite(venue.longitude)) continue;
      const key = cityKey(venue.city, venue.stateRegion);
      const anchor = anchors.get(key);
      if (anchor) {
        anchor.latSum += venue.latitude;
        anchor.lngSum += venue.longitude;
        anchor.count += 1;
      } else {
        anchors.set(key, { latSum: venue.latitude, lngSum: venue.longitude, count: 1 });
      }
    }

    if (anchors.size === 0) {
      return NextResponse.json(
        { layer: 'artists', clustered: true, cities: [], total: 0, unplacedCount: 0 },
        { headers: MAP_CACHE_HEADERS },
      );
    }

    const artists = await db.profile.findMany({
      where: {
        type: 'ARTIST',
        discoverable: true,
        city: { not: null },
        ...(genre ? { genres: { has: genre } } : {}),
      },
      orderBy: [{ hypeCount: 'desc' }, { name: 'asc' }],
      take: limit,
      select: {
        id: true, slug: true, name: true, city: true, stateRegion: true,
        genres: true, hypeCount: true, isVerified: true, verified: true,
      },
    });

    const grouped = new Map<string, MapArtistCity>();
    let unplacedCount = 0;
    for (const artist of artists) {
      const key = cityKey(artist.city!, artist.stateRegion);
      const anchor = anchors.get(key);
      if (!anchor) {
        unplacedCount += 1;
        continue;
      }
      const existing = grouped.get(key);
      const entry = {
        id: artist.id,
        slug: artist.slug,
        name: artist.name,
        genres: artist.genres.slice(0, 3),
        hypeCount: artist.hypeCount,
        verified: artist.isVerified || artist.verified,
      };
      if (existing) {
        existing.count += 1;
        if (existing.artists.length < 5) existing.artists.push(entry);
      } else {
        grouped.set(key, {
          city: key,
          latitude: anchor.latSum / anchor.count,
          longitude: anchor.lngSum / anchor.count,
          count: 1,
          artists: [entry],
        });
      }
    }

    const cities = [...grouped.values()];
    return NextResponse.json(
      {
        layer: 'artists',
        // Always aggregated — there is no per-artist coordinate to un-aggregate
        // to, at any zoom.
        clustered: true,
        cities,
        total: cities.reduce((sum, city) => sum + city.count, 0),
        unplacedCount,
      },
      { headers: MAP_CACHE_HEADERS },
    );
  } catch (error) {
    log.error('[api/map/artists]', error instanceof Error ? error : { error: String(error) }, 'error');
    return NextResponse.json({ error: 'Map data is temporarily unavailable.' }, { status: 500 });
  }
}

function cityKey(city: string, stateRegion: string | null): string {
  return [city.trim(), stateRegion?.trim()].filter(Boolean).join(', ');
}
