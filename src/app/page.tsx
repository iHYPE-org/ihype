import type { Metadata } from 'next';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { FanFirstLanding } from '@/components/FanFirstLanding';
import { LandingStats, LandingStatsFallback } from '@/components/LandingStats';
import { getBaseUrl } from '@/lib/utils';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { isInviteCodeRequiredRuntime } from '@/lib/runtime-flags';
import { log } from '@/lib/logger';

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

  // The landing page states, as fixed copy, that access is by request and that
  // this is a private alpha. Whether that is TRUE is a runtime flag nobody was
  // checking against the claim — and on 2026-08-09, hours after the copy went
  // live, production was serving "Private alpha · request access" while
  // `/register` rendered the open signup form, because `invite_only_signup`
  // was off. The page and the gate disagreed and the URL won, exactly as this
  // component's own header warns.
  //
  // Nothing here forces the flag: which doors are open is an operator
  // decision, and a page must not silently rewrite one. What it does is refuse
  // to let the two drift unnoticed — a promise the product cannot keep is an
  // error, so it is reported as one, with the fix in the message. `log.error`
  // rather than `console.error` because only the former reaches Sentry.
  if (!(await isInviteCodeRequiredRuntime())) {
    log.error(
      '[landing] invite gate is OFF while the landing page promises request-only access',
      {
        detail:
          'The front page says "Private alpha" and offers no signup link, but ' +
          '/register currently accepts anyone who reaches the URL directly. ' +
          'Either turn the invite_only_signup runtime flag on (and check ' +
          'FEATURE_REQUIRE_INVITE_CODE in the Worker env, which is its default ' +
          'and is fail-closed), or change the landing copy to match open signup.',
      },
      'error',
    );
  }

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
