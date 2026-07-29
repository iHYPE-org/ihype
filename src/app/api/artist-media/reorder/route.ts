import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { log } from '@/lib/logger';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { profileId, order } = body as { profileId?: string; order?: string[] };

    if (!profileId || !Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: 'profileId and order[] are required.' }, { status: 400 });
    }

    const profile = await withDbRetry(() =>
      db.profile.findUnique({ where: { id: profileId }, select: { ownerId: true } })
    );

    if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    if (!canManageOwnedResource(session, profile.ownerId)) {
      return NextResponse.json({ error: 'Only the profile owner can reorder tracks.' }, { status: 403 });
    }

    await withDbRetry(() =>
      db.$transaction(
        order.map((hexId, index) =>
          db.artistMediaAsset.updateMany({
            where: { hexId, profile: { id: profileId } },
            data: { sortOrder: index }
          })
        )
      )
    );

    return NextResponse.json({ reordered: true });
  } catch (error) {
    log.error('[api/artist-media/reorder]', error instanceof Error ? error : { error: String(error) }, 'reorder failed');
    return NextResponse.json({ error: 'Could not reorder tracks.' }, { status: 500 });
  }
}
