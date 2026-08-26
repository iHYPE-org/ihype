import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { releasedMediaWhere } from '@/lib/media-release';
import type { Prisma } from '@prisma/client/edge';

export const dynamic = 'force-dynamic';

const PALETTE = ['var(--accent)', 'var(--role-fan)', 'var(--role-venue)', 'var(--accent-2)', 'var(--warning)', 'var(--blue)'];

/**
 * THREE CHARTS, NOT ONE CHART WITH FILTERS (owner, 2026-08-25: "charts are 3
 * different datasets").
 *
 * - `area`   — the same music ranked at four widths: local, regional, national,
 *              global. One dataset, four scopes; the scope is a zoom level, not
 *              a different question.
 * - `genre`  — one genre at a time, ranked across everywhere.
 * - `friends`— only accounts the viewer follows.
 *
 * They are separate requests rather than one payload with three keys because
 * each is a real query and a member reads one at a time; computing the other
 * two on every open would be work nobody asked for.
 *
 * ## Ranking, and the bound on it
 *
 * A chart is "most hyped in the last seven days", so the rank comes from `Seed`
 * rows with `action: 'hype'`. The order of operations matters and is the
 * opposite of the version this replaces: that one took the 60 most-hyped tracks
 * PLATFORM-WIDE and then filtered them down to the local ones, so a city chart
 * could only ever show local tracks that were also national hits — which is why
 * `local` was almost always empty. Here the dataset is selected FIRST, and the
 * hype counts are read for that set, so a genre or a city ranks within itself.
 *
 * `CANDIDATE_LIMIT` bounds the candidate set at the most recent 600 eligible
 * tracks in the dataset. At this platform's size that is every track and the
 * ranking is exact; past it, a track older than the 600th would be invisible to
 * the chart no matter how hyped. Stated rather than hidden: the honest fix when
 * the catalogue outgrows it is a materialised hype counter per track, not a
 * bigger number here.
 */

const CANDIDATE_LIMIT = 600;
const CHART_ROWS = 20;
const WINDOW_DAYS = 7;

export type ChartTrack = {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  city: string;
  genres: string[];
  hypeCount: number;
  color: string;
  mediaUrl: string;
  durationSec: number;
  artworkUrl: string | null;
};

export type ChartDataset = 'area' | 'genre' | 'friends';
export type ChartScope = 'local' | 'regional' | 'national' | 'global';

const SCOPES: readonly ChartScope[] = ['local', 'regional', 'national', 'global'];

function readDataset(value: string | null): ChartDataset {
  return value === 'genre' || value === 'friends' ? value : 'area';
}

function readScope(value: string | null): ChartScope {
  return SCOPES.includes(value as ChartScope) ? (value as ChartScope) : 'local';
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ rows: [], reason: 'signed-out' }, { status: 401 });
  }
  const userId = session.user.id;

  const url = new URL(request.url);
  const dataset = readDataset(url.searchParams.get('dataset'));
  const scope = readScope(url.searchParams.get('scope'));
  const genre = (url.searchParams.get('genre') ?? '').trim();

  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  /* Where the viewer is, for the area chart.
     Read from their own profile rather than from a query parameter: the old
     route took `?city=` and no caller ever sent one, so `local` was empty for
     everybody. `lastLoginCountry` backs up the national scope only — it is a
     country and cannot stand in for a city. */
  const [place, followed] = await Promise.all([
    db.profile.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
      select: { city: true, stateRegion: true, country: true },
    }).catch(() => null),
    dataset === 'friends'
      ? db.follow.findMany({ where: { followerId: userId }, select: { followeeProfileId: true } }).catch(() => [])
      : Promise.resolve([]),
  ]);
  const fallbackCountry = place?.country
    ? null
    : await db.user.findUnique({ where: { id: userId }, select: { lastLoginCountry: true } }).catch(() => null);

  const viewerPlace = {
    city: place?.city?.trim() || null,
    region: place?.stateRegion?.trim() || null,
    country: place?.country?.trim() || fallbackCountry?.lastLoginCountry?.trim() || null,
  };

  const eligible: Prisma.ArtistMediaAssetWhereInput = {
    ...releasedMediaWhere(now),
    profile: { discoverable: true },
  };

  /** The predicate that IS the dataset, plus the reason when it cannot be built. */
  const resolveWhere = (): { where: Prisma.ArtistMediaAssetWhereInput | null; reason: string | null } => {
    if (dataset === 'friends') {
      if (!followed.length) return { where: null, reason: 'no-follows' };
      return {
        where: { AND: [eligible, { profileId: { in: followed.map((f) => f.followeeProfileId) } }] },
        reason: null,
      };
    }
    if (dataset === 'genre') {
      if (!genre) return { where: null, reason: 'no-genre' };
      return {
        where: { AND: [eligible, { profile: { discoverable: true, genres: { has: genre } } }] },
        reason: null,
      };
    }
    if (scope === 'global') return { where: eligible, reason: null };
    if (scope === 'local') {
      if (!viewerPlace.city) return { where: null, reason: 'no-location' };
      return {
        where: { AND: [eligible, { profile: { discoverable: true, city: { equals: viewerPlace.city, mode: 'insensitive' } } }] },
        reason: null,
      };
    }
    if (scope === 'regional') {
      if (!viewerPlace.region) return { where: null, reason: 'no-location' };
      return {
        where: { AND: [eligible, { profile: { discoverable: true, stateRegion: { equals: viewerPlace.region, mode: 'insensitive' } } }] },
        reason: null,
      };
    }
    if (!viewerPlace.country) return { where: null, reason: 'no-location' };
    return {
      where: { AND: [eligible, { profile: { discoverable: true, country: { equals: viewerPlace.country, mode: 'insensitive' } } }] },
      reason: null,
    };
  };

  const { where, reason } = resolveWhere();

  /* The genre list the picker is drawn from — every genre carried by a
     discoverable profile with eligible music, so a chip can never lead to an
     empty chart. Computed for the genre dataset only; it is a second query and
     the area chart has no use for it. */
  const genres = dataset === 'genre'
    ? [...new Set(
        (await db.artistMediaAsset.findMany({
          where: eligible,
          orderBy: { createdAt: 'desc' },
          take: CANDIDATE_LIMIT,
          select: { profile: { select: { genres: true } } },
        }).catch(() => [])).flatMap((row) => row.profile?.genres ?? []),
      )].sort()
    : [];

  if (!where) {
    return NextResponse.json(
      { dataset, scope, genre: genre || null, rows: [], genres, viewerPlace, reason },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const candidates = await db.artistMediaAsset.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: CANDIDATE_LIMIT,
    select: {
      id: true,
      title: true,
      durationSecs: true,
      storageUrl: true,
      artworkUrl: true,
      profile: { select: { name: true, slug: true, city: true, genres: true } },
    },
  }).catch(() => []);

  if (!candidates.length) {
    return NextResponse.json(
      { dataset, scope, genre: genre || null, rows: [], genres, viewerPlace, reason: 'no-tracks' },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  /* `groupBy` rather than reading every hype row and counting in JS: the count
     is what this needs, and the previous version pulled every hype on the
     platform for the window to get it. */
  const counts = await db.seed.groupBy({
    by: ['mediaId'],
    where: { action: 'hype', createdAt: { gte: since }, mediaId: { in: candidates.map((c) => c.id) } },
    _count: { mediaId: true },
  }).catch(() => [] as Array<{ mediaId: string; _count: { mediaId: number } }>);

  const hypeCount = new Map(counts.map((row) => [row.mediaId, row._count.mediaId]));

  const rows: ChartTrack[] = candidates
    .filter((c) => (hypeCount.get(c.id) ?? 0) > 0)
    .sort((a, b) => (hypeCount.get(b.id) ?? 0) - (hypeCount.get(a.id) ?? 0))
    .slice(0, CHART_ROWS)
    .map((m, i) => ({
      id: m.id,
      title: m.title,
      artistName: m.profile?.name ?? 'Unknown Artist',
      artistSlug: m.profile?.slug ?? '',
      city: m.profile?.city ?? '',
      genres: m.profile?.genres ?? [],
      hypeCount: hypeCount.get(m.id) ?? 0,
      color: PALETTE[i % PALETTE.length],
      mediaUrl: m.storageUrl ?? '',
      durationSec: m.durationSecs ?? 0,
      artworkUrl: m.artworkUrl,
    }));

  return NextResponse.json(
    {
      dataset,
      scope,
      genre: genre || null,
      rows,
      genres,
      viewerPlace,
      // "Nobody has hyped anything here this week" is a different answer from
      // "there is nothing here", and a chart that says the wrong one reads as
      // broken.
      reason: rows.length === 0 ? 'no-hypes' : null,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
