import { redirect } from 'next/navigation';

/**
 * Retired. The six-module deck that lived here is superseded by the
 * Music · Map · Me shell at `/app` (operator decision, 2026-08-05: "remove
 * previous frontend so there isn't a ghost popping through").
 *
 * Kept as a redirect rather than deleted because `/listen` is `WORKBENCH_PATH`
 * — it is baked into `?callbackUrl=` values in already-sent magic-link emails,
 * into bookmarks, and into the service worker's cached shell.
 */
export default function ListenPage() {
  redirect('/app/music/discover');
}
