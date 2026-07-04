import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getDemoOwnerExclusion } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

/**
 * Powers the mobile Pages home (PagesHome.tsx) — same queries
 * src/app/pages/page.tsx ran inline server-side, exposed here so the
 * client component can fetch them directly. Auth-required, matching the
 * hard redirect the real /pages route still enforces for direct visits.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const myProfiles = await db.profile.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, slug: true, name: true, type: true, hexId: true,
      owner: { select: { username: true } },
    },
  });
  const myProfileIds = myProfiles.map((p) => p.id);

  const [followingRows, followersCount, suggestedProfiles] = await Promise.all([
    db.follow.findMany({
      where: { followerId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        followeeProfile: {
          select: { id: true, slug: true, name: true, type: true, city: true, genres: true, ownerId: true },
        },
      },
    }),
    myProfileIds.length
      ? db.follow.count({ where: { followeeProfileId: { in: myProfileIds } } })
      : Promise.resolve(0),
    db.profile.findMany({
      where: {
        type: { in: ['ARTIST', 'DJ', 'VENUE', 'LISTENER'] },
        ownerId: { not: session.user.id },
        ...getDemoOwnerExclusion(),
      },
      orderBy: [{ verified: 'desc' }, { hypeCount: 'desc' }],
      take: 12,
      select: { id: true, slug: true, name: true, type: true, city: true, genres: true },
    }),
  ]);

  const following = followingRows.map((f) => f.followeeProfile).filter(Boolean);
  const followedProfileIds = new Set(following.map((p) => p.id));
  const suggested = suggestedProfiles.filter((p) => !followedProfileIds.has(p.id));

  let mutualCount = 0;
  if (following.length && myProfileIds.length) {
    const followingOwnerIds = following.map((p) => p.ownerId).filter(Boolean) as string[];
    if (followingOwnerIds.length) {
      mutualCount = await db.follow.count({
        where: { followerId: { in: followingOwnerIds }, followeeProfileId: { in: myProfileIds } },
      });
    }
  }

  return NextResponse.json({ myProfiles, following, followersCount, suggested, mutualCount });
}
