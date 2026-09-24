/**
 * The first reads each MUSIC tab makes — declared ONCE, so the client that
 * fetches them and the server page that PRELOADS them cannot disagree.
 *
 * WHY THE PAGE PRELOADS THEM (2026-09-24, DESIGN_SYNC row 511). Every tab
 * read its rows after hydration: the document streamed, the shell's scripts
 * downloaded and evaluated, React mounted the tab, and only then did the
 * first `fetch('/api/…')` leave the browser — so on a cold load the rows
 * waited on everything that came before them. `ReactDOM.preload(url, { as:
 * 'fetch' })` in the server page emits a `<link rel="preload" as="fetch">`
 * into the streamed document, and the browser starts that request while it
 * is still parsing HTML; when `fetchTabPayload` asks for the same URL the
 * response is already in flight or landed. The client's `fetch()` and the
 * preload have to describe the SAME request or the browser fetches twice:
 * same URL, and `crossOrigin: 'anonymous'` on the preload, which is the
 * `credentials: 'same-origin'` a bare `fetch()` uses. As of row 512 the page
 * ANSWERS these reads on the server first (`mmm-music-bootstrap.ts`) and
 * preloads only what it could not; the module cache in `MmmMusic` stays.
 *
 * Pure on purpose — no React, no `@/lib/db` — so the client component and the
 * server page both import it, and so a test can hold the two callers to it.
 */
import type { MusicTabId } from '@/components/mmm/MmmMusic';

/** The Discover deck's seed URL carries the visit's own genre and city. */
export function discoverSeedsUrl(genre?: string | null, city?: string | null): string {
  const query = new URLSearchParams();
  const trimmedGenre = genre?.trim() ?? '';
  const trimmedCity = city?.trim() ?? '';
  // The endpoint's genre parameter is plural and comma-separated; one value is
  // a valid list of one.
  if (trimmedGenre) query.set('genres', trimmedGenre);
  if (trimmedCity) query.set('city', trimmedCity);
  return query.size ? `/api/discover/seeds?${query.toString()}` : '/api/discover/seeds';
}

/**
 * Each tab's fixed first reads. Discover's seeds are deliberately absent: that
 * URL carries the visit's `?genres=`/`?city=`, and `musicTabFirstReads` adds
 * it per visit. (Row 509's sibling warmer read this table too; it is gone as
 * of row 512, because the server now answers these on every render.)
 */
export const TAB_FIRST_READS: Record<MusicTabId, readonly string[]> = {
  discover: ['/api/media-listens'],
  radio: ['/api/stations'],
  charts: ['/api/charts?dataset=area&scope=local'],
  recommended: ['/api/recommend'],
  playlists: ['/api/fan-favorites', '/api/likes', '/api/stations', '/api/fan-playlists'],
};

/**
 * Everything the ACTIVE tab reads on arrival — the fixed list plus, for
 * Discover, the seeds URL the visit's parameters resolve to. This is what the
 * page answers on the server (`mmm-music-bootstrap.ts`) and preloads when it
 * could not.
 */
export function musicTabFirstReads(
  tab: MusicTabId,
  params: { genre?: string | null; city?: string | null } = {},
): readonly string[] {
  if (tab === 'discover') return [discoverSeedsUrl(params.genre, params.city), ...TAB_FIRST_READS.discover];
  return TAB_FIRST_READS[tab];
}
