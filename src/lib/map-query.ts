/**
 * Shared request handling for the three `/api/map/*` endpoints.
 *
 * `BACKEND_REWRITE.md` §5 makes the map a first-class module and gives it
 * three rules that all three endpoints must obey identically: bbox required,
 * server-side clustering above county zoom, and a hard row cap. Putting the
 * request parsing here means one of them cannot quietly drift from the others.
 */

import { NextResponse } from 'next/server';
import {
  type Bbox,
  MAP_ROW_LIMIT,
  bboxCrossesAntimeridian,
  clusterCellDegrees,
  padBbox,
  parseBbox,
  parseZoom,
  shouldClusterServerSide,
} from '@/lib/map-bbox';

export type MapRequest = {
  bbox: Bbox;
  /** The bbox widened slightly, which is what the query should actually use. */
  queryBbox: Bbox;
  zoom: number;
  genre: string;
  clustered: boolean;
  cellDegrees: number;
  limit: number;
};

export type MapRequestFailure = { error: NextResponse };

/**
 * A map read is public and cacheable — the same bbox from many viewers wants
 * the same answer, and none of it is per-user. Short s-maxage because a show
 * selling out flips its pin to hot.
 */
export const MAP_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
} as const;

export function parseMapRequest(url: string): MapRequest | MapRequestFailure {
  const { searchParams } = new URL(url);
  const bbox = parseBbox(searchParams.get('bbox'));
  if (!bbox) {
    return {
      error: NextResponse.json({
        error: 'A bbox=west,south,east,north query parameter is required.',
        code: 'BBOX_REQUIRED',
      }, { status: 400 }),
    };
  }
  const zoom = parseZoom(searchParams.get('zoom'));
  const genre = (searchParams.get('genre') ?? '').trim().slice(0, 40);
  return {
    bbox,
    queryBbox: padBbox(bbox),
    zoom,
    genre: genre.toLowerCase() === 'all' ? '' : genre,
    clustered: shouldClusterServerSide(zoom),
    cellDegrees: clusterCellDegrees(zoom),
    limit: MAP_ROW_LIMIT,
  };
}

export function isMapRequestFailure(value: MapRequest | MapRequestFailure): value is MapRequestFailure {
  return 'error' in value;
}

/**
 * Latitude/longitude predicate for a Prisma `where`. An antimeridian-crossing
 * box needs an OR across the two halves — a single BETWEEN would match the
 * whole world *except* the intended strip, silently returning everything.
 */
export function bboxWhere(bbox: Bbox) {
  const latitude = { gte: bbox.south, lte: bbox.north };
  if (!bboxCrossesAntimeridian(bbox)) {
    return { latitude, longitude: { gte: bbox.west, lte: bbox.east } };
  }
  return {
    latitude,
    OR: [
      { longitude: { gte: bbox.west, lte: 180 } },
      { longitude: { gte: -180, lte: bbox.east } },
    ],
  };
}
