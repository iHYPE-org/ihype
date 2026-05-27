import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const PALETTE = ['#ff5029', '#b983ff', '#22e5d4', '#ff3e9a', '#ffb84a', '#7fb3ff'];

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  // Get skipped/hyped asset IDs from query param (client sends persisted state)
  const url = new URL(request.url);
  const seenParam = url.searchParams.get('seen') ?? '';
  const seenIds = seenParam ? seenParam.split(',').filter(Boolean) : [];

  // Get profile IDs the user already owns (exclude own uploads)
  const ownProfileIds = userId ? (await db.profile.findMany({
    where: { ownerId: userId },
    select: { id: true },
  })).map(p => p.id) : [];

  const excludeProfileIds = ownProfileIds;

  // Fetch media assets from other artists
  const assets = await db.artistMediaAsset.findMany({
    where: {
      profileId: { notIn: excludeProfileIds.length > 0 ? excludeProfileIds : undefined },
      id: { notIn: seenIds.length > 0 ? seenIds : undefined },
      freeUseEnabled: false, // only non-free-use tracks (actual releases)
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      hexId: true,
      title: true,
      storageUrl: true,
      createdAt: true,
      profile: {
        select: {
          id: true,
          name: true,
          city: true,
          hypeCount: true,
          slug: true,
        },
      },
    },
  });

  const tracks = assets.map((a, i) => ({
    id: a.id,
    title: a.title,
    artistName: a.profile.name ?? 'Unknown Artist',
    duration: '3:00',
    durationSec: 180,
    hypeCount: a.profile.hypeCount,
    color: PALETTE[i % PALETTE.length],
    album: 'Single',
    mediaUrl: a.storageUrl ?? '',
    city: a.profile.city ?? '',
    profileSlug: a.profile.slug,
  }));

  return NextResponse.json({ tracks });
}
