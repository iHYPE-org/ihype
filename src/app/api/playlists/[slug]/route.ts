import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  // slug here is the playlist id (FanPlaylist has no slug field)
  const playlist = await db.fanPlaylist.findUnique({
    where: { id: slug },
    include: {
      items: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
      user: { select: { username: true } },
    },
  });
  if (!playlist) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ playlist });
}

export async function PATCH(
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

  let body: { name?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  if (!name) return NextResponse.json({ error: 'name is required.' }, { status: 400 });

  const updated = await db.fanPlaylist.update({ where: { id: slug }, data: { name } });
  return NextResponse.json({ playlist: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { slug } = await params;
  const playlist = await db.fanPlaylist.findUnique({ where: { id: slug } });
  if (!playlist || playlist.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  await db.fanPlaylist.delete({ where: { id: slug } });
  return NextResponse.json({ ok: true });
}
