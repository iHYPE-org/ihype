import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ seeds: [] });

  const saved = await db.seed.findMany({
    where: { userId: session.user.id, action: { in: ['save', 'hype'] } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { mediaId: true, action: true },
  }).catch(() => [] as { mediaId: string; action: string }[]);

  if (!saved.length) return NextResponse.json({ seeds: [] });

  const mediaIds = saved.map(s => s.mediaId);
  const media = await db.artistMediaAsset.findMany({
    where: { id: { in: mediaIds } },
    select: { id: true, title: true, profile: { select: { name: true, slug: true } } },
  }).catch(() => [] as { id: string; title: string; profile: { name: string; slug: string } | null }[]);

  const mediaMap = new Map(media.map(m => [m.id, m]));
  const actionMap = new Map(saved.map(s => [s.mediaId, s.action]));

  const seeds = mediaIds
    .map(mid => {
      const m = mediaMap.get(mid);
      if (!m) return null;
      return { id: m.id, title: m.title, artistName: m.profile?.name ?? 'Unknown', artistSlug: m.profile?.slug ?? null, action: actionMap.get(mid) ?? 'save' };
    })
    .filter(Boolean);

  return NextResponse.json({ seeds });
}
