import { redirect } from 'next/navigation';

/**
 * Retired into the /info hub. Kept as a redirect rather than removed
 * outright: /about is a public marketing URL that has been live since
 * launch, is listed in the sitemap, and ships as a shortcut in
 * public/manifest.json (installed PWAs keep their shortcuts until the
 * manifest is re-fetched), so anything already pointing here has to land
 * somewhere real.
 *
 * The charter tab is the closest match — the promise copy that lived here
 * (0% ticket fee, no streaming cuts, no data for sale, open to all) restates
 * the charter, and the funding section restates /info?tab=transparency.
 * The story timeline and team blurb have no equivalent anywhere; they were
 * dropped with the page. `git show de88bac3^:src/app/about/page.tsx` has
 * them if they need a home later.
 */
export default function AboutRedirect() {
  redirect('/info?tab=charter');
}
