import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const history = await db.mediaListen.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        mediaId: true,
        title: true,
        artistName: true,
        artistProfileSlug: true,
        mediaUrl: true,
        completedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ history });
  } catch (err) {
    console.error('[api/me/listening-history] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
