import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getRecentHypers } from '@/lib/hype-recent';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profileId = req.nextUrl.searchParams.get('profileId');
    if (!profileId) {
      return NextResponse.json({ error: 'profileId required' }, { status: 400 });
    }

    // Verify the requesting user owns this profile
    const profile = await db.profile.findFirst({
      where: { id: profileId, ownerId: session.user.id },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const events = await getRecentHypers(profileId, 10);
    const result = events.map((e) => ({ hexId: e.hexId, createdAt: e.createdAt.toISOString() }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/hype/recent] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
