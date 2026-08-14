import { MmmMissing } from '@/components/mmm/MmmMissing';
import { MmmMusic, type MusicTabId } from '@/components/mmm/MmmMusic';
import { MMM_MUSIC_TABS } from '@/lib/mmm-nav';

export const dynamic = 'force-dynamic';

export default async function MmmMusicPage({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams?: Promise<{ genre?: string | string[]; city?: string | string[]; q?: string | string[]; focus?: string | string[] }>;
}) {
  const { tab } = await params;
  const query = searchParams ? await searchParams : {};
  const genre = Array.isArray(query.genre) ? query.genre[0] : query.genre;
  const city = Array.isArray(query.city) ? query.city[0] : query.city;
  const q = Array.isArray(query.q) ? query.q[0] : query.q;
  // Set by the player pill's phone search control, which navigates here instead
  // of opening a search surface of its own.
  const focus = Array.isArray(query.focus) ? query.focus[0] : query.focus;
  // The manifest is the allowlist — an unknown tab shows not-found rather than
  // silently falling back to Discover, which would make a typo look like a
  // working link. Returned rather than thrown: this route's layout is async and
  // has already flushed, so `notFound()` renders the shell twice (see
  // `MmmMissing`).
  if (!MMM_MUSIC_TABS.some((item) => item.id === tab)) {
    return <MmmMissing eyebrow="Not found" title="No such tab" body="That is not one of MUSIC's tabs. Discover, Radio, Charts and Playlists are." />;
  }
  return <MmmMusic city={city} focusSearch={focus === 'search'} genre={genre} q={q} tab={tab as MusicTabId} />;
}
