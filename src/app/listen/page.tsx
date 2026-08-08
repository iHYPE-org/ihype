import { redirect } from 'next/navigation';

/**
 * `/listen` was the six-module deck — the pre-shell three-tab app that design
 * system v8 retired (`ROUTE_TEMPLATE_MAP.md`, Removed: `templates/fan-app/`,
 * "superseded by `templates/simplified-app/`"). Music now lives in the
 * Music · Map · Me shell.
 *
 * It stays as a redirect rather than a 404 because the URL is already out in
 * the world: sent notification emails, push payloads, `robots.ts`, and the
 * Stripe Connect onboarding return/refresh fallbacks all name it.
 *
 * The destination is `/app/music/discover` rather than `/app/map`: Discover is
 * what this route opened on, so a bookmark lands where its owner expected.
 */
export const dynamic = 'force-dynamic';

export default function ListenRedirect() {
  redirect('/app/music/discover');
}
