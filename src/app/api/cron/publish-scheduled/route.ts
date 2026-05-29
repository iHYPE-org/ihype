import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { sendPushNotification } from '@/lib/push-notify';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Find assets that are due to be published
  const assets = await db.artistMediaAsset.findMany({
    where: {
      isPublished: false,
      publishAt: { lte: now },
    },
    include: {
      profile: { select: { ownerId: true, name: true } },
    },
    take: 100,
  });

  if (assets.length === 0) {
    return NextResponse.json({ ok: true, published: 0 });
  }

  const ids = assets.map(a => a.id);
  await db.artistMediaAsset.updateMany({
    where: { id: { in: ids } },
    data: { isPublished: true },
  });

  // Notify each artist
  for (const asset of assets) {
    await sendPushNotification(asset.profile.ownerId, {
      title: 'Your track is now live!',
      body: `"${asset.title}" is now published on iHYPE`,
      url: `/artists/${asset.profile.ownerId}`,
    });
  }

  return NextResponse.json({ ok: true, published: assets.length });
}
