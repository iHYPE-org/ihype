import { MmmMissing } from '@/components/mmm/MmmMissing';
import { MmmMusic, type MusicTabId } from '@/components/mmm/MmmMusic';
import { MMM_MUSIC_TABS } from '@/lib/mmm-nav';
import { preload } from 'react-dom';
import { musicTabFirstReads } from '@/lib/mmm-music-reads';
import { bootstrapMusicPayloads } from '@/lib/mmm-music-bootstrap';

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
    return <MmmMissing kind="tab" />;
  }
  /* The dial reads the section visually; the document needs to say it too.
     Every MUSIC tab rendered with no heading at all, so a screen reader landed
     on a page with no name. Visually hidden: a second visible title would be
     the one-dial rule's drift in another form. */
  const label = MMM_MUSIC_TABS.find((item) => item.id === tab)?.label ?? 'Music';
  /* The tab's first reads. The server answers them here, through the same
     route handlers, and the rows ship in the render — the HTML on a document
     load, the RSC payload on a navigation (row 512; the rules are in
     `mmm-music-bootstrap.ts`). Whatever the bootstrap did not answer — a read
     that failed or missed the deadline — is PRELOADED instead, so the browser starts it
     while the document is still streaming (row 511; the credentials match is
     in `mmm-music-reads.ts`): `crossOrigin: 'anonymous'` IS the match, since a
     bare `fetch()` sends same-origin credentials and so does an anonymous
     same-origin preload. */
  const firstReads = musicTabFirstReads(tab as MusicTabId, { genre, city });
  const initialPayloads = await bootstrapMusicPayloads(firstReads);
  for (const url of firstReads) {
    if (!(url in initialPayloads.payloads)) preload(url, { as: 'fetch', crossOrigin: 'anonymous' });
  }
  return (
    <>
      <h1 className="sr-only">{label}</h1>
      <MmmMusic
        city={city}
        focusSearch={focus === 'search'}
        genre={genre}
        initialPayloads={initialPayloads}
        q={q}
        tab={tab as MusicTabId}
      />
    </>
  );
}
