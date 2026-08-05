import type { Metadata } from 'next';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { FanFirstLanding } from '@/components/FanFirstLanding';
import { LandingStats, LandingStatsFallback } from '@/components/LandingStats';
import { getBaseUrl } from '@/lib/utils';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';

const TITLE = 'iHYPE — Listen. Engage. HYPE local.';
const DESCRIPTION = 'Listen to free local music, discover artists and live events around you, and HYPE what deserves to be heard.';

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

  // The counters stream in behind their own boundary — nothing above the fold
  // depends on them, so they must not delay the hero. See LandingStats.tsx.
  return (
    <FanFirstLanding
      stats={
        <Suspense fallback={<LandingStatsFallback />}>
          <LandingStats />
        </Suspense>
      }
    />
  );
}
