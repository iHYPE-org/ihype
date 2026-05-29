import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { slug } = await params;
  const playlist = await db.fanPlaylist.findUnique({ where: { id: slug } });
  if (!playlist || playlist.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  let body: { mediaId?: unknown; title?: unknown; artistName?: unknown; url?: unknown; artistProfileSlug?: unknown; artworkUrl?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const mediaId = typeof body.mediaId === 'string' ? body.mediaId : '';
  const title = typeof body.title === 'string' ? body.title : '';
  const artistName = typeof body.artistName === 'string' ? body.artistName : '';
  const url = typeof body.url === 'string' ? body.url : '';
  if (!mediaId || !title || !artistName || !url) {
    return NextResponse.json({ error: 'mediaId, title, artistName, and url are required.' }, { status: 400 });
  }

  // Get current max position
  const lastItem = await db.fanPlaylistItem.findFirst({
    where: { playlistId: slug },
    orderBy: { position: 'desc' },
  });
  const position = (lastItem?.position ?? -1) + 1;

  const item = await db.fanPlaylistItem.create({
    data: {
      playlistId: slug,
      mediaId,
      title,
      artistName,
      url,
      artistProfileSlug: typeof body.artistProfileSlug === 'string' ? body.artistProfileSlug : undefined,
      artworkUrl: typeof body.artworkUrl === 'string' ? body.artworkUrl : undefined,
      position,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
