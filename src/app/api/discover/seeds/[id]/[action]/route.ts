import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { log } from '@/lib/logger';
import { getArtistMediaApiPath } from '@/lib/media';

/**
 * The playlist a right-swipe on the seed deck files a track into.
 *
 * Saving used to write a `Seed` row with action "save" and nothing else —
 * which fed the recommender but gave the listener nowhere to actually hear
 * what they had just kept. The gesture reads as "add this to my music", so
 * it now lands somewhere playable.
 */
const DISCOVER_PLAYLIST_NAME = 'Discover';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  const rl = await consumeRateLimit(`seeds:${session.user.id}`, { limit: 120, windowMs: 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ ok: false }, { status: 429 });

  const { id, action } = await params;
  if (!['save', 'skip', 'hype'].includes(action)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const media = await db.artistMediaAsset.findUnique({
      where: { id },
      select: {
        id: true, profileId: true, hexId: true, title: true, artworkUrl: true,
        profile: { select: { name: true, slug: true } },
      },
    });

    if (!media) {
      return NextResponse.json({ ok: false, error: 'Seed media was not found.' }, { status: 404 });
    }

    await db.seed.upsert({
      where: { userId_mediaId: { userId: session.user.id, mediaId: id } },
      create: { userId: session.user.id, mediaId: id, action },
      update: { action, createdAt: new Date() },
    });

    if (action === 'save') {
      // Find-or-create rather than upsert: FanPlaylist has no unique
      // constraint on (userId, name), so an upsert has no key to target.
      const playlist =
        (await db.fanPlaylist.findFirst({
          where: { userId: session.user.id, name: DISCOVER_PLAYLIST_NAME },
          select: { id: true },
        }))
        ?? (await db.fanPlaylist.create({
          data: { userId: session.user.id, name: DISCOVER_PLAYLIST_NAME },
          select: { id: true },
        }));

      // FanPlaylistItem has no unique constraint on (playlistId, mediaId)
      // either, so re-saving the same seed would otherwise stack duplicates.
      // The Seed row above is upserted, so a repeat save is entirely possible.
      const already = await db.fanPlaylistItem.findFirst({
        where: { playlistId: playlist.id, mediaId: media.id },
        select: { id: true },
      });

      if (!already) {
        // position is append-at-end, matching POST /api/fan-playlists/[id]/items.
        const count = await db.fanPlaylistItem.count({ where: { playlistId: playlist.id } });
        await db.fanPlaylistItem.create({
          data: {
            playlistId: playlist.id,
            mediaId: media.id,
            title: media.title,
            artistName: media.profile?.name ?? 'Unknown artist',
            url: getArtistMediaApiPath(media.hexId),
            artistProfileSlug: media.profile?.slug ?? null,
            artworkUrl: media.artworkUrl,
            position: count,
          },
        });
      }
    }

    if (action === 'hype') {
      // createMany with skipDuplicates returns how many rows were actually inserted.
      // Only increment hypeCount when a new record is created, not on duplicate hypes.
      const { count } = await db.profileHypeEvent.createMany({
        data: [{ userId: session.user.id, profileId: media.profileId }],
        skipDuplicates: true,
      });
      if (count > 0) {
        await db.profile.update({
          where: { id: media.profileId },
          data: { hypeCount: { increment: 1 } },
        });
      }
    }
  } catch (error) {
    log.error('[discover/seeds/action]', error instanceof Error ? error : null, 'Failed to record seed action');
    return NextResponse.json({ ok: false, error: 'Could not record seed action.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
