import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { getProfileInsights } from '@/lib/profile-insights';
import { log } from '@/lib/logger';

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

    const profile = await db.profile.findUnique({
      where: { id: profileId },
      select: { ownerId: true, type: true },
    });
    if (!profile || !canManageOwnedResource(session, profile.ownerId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const insights = await getProfileInsights(profileId, profile.type);
    return NextResponse.json(insights);
  } catch (err) {
    log.error('[api/profile-insights]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
