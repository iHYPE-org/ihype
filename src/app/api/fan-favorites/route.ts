import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const favoriteSchema = z.object({
  mediaId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(160),
  artistName: z.string().trim().min(1).max(160),
  url: z.string().trim().url(),
  artistProfileSlug: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(240).optional().nullable(),
  artworkUrl: z.string().trim().url().optional().nullable()
});

function canUseFanPlaylists(role: string | null | undefined) {
  return role === 'FAN' || role === 'ADMIN';
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
    console.error('[fan-favorites]', err);
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
    console.error('[fan-favorites]', err);
    return NextResponse.json({ error: 'Invalid loved-media payload' }, { status: 400 });
  }
}
