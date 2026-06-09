import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get profiles the user follows
    const follows = await db.follow.findMany({
      where: { followerId: session.user.id },
      select: { followeeProfileId: true }
    });
    const profileIds = follows.map(f => f.followeeProfileId);

    const [recentHypes, recentRsvps] = await Promise.all([
      db.profileHypeEvent.findMany({
        where: { profileId: { in: profileIds } },
        select: { profileId: true, userId: true, createdAt: true, profile: { select: { name: true, slug: true } }, user: { select: { name: true, username: true } } },
        orderBy: { createdAt: 'desc' }, take: 20
      }),
      db.showRsvp.findMany({
        where: { show: { headlinerProfileId: { in: profileIds } } },
        select: { userId: true, createdAt: true, show: { select: { title: true, slug: true } }, user: { select: { name: true, username: true } } },
        orderBy: { createdAt: 'desc' }, take: 20
      })
    ]);

    const feed = [
      ...recentHypes.map(h => ({ type: 'hype' as const, user: h.user, profile: h.profile, createdAt: h.createdAt })),
      ...recentRsvps.map(r => ({ type: 'rsvp' as const, user: r.user, show: r.show, createdAt: r.createdAt })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 30);

    return NextResponse.json({ feed });
  } catch (err) {
    console.error('[api/feed] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
