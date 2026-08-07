import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import type { Metadata } from 'next';
import { PagesHome } from '@/components/PagesHome';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pages · iHYPE',
  description: 'Your pages, creator tools, audience signal, and local music network.',
  robots: { index: false, follow: false },
};

/**
 * Pages, inside the Music · Map · Me shell. See the sibling `events/page.tsx`
 * for why this re-parents the existing surface rather than building a fourth
 * module: MMM's design draws three, and its arc nav is a coordinate table for
 * three.
 *
 * The auth gate is carried across verbatim from `/pages`, deliberately. It is
 * not decoration there and it is not decoration here — `PagesHome` is the page
 * editor, and every route that reaches it needs its own server-side check
 * rather than trusting that the shell above it did one. Note the callbackUrl
 * points back at THIS path, so a signed-out member who lands here returns here
 * after signing in instead of being dropped into the legacy shell — which is
 * the exact bounce this whole line of work exists to stop.
 */
export default async function MmmPagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; profile?: string; editor?: string; tool?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/app/pages');
  }

  const resolved = searchParams ? await searchParams : {};
  return (
    <div className="mmm-pane">
      <PagesHome
        initialEditorSection={resolved.editor}
        initialProfileId={resolved.profile}
        initialTab={resolved.tab}
        initialTool={resolved.tool}
      />
    </div>
  );
}
