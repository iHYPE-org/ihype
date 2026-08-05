import { notFound } from 'next/navigation';
import { MmmMusic, type MusicTabId } from '@/components/mmm/MmmMusic';
import { MMM_MUSIC_TABS } from '@/lib/mmm-nav';

export const dynamic = 'force-dynamic';

export default async function MmmMusicPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  // The manifest is the allowlist — an unknown tab 404s rather than silently
  // falling back to Discover, which would make a typo look like a working link.
  if (!MMM_MUSIC_TABS.some((item) => item.id === tab)) notFound();
  return <MmmMusic tab={tab as MusicTabId} />;
}
