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

/**
 * Hosts the live map fetches its basemap from.
 *
 * BOTH ENTRIES ARE LOAD-BEARING AND THE APEX IS NOT REDUNDANT. A CSP wildcard
 * requires at least one label to stand in for: `*.basemaps.cartocdn.com`
 * matches `tiles.basemaps.cartocdn.com` and does NOT match
 * `basemaps.cartocdn.com` itself. That is the whole of the outage on
 * 2026-09-03 — the raster basemap fetched only from `a.`…`d.` subdomains, the
 * vector one fetches its `style.json` from the apex, and the note left behind
 * on the move said the wildcard already covered it. The style request was
 * refused by our own policy, MapLibre never got a style, `load` never fired,
 * and the map rendered as bare parchment: the CSS chart treatment paints the
 * ground and the ruled grid whether or not a single tile arrives, so a totally
 * blocked basemap looks like an empty map rather than a broken one.
 *
 * Everything else CARTO needs — vector tiles, glyphs, sprites — really is on
 * `tiles.`, so the wildcard is doing real work too. Measured in Chromium
 * against the exact `connect-src` production was serving, using
 * `securitypolicyviolation` (CSP refuses before any connection, so the verdict
 * needs no network): the apex BLOCKED, `tiles.json` and glyphs allowed.
 *
 * `csp-routes.test.ts` now resolves every URL `MmmMap.tsx` builds against this
 * list under real host-source semantics. The test that was here asserted the
 * list CONTAINED the wildcard string, which is true and was true throughout
 * the outage.
 */
export const MAP_TILE_HOSTS = [
  /* The vector style document. */
  'https://basemaps.cartocdn.com',
  /* Its tiles, glyphs and sprites — `tiles.`, and `tiles-a` … `tiles-d`. */
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
