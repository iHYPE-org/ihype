import { redirect } from 'next/navigation';

/**
 * Retired with the pre-shell app. v8's `templates/discover/` governs `/shows`
 * and `/this-weekend` — the events list — while music discovery is the MUSIC
 * module's Discover (seed) tab. This route was a third thing: a browse list of
 * artists and venues that the map and Discover now cover between them.
 *
 * Kept as a redirect because it is in `sitemap.ts` and has been indexed.
 */
export const dynamic = 'force-dynamic';

export default function DiscoverRedirect() {
  redirect('/app/music/discover');
}
