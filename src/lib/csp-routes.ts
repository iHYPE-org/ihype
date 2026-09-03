/**
 * Which routes render a map, and therefore need the map hosts in the CSP.
 *
 * Split out of `middleware.ts` because that module imports NextAuth and cannot
 * be loaded in a unit test, so the rule inside it was unverifiable — which is
 * how it came to name the wrong route for months. Same reason `isProtectedPath`
 * lives in `auth-redirects.ts` rather than inline.
 *
 * ## The bug this exists to prevent
 *
 * The predicate used to read `pathname === '/listen'`. DESIGN_SYNC row 273
 * moved the signed-in landing surface to `/app/map`, and this list did not
 * move with it. So the first screen a member saw after signing in had:
 *
 *   - no `connect-src` entry for the tile host, blocking every tile fetch
 *   - no `worker-src blob:`, which stops maplibre creating its worker at all
 *
 * The second is why it presents as an empty canvas rather than a half-drawn
 * map, and why it reads as a layout bug rather than a policy one.
 *
 * ## Every /app route, not just /app/map
 *
 * `MmmShell` is mounted in the `/app` layout on purpose — the map is the base
 * layer and must survive navigation between modules. Scoping the allowance to
 * `/app/map` alone would blank it the moment someone opened `/app/music` or
 * `/app/me`, defeating the reason it stays mounted.
 */

/** Hosts the live map fetches tiles from. */
export const MAP_TILE_HOSTS = [
  /* src/components/mmm/MmmMap.tsx — the real map. A wildcard because CARTO
     spreads one basemap over several subdomains: the vector style comes from
     the apex, its glyphs and sprites from `tiles.`, and the tiles themselves
     from `tiles-a` … `tiles-d`. The map moved from raster to vector on
     2026-09-03 and this line needed no change, which is the reason it is a
     wildcard rather than four literals. */
  'https://*.basemaps.cartocdn.com',
] as const;

/**
 * True when this path renders a map.
 *
 * One surface does: the Music · Map · Me shell at `/app/*`. `/listen` was here
 * too, for the six-module deck's own map; the deck and its `/ui-preview`
 * harness are both retired, and with them the second tile host.
 */
export function isMapRoute(pathname: string): boolean {
  return pathname === '/app' || pathname.startsWith('/app/');
}
