import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });

  const playlists = await db.fanPlaylist.findMany({
    where: { userId: session.user.id },
    include: {
      items: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ playlists });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });

  let body: { name?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'name is required.' }, { status: 400 });

  const playlist = await db.fanPlaylist.create({
    data: { userId: session.user.id, name },
    include: { items: true },
  });

  return NextResponse.json({ playlist }, { status: 201 });
}
