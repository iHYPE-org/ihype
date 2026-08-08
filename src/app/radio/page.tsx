import { redirect } from 'next/navigation';

/**
 * `/radio` was the DJ-hosted web-radio surface. Two things retired it: the DJ
 * role was removed from the product (2026-08-06), and v8's radio is
 * station-based — five generated stations (genre · new · local · from others ·
 * your history) computed at request time by `GET /api/stations`, rendered by
 * the MUSIC module's Radio tab.
 *
 * Kept as a redirect: `/radio` is in `sitemap.ts` and carried its own OG card.
 */
export const dynamic = 'force-dynamic';

export default function RadioRedirect() {
  redirect('/app/music/radio');
}
