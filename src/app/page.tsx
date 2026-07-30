import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PiAdminButton } from '@/components/PiAdminButton';
import { FanFirstLanding } from '@/components/FanFirstLanding';
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
  const [artistCount, fanCount, totalHypes, showCount] = await Promise.all([
    db.profile.count({ where: { type: 'ARTIST', discoverable: true } }).catch(() => 0),
    db.profile.count({ where: { type: 'LISTENER' } }).catch(() => 0),
    db.profileHypeEvent.count().catch(() => 0),
    db.show.count({
      where: {
        status: { in: ['SCHEDULED', 'LIVE'] },
        startsAt: { gte: now },
        moderationStatus: 'APPROVED',
      },
    }).catch(() => 0),
  ]);

  const fmt = (value: number) => value >= 1000
    ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`
    : String(value);
  const stats = [
    artistCount > 0 ? { value: fmt(artistCount), label: 'local artists' } : null,
    showCount > 0 ? { value: fmt(showCount), label: 'upcoming shows' } : null,
    fanCount > 0 ? { value: fmt(fanCount), label: 'music fans' } : null,
    totalHypes > 0 ? { value: fmt(totalHypes), label: 'HYPEs sent' } : null,
  ].filter((entry): entry is { value: string; label: string } => entry !== null);

  return (
    <>
      <FanFirstLanding
        primaryCtaLabel={t('page.joinFree', 'Join free')}
        stats={stats}
      />
      <PiAdminButton />
    </>
  );
}
