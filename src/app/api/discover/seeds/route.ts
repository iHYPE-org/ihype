import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ seeds: [] });

  const skipped = await db.seed.findMany({
    where: { userId: session.user.id, action: 'skip' },
    select: { mediaId: true },
  });
  const skipIds = new Set(skipped.map(s => s.mediaId));

  const media = await db.artistMediaAsset.findMany({
    where: { id: { notIn: [...skipIds] } },
    take: 20,
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, profile: { select: { name: true } } },
  });

  return NextResponse.json({
    seeds: media.map(m => ({
      id: m.id,
      trackId: m.id,
      title: m.title,
      artistName: m.profile?.name ?? 'Unknown Artist',
      reason: 'Recommended based on your hypes',
    })),
  });
}
