import type { Metadata } from 'next';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { FanFirstLanding } from '@/components/FanFirstLanding';
import { LandingStats, LandingStatsFallback } from '@/components/LandingStats';
import { getBaseUrl } from '@/lib/utils';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';

// Says what the app is, not what it makes you feel. The old title named three
// verbs and never the noun, so a search result for "local music app" had
// nothing to match on. Access is by request while the product is pre-beta —
// the description must not imply an open signup the invite gate then refuses.
const TITLE = 'iHYPE — the free app for local music';
const DESCRIPTION = 'Stream music from artists in your own city, free. Find the shows they are playing this week, and HYPE the ones you want more people to hear. Private alpha — request access.';

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
