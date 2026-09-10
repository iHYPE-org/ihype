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

/** What a warm actually achieved. `stored` counts pages now in the cache. */
export type WarmOutcome =
  | { ok: true; stored: number; failed: number }
  | { ok: false; reason: 'no-worker' | 'no-answer' };

/** A worker that has not been updated yet never answers; do not hang on it. */
const WARM_REPLY_TIMEOUT_MS = 15_000;

/**
 * Pre-caches the holder's own ticket pages, and reports what was stored.
 *
 * The service worker already served a previously-viewed ticket offline. This
 * covers the case that actually strands someone: a ticket bought earlier and
 * opened for the first time at a door with no signal.
 *
 * TWO THINGS CHANGED ON 2026-09-10, both of which had the same effect — a fan
 * who thought their tickets were saved and had nothing.
 *
 * (1) It read `navigator.serviceWorker.controller`, which is NULL on the first
 * load of a session: the worker claims a page on activate, after that
 * navigation has already been served. So the very first visit to the wallet
 * warmed nothing at all, silently. `warmDoorCache` below has always waited for
 * `serviceWorker.ready` for exactly this reason, and its comment says the
 * wallet "gets a second load for free" — which is true only if the member
 * comes back. Buy on the bus, open the wallet once, arrive at a basement
 * venue: one load, nothing cached. This now waits the same way.
 *
 * (2) It was fire-and-forget, so nothing could tell a member whether it had
 * worked. It asks the worker over a MessageChannel and reports the real count;
 * a worker too old to answer resolves `no-answer` rather than a cheerful lie.
 */
export async function warmTicketCache(paths: readonly string[]): Promise<WarmOutcome> {
  if (!paths.length) return { ok: true, stored: 0, failed: 0 };
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return { ok: false, reason: 'no-worker' };
  let worker: ServiceWorker | null = null;
  try {
    const registration = await navigator.serviceWorker.ready;
    worker = registration.active ?? navigator.serviceWorker.controller;
  } catch {
    return { ok: false, reason: 'no-worker' };
  }
  if (!worker) return { ok: false, reason: 'no-worker' };

  /* And the assets THIS page loaded — the wallet's own chunks, the shell's
     dynamically imported map chunks. The door page needed this first (see
     `warmDoorCache`); the wallet only escaped because its <Link>s prefetch the
     ticket page's chunk while online, which is luck, not a guarantee. */
  reportLoadedAssets(worker);

  return new Promise<WarmOutcome>((resolve) => {
    let settled = false;
    const finish = (outcome: WarmOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      channel.port1.close();
      resolve(outcome);
    };
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      const data = (event.data ?? {}) as { type?: unknown; stored?: unknown; failed?: unknown };
      if (data.type !== 'WARM_RESULT') return;
      finish({
        ok: true,
        stored: typeof data.stored === 'number' ? data.stored : 0,
        failed: typeof data.failed === 'number' ? data.failed : 0,
      });
    };
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => finish({ ok: false, reason: 'no-answer' }), WARM_REPLY_TIMEOUT_MS);
    try {
      worker.postMessage({ type: 'WARM_TICKETS', paths: [...paths] }, [channel.port2]);
    } catch {
      finish({ ok: false, reason: 'no-worker' });
    }
  });
}

/**
 * Hands the worker every same-origin `/_next/static/` asset this page has
 * loaded, from the performance timeline, so the ones that never passed through
 * the fetch handler are stored too. On the first visit of a session the worker
 * claims the page AFTER its scripts were fetched, so without this a cached
 * document can hydrate into the error boundary offline — measured on the door
 * page, 2026-09-10. The worker keeps only same-origin static entries.
 */
function reportLoadedAssets(worker: ServiceWorker): void {
  if (typeof performance === 'undefined') return;
  const loaded = performance.getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => name.includes('/_next/static/'));
  if (loaded.length) worker.postMessage({ type: 'WARM_ASSETS', urls: loaded });
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
    reportLoadedAssets(worker);
    return true;
  } catch {
    return false;
  }
}
