import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('slug');
    if (slug) {
      const queue = await db.auxQueue.findUnique({
        where: { slug },
        include: { items: { orderBy: { position: 'asc' } } },
      }).catch(() => null);
      if (!queue) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ queue });
    }
    // List user's queues
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ queues: [] });
    const queues = await db.auxQueue.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
    }).catch(() => []);
    return NextResponse.json({ queues });
  } catch (err) {
    console.error('[api/aux] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { name, trackIds } = await request.json();
    if (!name?.trim() || !Array.isArray(trackIds)) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + Date.now().toString(36);
    const queue = await db.auxQueue.create({
      data: {
        userId: session.user.id,
        name: name.trim().slice(0, 80),
        slug,
        items: {
          create: trackIds.slice(0, 20).map((id: string, position: number) => ({ mediaId: id, position })),
        },
      },
    });
    return NextResponse.json({ queue, url: `/aux/${slug}` }, { status: 201 });
  } catch (err) {
    console.error('[api/aux] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
