import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';

const favoriteSchema = z.object({
  mediaId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(160),
  artistName: z.string().trim().min(1).max(160),
  url: z.string().trim().url(),
  artistProfileSlug: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(240).optional().nullable(),
  artworkUrl: z.string().trim().url().optional().nullable()
});

/* Playlists stay a fan surface, but LIKING is account-wide (owner,
   2026-08-24: likes are "stored to user's account" — an artist liking a
   track is a listener act, not a role feature). The old FAN/ADMIN gate on
   this route made every other role's heart silently 403. */
function canUseFanPlaylists(_role: string | null | undefined) {
  return true;
}

/**
 * GET /api/fan-favorites?mediaId= → { liked } for the session user.
 * GET /api/fan-favorites            → { favorites } — every liked track, newest first.
 *
 * The single-target form is what lights a heart on arrival — the heart could
 * never read its own stored state, so it re-offered a like the account already
 * held on every track change. The LIST form backs the Library tab: these rows
 * store the full playable shape (url, title, artist, artwork), and until the
 * list was readable a liked track went into the account and never came back
 * out anywhere.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }
  const mediaId = new URL(request.url).searchParams.get('mediaId')?.trim();
  if (!mediaId) {
    try {
      const favorites = await db.fanFavoriteMedia.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        select: { mediaId: true, title: true, artistName: true, url: true, artistProfileSlug: true, artworkUrl: true, createdAt: true },
      });
      return NextResponse.json({ favorites });
    } catch (err) {
      log.error('[fan-favorites]', err instanceof Error ? err : { error: String(err) });
      return NextResponse.json({ error: 'Could not read loved media' }, { status: 500 });
    }
  }
  try {
    const row = await db.fanFavoriteMedia.findUnique({
      where: { userId_mediaId: { userId: session.user.id, mediaId } },
      select: { id: true }
    });
    return NextResponse.json({ liked: Boolean(row) });
  } catch (err) {
    log.error('[fan-favorites]', err instanceof Error ? err : { error: String(err) });
    return NextResponse.json({ error: 'Could not read loved media' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  if (!canUseFanPlaylists(session.user.role)) {
    return NextResponse.json({ error: 'Loved media is only available to fan accounts' }, { status: 403 });
  }

  try {
    const body = favoriteSchema.parse(await request.json());
    const favorite = await db.fanFavoriteMedia.upsert({
      where: {
        userId_mediaId: {
          userId: session.user.id,
          mediaId: body.mediaId
        }
      },
      update: {
        title: body.title,
        artistName: body.artistName,
        url: body.url,
        artistProfileSlug: body.artistProfileSlug ?? null,
        notes: body.notes ?? null,
        artworkUrl: body.artworkUrl ?? null
      },
      create: {
        userId: session.user.id,
        mediaId: body.mediaId,
        title: body.title,
        artistName: body.artistName,
        url: body.url,
        artistProfileSlug: body.artistProfileSlug ?? null,
        notes: body.notes ?? null,
        artworkUrl: body.artworkUrl ?? null
      }
    });

    return NextResponse.json(favorite, { status: 201 });
  } catch (err) {
    log.error('[fan-favorites]', err instanceof Error ? err : { error: String(err) });
    return NextResponse.json({ error: 'Invalid loved-media payload' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  if (!canUseFanPlaylists(session.user.role)) {
    return NextResponse.json({ error: 'Loved media is only available to fan accounts' }, { status: 403 });
  }

  try {
    const body = z.object({ mediaId: z.string().trim().min(1) }).parse(await request.json());

    await db.fanFavoriteMedia.deleteMany({
      where: {
        userId: session.user.id,
        mediaId: body.mediaId
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error('[fan-favorites]', err instanceof Error ? err : { error: String(err) });
    return NextResponse.json({ error: 'Invalid loved-media payload' }, { status: 400 });
  }
}
