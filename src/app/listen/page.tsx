import { redirect } from 'next/navigation';

/**
 * `/listen` is a redirect. The six-module deck it rendered is retired.
 *
 * Design System 8's route map has no `/listen`: the music surfaces are
 * `/app/music/*` inside `templates/simplified-app/`, which IS the app. Two
 * shells rendering the same discovery, radio and charts content is the
 * duplication this removal exists to end — DESIGN_SYNC row 273 had already
 * repointed every LISTEN destination at `/app/music/*`, leaving the deck
 * reachable but unlinked.
 *
 * The route stays as a forward because it is in the wild: old bookmarks, the
 * `/home` and `/studio` aliases, and links inside notification emails.
 */
export default function ListenRedirect() {
  redirect('/app/music/discover');
}
