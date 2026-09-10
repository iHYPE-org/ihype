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

/**
 * Pre-caches the door scanner page for one show, so the phone that downloaded
 * the guest list can open the scanner with no signal.
 *
 * Unlike `warmTicketCache` this waits for the registration rather than
 * reading `controller`: the organiser presses "Download for the door" on the
 * page's FIRST load, exactly when `controller` is still null (the worker
 * claims the page on activate, after the first navigation has already been
 * served), and a warm that silently did nothing here would leave the phone
 * with a list and no page to read it on. Resolves false when there is no
 * service worker at all, so the page can say so.
 */
export async function warmDoorCache(path: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active ?? navigator.serviceWorker.controller;
    if (!worker) return false;
    worker.postMessage({ type: 'WARM_DOOR', paths: [path] });
    /* And everything this page has ALREADY loaded. On the first visit of a
       session the worker was not yet controlling the page when its scripts
       were fetched, so none of them — the shell's dynamically imported map
       chunks above all, which no HTML names — reached the static cache, and
       the cached document hydrated into the error boundary offline. The
       performance timeline is the one complete list of what the page needed;
       the worker keeps only same-origin `/_next/static/` entries from it. */
    const loaded = typeof performance !== 'undefined'
      ? performance.getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => name.includes('/_next/static/'))
      : [];
    if (loaded.length) worker.postMessage({ type: 'WARM_ASSETS', urls: loaded });
    return true;
  } catch {
    return false;
  }
}
