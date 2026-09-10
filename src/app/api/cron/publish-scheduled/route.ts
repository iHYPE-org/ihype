import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { sendPushToAllDevices } from '@/lib/notify';

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
      /* `slug` is what an artist URL is keyed on. Without it the notice below
         built its link out of `ownerId` — a User id in a profile-slug path,
         so every "your track is live" notification landed on a 404. */
      profile: { select: { ownerId: true, name: true, slug: true } },
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

  /* Notify each artist, if they asked to hear about it.
     `crateUploads` is the Settings toggle for this, and until 2026-09-10
     nothing read it: an artist could switch "Track uploads" off and keep
     getting these. A preference that changes nothing is worse than no
     preference, because the member believes they have acted. */
  const owners = Array.from(new Set(assets.map((a) => a.profile.ownerId)));
  const muted = new Set(
    (await db.notificationPreference
      .findMany({ where: { userId: { in: owners }, crateUploads: false }, select: { userId: true } })
      .catch(() => []))
      .map((row) => row.userId),
  );
  for (const asset of assets) {
    if (muted.has(asset.profile.ownerId)) continue;
    await sendPushToAllDevices(asset.profile.ownerId, {
      title: 'Your track is now live!',
      body: `"${asset.title}" is now published on iHYPE`,
      url: `/app/artists/${asset.profile.slug}`,
    });
  }

  return NextResponse.json({ ok: true, published: assets.length });
}
