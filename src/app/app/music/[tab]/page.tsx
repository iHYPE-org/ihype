import { MmmMissing } from '@/components/mmm/MmmMissing';
import { MmmMusic, type MusicTabId } from '@/components/mmm/MmmMusic';
import { MMM_MUSIC_TABS } from '@/lib/mmm-nav';

export const dynamic = 'force-dynamic';

export default async function MmmMusicPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  // The manifest is the allowlist — an unknown tab shows not-found rather than
  // silently falling back to Discover, which would make a typo look like a
  // working link. Returned rather than thrown: this route's layout is async and
  // has already flushed, so `notFound()` renders the shell twice (see
  // `MmmMissing`).
  if (!MMM_MUSIC_TABS.some((item) => item.id === tab)) {
    return <MmmMissing eyebrow="Not found" title="No such tab" body="That is not one of MUSIC's tabs. Discover, Radio, Charts and Playlists are." />;
  }
  return <MmmMusic tab={tab as MusicTabId} />;
}
