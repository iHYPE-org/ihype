import { redirect } from 'next/navigation';

/**
 * Search is no longer a route. ADHERENCE rule 37: "Universal search is
 * persistent on MUSIC, and is not a tab" — it scopes across artists, tracks,
 * venues, cities and playlists from wherever you already are. MAP has its own
 * search over venues; ME has none by design.
 *
 * Redirects rather than 404s: the path is linked from older marketing copy.
 */
export const dynamic = 'force-dynamic';

export default function SearchRedirect() {
  redirect('/app/music/discover');
}
