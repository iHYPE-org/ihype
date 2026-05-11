import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { detectRequestLocation } from '@/lib/request-location';
import { isLocalMatch, isRegionalMatch } from '@/lib/discover-feed';

type RouteContext = { params: Promise<{ showId: string }> };

/**
 * GET /api/shows/[showId]/tracks/suggest
 *
 * Returns free-use tracks ranked by local proximity → regional → network,
 * then by artist hype count. Excludes tracks already in the show's tracklist.
 *
 * Query params:
 *   q      - filter by title or artist name
 *   limit  - max results (default 40, max 100)
 */
export async function GET(req: Request, { params }: RouteContext) {
  const session = await auth();
  const { showId } = await params;

  const show = await db.show.findUnique({
    where: { id: showId },
    select: { id: true, isRadioShow: true, creatorId: true, radioTracks: { select: { mediaAssetId: true } } }
  });

  if (!show) return NextResponse.json({ error: 'Show not found.' }, { status: 404 });
  if (!show.isRadioShow) return NextResponse.json({ error: 'Not a radio show.' }, { status: 409 });
  if (!session?.user?.id || (session.user.id !== show.creatorId && !isAdminSession(session))) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const limitParam = parseInt(searchParams.get('limit') ?? '40', 10);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 40 : limitParam), 100);

  const existingAssetIds = show.radioTracks
    .map((t) => t.mediaAssetId)
    .filter((id): id is string => Boolean(id));

  const [viewerLocation, tracks] = await Promise.all([
    detectRequestLocation(),
    db.artistMediaAsset.findMany({
      where: {
        freeUseEnabled: true,
        ...(existingAssetIds.length ? { id: { notIn: existingAssetIds } } : {}),
        ...(q ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { profile: { name: { contains: q, mode: 'insensitive' as const } } }
          ]
        } : {})
      },
      take: 200,
      orderBy: [{ profile: { hypeCount: 'desc' } }, { createdAt: 'desc' }],
      select: {
        id: true,
        hexId: true,
        title: true,
        notes: true,
        mimeType: true,
        profile: {
          select: {
            name: true,
            slug: true,
            avatarImage: true,
            genres: true,
            city: true,
            stateRegion: true,
            country: true,
            postalCode: true,
            hypeCount: true
          }
        }
      }
    })
  ]);

  const scored = tracks.map((t) => {
    const locationScore = isLocalMatch(t.profile, viewerLocation) ? 2 : isRegionalMatch(t.profile, viewerLocation) ? 1 : 0;
    return { t, score: locationScore * 1000 + t.profile.hypeCount };
  });

  scored.sort((a, b) => b.score - a.score);

  const payload = scored.slice(0, limit).map(({ t, score }) => ({
    hexId: t.hexId,
    assetId: t.id,
    title: t.title,
    notes: t.notes,
    mimeType: t.mimeType,
    streamUrl: `/api/media/${t.hexId}`,
    scopeLabel: score >= 2000 ? 'Local' : score >= 1000 ? 'Regional' : 'Network',
    artist: {
      name: t.profile.name,
      slug: t.profile.slug,
      avatarImage: t.profile.avatarImage,
      genres: t.profile.genres,
      location: [t.profile.city, t.profile.stateRegion].filter(Boolean).join(', '),
      hypeCount: t.profile.hypeCount
    }
  }));

  return NextResponse.json({ tracks: payload, total: payload.length });
}
