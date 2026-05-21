import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const createPlaylistSchema = z.object({
  name: z.string().trim().min(1).max(60)
});

function canUseFanPlaylists(role: string | null | undefined) {
  return role === 'FAN' || role === 'ADMIN';
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  if (!canUseFanPlaylists(session.user.role)) {
    return NextResponse.json({ error: 'Fan playlists are only available to fan accounts' }, { status: 403 });
  }

  const [playlists, favorites] = await Promise.all([
    db.fanPlaylist.findMany({
      where: { userId: session.user.id },
      include: {
        items: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
        }
      },
      orderBy: [{ createdAt: 'asc' }]
    }),
    db.fanFavoriteMedia.findMany({
      where: { userId: session.user.id },
      orderBy: [{ createdAt: 'desc' }]
    })
  ]);

  return NextResponse.json({ playlists, favorites });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  if (!canUseFanPlaylists(session.user.role)) {
    return NextResponse.json({ error: 'Fan playlists are only available to fan accounts' }, { status: 403 });
  }

  try {
    const body = createPlaylistSchema.parse(await request.json());
    const playlist = await db.fanPlaylist.create({
      data: {
        userId: session.user.id,
        name: body.name
      },
      include: {
        items: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
        }
      }
    });

    return NextResponse.json(playlist, { status: 201 });
  } catch (err) {
    console.error('[fan-playlists]', err);
    return NextResponse.json({ error: 'Invalid playlist payload' }, { status: 400 });
  }
}
