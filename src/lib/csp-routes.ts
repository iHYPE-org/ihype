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
  // src/components/mmm/MmmMap.tsx — the real map. Raster tiles over a
  // wildcard because the source rotates a./b./c./d. subdomains.
  'https://*.basemaps.cartocdn.com',
  // src/app/ui-preview/ModuleDeckMockup.tsx only. Kept because that preview is
  // reachable in development, not because anything in production uses it.
  'https://tiles.openfreemap.org',
] as const;

/**
 * True when this path renders a map.
 *
 * `isDevelopment` gates the preview route only: `/ui-preview` does not exist in
 * production and must not widen the policy there.
 */
export function isMapRoute(pathname: string, isDevelopment = false): boolean {
  if (pathname === '/app' || pathname.startsWith('/app/')) return true;
  // The six-module deck. Retained deliberately: row 273 cut the way in and the
  // way around over to /app, but /listen still exists and is still reachable,
  // and a stale entry here is harmless where a missing one is not.
  if (pathname === '/listen') return true;
  return isDevelopment && pathname.startsWith('/ui-preview');
}
