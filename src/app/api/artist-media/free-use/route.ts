import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getDemoProfileRelationExclusion } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const limitParam = Number.parseInt(searchParams.get('limit') ?? '100', 10);
  const limit = Math.min(Math.max(1, Number.isNaN(limitParam) ? 100 : limitParam), 200);
  const cursor = searchParams.get('cursor') ?? undefined;

  const where = q
    ? {
        freeUseEnabled: true,
        ...getDemoProfileRelationExclusion(),
        OR: [
          { title: { contains: q, mode: 'insensitive' as const } },
          { profile: { name: { contains: q, mode: 'insensitive' as const } } }
        ]
      }
    : { freeUseEnabled: true, ...getDemoProfileRelationExclusion() };

  const tracks = await db.artistMediaAsset.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { hexId: 'asc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { hexId: cursor }, skip: 1 } : {}),
    select: {
      hexId: true,
      title: true,
      notes: true,
      mimeType: true,
      fileSizeBytes: true,
      createdAt: true,
      profile: {
        select: {
          slug: true,
          name: true,
          avatarImage: true,
          genres: true,
          city: true,
          stateRegion: true
        }
      }
    }
  });

  const hasMore = tracks.length > limit;
  const page = hasMore ? tracks.slice(0, limit) : tracks;
  const nextCursor = hasMore ? page[page.length - 1]?.hexId ?? null : null;

  return NextResponse.json({
    tracks: page.map((track) => ({
      hexId: track.hexId,
      title: track.title,
      notes: track.notes,
      mimeType: track.mimeType,
      fileSizeBytes: track.fileSizeBytes,
      streamUrl: `/api/media/${track.hexId}`,
      createdAt: track.createdAt,
      artist: {
        name: track.profile.name,
        slug: track.profile.slug,
        avatarImage: track.profile.avatarImage,
        genres: track.profile.genres,
        location: [track.profile.city, track.profile.stateRegion].filter(Boolean).join(', ')
      }
    })),
    nextCursor,
    hasMore,
    limit
  });
}
