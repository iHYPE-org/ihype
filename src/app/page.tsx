import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { FanFirstLanding } from '@/components/FanFirstLanding';
import { getBaseUrl } from '@/lib/utils';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { getTransparencySnapshot } from '@/lib/transparency';

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
  const session = await auth();
  if (session?.user?.id) redirect(WORKBENCH_PATH);

  const { counters } = await getTransparencySnapshot();
  const formatCount = (value: number) => value.toLocaleString('en-US');
  const stats = [
    { value: formatCount(counters.totalArtists), label: 'local artists' },
    { value: formatCount(counters.totalListeners), label: 'music fans' },
    { value: formatCount(counters.profileHypes + counters.showHypes), label: 'HYPEs sent' },
    { value: formatCount(counters.upcomingShows), label: 'upcoming shows' },
  ];

  return <FanFirstLanding stats={stats} />;
}
