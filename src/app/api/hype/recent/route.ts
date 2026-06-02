import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
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

  const events = await db.profileHypeEvent.findMany({
    where: { profileId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      user: {
        include: {
          profiles: {
            take: 1,
            select: { hexId: true },
          },
        },
      },
    },
  });

  const result = events.map((e) => ({
    hexId: e.user.profiles[0]?.hexId ?? e.userId.slice(0, 8),
    createdAt: e.createdAt.toISOString(),
  }));

  return NextResponse.json(result);
}
