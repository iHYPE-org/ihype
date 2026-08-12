/**
 * The page's half of the service worker's private-cache handling.
 *
 * Both functions are no-ops without a controlling service worker, which is the
 * normal case on a first visit and in any browser where registration failed —
 * so callers never need to check.
 */

function controller(): ServiceWorker | null {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return null;
  return navigator.serviceWorker.controller;
}

/**
 * Pre-caches the holder's own ticket pages.
 *
 * The service worker already served a previously-viewed ticket offline. This
 * covers the case that actually strands someone: a ticket bought earlier and
 * opened for the first time at a door with no signal.
 */
export function warmTicketCache(paths: readonly string[]): void {
  if (!paths.length) return;
  controller()?.postMessage({ type: 'WARM_TICKETS', paths: [...paths] });
}

/**
 * Drops the ticket and page caches. Called on sign-out.
 *
 * A ticket page is personalised and carries a QR that admits its holder to a
 * show, and the ticket cache is deliberately version-independent so a service
 * worker update cannot wipe it — which also meant nothing wiped it, ever. On a
 * shared device the next person to sign in could be served the previous
 * account's ticket.
 *
 * Fire-and-forget by design: `postMessage` reaches the service worker, which
 * outlives the page, so the navigation that follows does not need to wait.
 */
export function clearPrivateCaches(): void {
  controller()?.postMessage({ type: 'CLEAR_PRIVATE' });
}
