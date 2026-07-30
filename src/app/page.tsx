import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PiAdminButton } from '@/components/PiAdminButton';
import { FanFirstLanding } from '@/components/FanFirstLanding';
import { isInviteCodeRequiredRuntime } from '@/lib/runtime-flags';
import { db } from '@/lib/db';
import { getBaseUrl } from '@/lib/utils';
import { getServerT } from '@/lib/i18n/server';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';

const TITLE = 'iHYPE — Your local music scene, completely free';
const DESCRIPTION = 'Discover independent artists and live shows near you, hype the moments you love, and grab tickets with zero fees.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: getBaseUrl() },
  openGraph: {
    type: 'website',
    siteName: 'iHYPE',
    title: TITLE,
    description: DESCRIPTION,
    url: getBaseUrl(),
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default async function RootPage() {
  const t = await getServerT();
  const session = await auth();
  if (session?.user?.id) redirect(WORKBENCH_PATH);

  const now = new Date();
  const [trackRows, showRows, artistCount, fanCount, totalHypes, inviteOnly] = await Promise.all([
    db.artistMediaAsset.findMany({
      where: {
        isPublished: true,
        profile: { discoverable: true },
        OR: [{ publishAt: null }, { publishAt: { lte: now } }],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 8,
      select: {
        id: true,
        hexId: true,
        title: true,
        notes: true,
        artworkUrl: true,
        profile: { select: { name: true, slug: true, avatarImage: true, heroImage: true } },
      },
    }).catch(() => []),
    db.show.findMany({
      where: {
        status: { in: ['SCHEDULED', 'LIVE'] },
        startsAt: { gte: now },
        moderationStatus: 'APPROVED',
      },
      orderBy: [{ featured: 'desc' }, { startsAt: 'asc' }],
      take: 6,
      select: {
        slug: true,
        title: true,
        startsAt: true,
        posterImage: true,
        venueProfile: { select: { name: true, city: true } },
      },
    }).catch(() => []),
    db.profile.count({ where: { type: 'ARTIST', discoverable: true } }).catch(() => 0),
    db.profile.count({ where: { type: 'LISTENER' } }).catch(() => 0),
    db.profileHypeEvent.count().catch(() => 0),
    isInviteCodeRequiredRuntime(),
  ]);

  const tracks = trackRows.map((track) => ({
    id: track.id,
    mediaId: track.id,
    title: track.title,
    artistName: track.profile.name,
    artistProfileSlug: track.profile.slug,
    notes: track.notes,
    artworkUrl: track.artworkUrl ?? track.profile.avatarImage ?? track.profile.heroImage,
    url: `/api/public-media/${encodeURIComponent(track.hexId)}`,
    shareUrl: `/tracks/${encodeURIComponent(track.hexId)}`,
  }));
  const shows = showRows.map((show) => ({
    slug: show.slug,
    title: show.title,
    startsAt: show.startsAt.toISOString(),
    posterImage: show.posterImage,
    venueName: show.venueProfile?.name ?? null,
    city: show.venueProfile?.city ?? null,
  }));

  const fmt = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K` : String(value);
  const stats = [
    artistCount > 0 ? `${fmt(artistCount)} artists` : null,
    fanCount > 0 ? `${fmt(fanCount)} fans` : null,
    totalHypes > 0 ? `${fmt(totalHypes)} hypes` : null,
  ].filter((entry): entry is string => entry !== null);

  return (
    <>
      <FanFirstLanding
        tracks={tracks}
        shows={shows}
        primaryCtaLabel={inviteOnly ? t('page.requestBeta', 'Request Alpha') : t('page.getStarted', 'Get started')}
        stats={stats}
      />
      <PiAdminButton />
    </>
  );
}
