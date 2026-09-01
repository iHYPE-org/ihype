import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { getProfileStatBoard } from '@/lib/profile-stat-board';

export const dynamic = 'force-dynamic';

/**
 * The owner's stats board for one profile — see `profile-stat-board.ts`.
 *
 * Owner-gated like the editor it serves: a profile the caller does not own
 * answers 404, not 403, so the endpoint cannot be used to confirm which
 * profile ids exist. `private, no-store` because the figures are per-account
 * and a shared cache in front of them is a cross-account leak.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });

  const profileId = new URL(request.url).searchParams.get('profileId') ?? '';
  if (!profileId || profileId.length > 64) {
    return NextResponse.json({ error: 'profileId is required.' }, { status: 400 });
  }

  let profile: { ownerId: string; type: string } | null;
  try {
    profile = await withDbRetry(() =>
      db.profile.findUnique({ where: { id: profileId }, select: { ownerId: true, type: true } }),
    );
  } catch {
    return NextResponse.json({ error: 'Database unavailable — please try again in a moment.' }, { status: 503 });
  }
  if (!profile || !canManageOwnedResource(session, profile.ownerId)) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  const stats = await getProfileStatBoard(profileId, profile.type);
  return NextResponse.json(
    { stats },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
