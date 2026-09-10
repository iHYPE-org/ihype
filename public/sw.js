const CACHE_VERSION = 'ihype-d2b15f2b';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

// Tickets cache is intentionally version-independent so purchased ticket pages
// and their QR codes survive SW updates and are never wiped by the activate
// cleanup below. A user must be able to show their ticket at the venue door
// even with no connectivity.
const TICKETS_CACHE = 'ihype-tickets';

const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

const CORE_PAGES = [
  '/',
  /* `/hype` was here and is REMOVED (2026-09-03). It is not a page — it is a
     307 to `/` (next.config.mjs), which is already the entry above it. Two
     things are wrong with precaching a redirect. The copy is a duplicate of
     the homepage stored under a second key, so it buys nothing; and the
     response it stores has `redirected: true`, which `FetchEvent.respondWith`
     refuses for a NAVIGATION request — so serving it offline fails with a
     TypeError instead of rendering, the one situation this cache exists for.
     Only real, non-redirecting pages belong in this list; a test asserts it. */
  // `/tickets` used to be precached here. It is a signed-in page listing one
  // account's tickets, so precaching it stored one person's HTML for the next
  // person on a shared device (security sweep, 2026-09-02). Individual ticket
  // pages (/tickets/<id>) are still stored in TICKETS_CACHE on first view, so
  // the offline wallet is unaffected.
  // Precached so the real offline page is available when there is no network.
  // Install runs on a first visit while still online, so by the time it is
  // needed it is already here. See offlineFallback().
  '/offline'
];

// Never cached. These are the signed-in surfaces: their HTML is personalized,
// so a cached copy is both a staleness source and a copy of one account's page
// sitting in the Cache API after they sign out — which on a shared device the
// next person can be served.
//
// Keep this in step with PROTECTED_PREFIXES in src/lib/auth-redirects.ts. It
// cannot import from src (this file is served verbatim from /public), so the
// two lists are aligned by hand and this comment is the only thing linking
// them. `/app` and `/admin` were both missing: `/app` because it only became
// the landing surface in DESIGN_SYNC row 269, and `/admin` since the service
// worker was written.
const NETWORK_ONLY_PATHS = [
  '/app',
  '/admin',
  '/home',
  '/listen',
  '/workbench',
  '/dashboard',
  '/login',
  '/register',
  '/forgot',
  '/index.html',
  '/api',
  // Signed-in surfaces outside /app that were being written to PAGE_CACHE
  // (security sweep, 2026-09-02). The denylist is a second line: the caching
  // helpers below also refuse any response the server marks private/no-store,
  // which is what every dynamic signed-in page carries. `/tickets/<id>` is
  // deliberately NOT here: it is the offline wallet (the QR at the door with
  // no signal), served from TICKETS_CACHE below and cleared on sign-out by
  // CLEAR_PRIVATE. The /tickets index is dynamic and refused by isCacheable.
  '/settings',
  '/me',
  '/payouts',
  '/payout',
  '/support',
  '/advertise/dashboard',
  '/events/new',
  '/verify',
  '/verify-email',
  '/welcome'
];

// A response the server marked as private, or told us not to store, is one
// account's page and must never land in the Cache API. Next.js sends exactly
// this header on every dynamically rendered page, so honouring it protects
// signed-in surfaces the denylist above does not name.
function isCacheable(response) {
  if (!response || !response.ok) return false;
  const cacheControl = (response.headers.get('Cache-Control') || '').toLowerCase();
  if (cacheControl.includes('no-store') || cacheControl.includes('private')) return false;
  if (response.headers.get('Set-Cookie')) return false;
  return true;
}

// Paths that should use stale-while-revalidate (ticket availability changes frequently)
const SWR_PATHS = [
  '/shows/',
  '/artists/'
];

// True when a previous SW was already active — i.e. this is an update, not a first install.
let isUpdate = false;

/*
 * Two messages from the page, both about the ticket cache.
 *
 * WARM_TICKETS: pre-caches the holder's own ticket pages so one they have
 * never opened still opens at the door. The cache-fallback below already
 * covered a ticket that had been viewed while online; the case it missed is
 * the one that matters — buy on the bus, arrive in a basement, open it for the
 * first time with no signal.
 *
 * CLEAR_PRIVATE: drops the ticket and page caches on sign-out. Ticket pages
 * are personalised and carry a QR that admits someone to a show, and
 * TICKETS_CACHE is deliberately version-independent so an SW update cannot
 * wipe it — which also meant nothing ever wiped it. On a shared device the
 * next person signing in could be served the previous account's ticket. That
 * is exactly the risk NETWORK_ONLY_PATHS exists to prevent for /app and
 * /admin, and the door use case is why these two cannot simply join that list.
 */
self.addEventListener('message', (event) => {
  const data = event.data || {};

  /* WARM_DOOR is the organiser's counterpart: the door scanner page for one
     show, cached so the phone that downloaded the guest list can open the
     scanner with no signal. Same loop, same private cache, same asset warming;
     `isOfflinePrivatePage` is what admits either kind of path. */
  if ((data.type === 'WARM_TICKETS' || data.type === 'WARM_DOOR') && Array.isArray(data.paths)) {
    /* The page may hand us a MessageChannel port. When it does, we answer with
       what was ACTUALLY stored (2026-09-10). A fan-facing "Save my tickets"
       control cannot report success from the fact that a postMessage was sent:
       this worker may be an older version, the fetch may 404 a transferred
       ticket, or storage may be full, and every one of those looks identical
       from the page. A control that says "Saved" over an empty cache is worse
       than no control, because the fan stops worrying and arrives at a door
       with nothing. No port means a legacy caller: behave exactly as before. */
    const port = event.ports && event.ports[0];
    event.waitUntil((async () => {
      let stored = 0;
      let failed = 0;
      try {
        const cache = await caches.open(TICKETS_CACHE);
        // Sequential and individually guarded: cache.addAll rejects the whole
        // batch if any one request fails, and a single expired ticket must not
        // cost the holder every other one.
        const statics = await caches.open(STATIC_CACHE);
        for (const path of data.paths.slice(0, 50)) {
          if (typeof path !== 'string' || !isOfflinePrivatePage(path)) continue;
          try {
            const response = await fetch(path, { credentials: 'same-origin' });
            if (!response.ok) { failed++; continue; }
            await cache.put(path, response.clone());
            /* The page's own scripts and styles, too. The HTML alone is not the
               ticket: the shell's shared chunks are cached from earlier visits,
               so offline React hydrates, cannot load this route's chunk, and
               replaces the server-rendered ticket with the loading fallback —
               measured 2026-09-05 with the HTML in cache and the code visible in
               it. Hashed, immutable and same-origin, so cache-first is right. */
            await warmPageAssets(await response.text(), statics);
            stored++;
          } catch {
            // Offline already, or the ticket is gone.
            failed++;
          }
        }
      } catch {
        // Cache storage refused outright (private mode, quota). Report it.
      }
      if (port) {
        try { port.postMessage({ type: 'WARM_RESULT', stored, failed }); } catch { /* page went away */ }
      }
    })());
    return;
  }

  /* WARM_ASSETS: the page reports the static assets IT ALREADY LOADED and the
     worker stores any it does not hold. This exists for the first visit of a
     session: the worker claims a page on activate, AFTER that page's own
     scripts were fetched, so nothing it loaded — including the chunks the
     shell pulls in by dynamic import at runtime, which no HTML names — went
     through the fetch handler or into the static cache. Measured 2026-09-10:
     the door page, opened once online and then with the network cut,
     hydrated into the error boundary because the map layer's chunks were
     never stored. Same-origin `/_next/static/` only; the page cannot make the
     worker cache anything else. */
  if (data.type === 'WARM_ASSETS' && Array.isArray(data.urls)) {
    event.waitUntil((async () => {
      const statics = await caches.open(STATIC_CACHE);
      for (const raw of data.urls.slice(0, 200)) {
        if (typeof raw !== 'string') continue;
        let url;
        try { url = new URL(raw, location.origin); } catch { continue; }
        if (url.origin !== location.origin || !url.pathname.startsWith('/_next/static/')) continue;
        try {
          if (await statics.match(url.pathname)) continue;
          const asset = await fetch(url.pathname);
          if (asset.ok) await statics.put(url.pathname, asset);
        } catch {
          // Offline already, or the asset is gone. The rest still help.
        }
      }
    })());
    return;
  }

  if (data.type === 'CLEAR_PRIVATE') {
    event.waitUntil(Promise.all([caches.delete(TICKETS_CACHE), caches.delete(PAGE_CACHE)]));
  }
});

self.addEventListener('install', (event) => {
  isUpdate = Boolean(self.registration.active);
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
      caches.open(PAGE_CACHE).then((cache) => cache.addAll(CORE_PAGES))
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Exclude TICKETS_CACHE — it is version-independent and must never
            // be deleted during SW updates so offline ticket access is preserved.
            .filter((key) => key.startsWith('ihype-') && key !== STATIC_CACHE && key !== PAGE_CACHE && key !== TICKETS_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .then(async () => {
        if (!isUpdate) return;
        // Navigate all open windows to reload fresh content after an update.
        // Works even when the page code pre-dates the controllerchange listener.
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          try { client.navigate(client.url); } catch { /* older browser — page-side reload handles it */ }
        }
      })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cache QR code images from qrserver.com for offline ticket display.
  // These are cross-origin image requests embedded in /tickets/[id] pages.
  if (url.hostname === 'api.qrserver.com' && request.method === 'GET') {
    event.respondWith(cacheFirst(request, TICKETS_CACHE));
    return;
  }

  if (url.origin !== location.origin) return;

  /* BEFORE the network-only gate, not after. `/app` is network-only — it is a
     signed-in surface — and the ticket now lives under it, so the early return
     below used to swallow the one page this whole cache exists for. The wallet
     did not "work for tickets you had already opened", as the comments here
     claimed: it did not work at all, at any door, for any ticket. */
  if (request.destination === 'document' && isOfflinePrivatePage(url.pathname)) {
    // The one place a private page is stored on purpose — see the note on
    // NETWORK_ONLY_PATHS. Sign-out clears this cache.
    event.respondWith(networkWithCacheFallback(request, TICKETS_CACHE, { storePrivate: true }));
    return;
  }

  if (isNetworkOnly(url.pathname)) return;

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (request.destination === 'document' || url.pathname.endsWith('.html')) {
    // Ticket pages are handled above, before the network-only gate.
    // Show and artist pages: stale-while-revalidate (ticket availability changes)
    if (SWR_PATHS.some((p) => url.pathname.startsWith(p))) {
      event.respondWith(staleWhileRevalidate(request, PAGE_CACHE));
      return;
    }
    event.respondWith(networkWithCacheFallback(request, PAGE_CACHE));
    return;
  }

  event.respondWith(networkWithCacheFallback(request, STATIC_CACHE));
});

function isNetworkOnly(pathname) {
  return NETWORK_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * One holder's own ticket, at the URL the app actually serves it from.
 *
 * `/tickets/<id>` is a REDIRECT to `/app/me/tickets/<id>` and has been since
 * the MMM cutover, so every rule in this file that keyed on the old prefix was
 * keyed on a 307. Both are matched: the new path is what gets cached and
 * served, the old one still resolves for a link already in someone's inbox.
 *
 * The trailing segment is required. `/app/me/tickets` on its own is not a
 * detail page (there is no such route — the list lives at `/app/me?section=
 * tickets`), and an index of one account's tickets is exactly the thing the
 * 2026-09-02 sweep took OUT of the precache. One ticket, deliberately stored;
 * never the list.
 */
function isTicketDetail(pathname) {
  return /^\/app\/me\/tickets\/[^/]+$/.test(pathname) || /^\/tickets\/[^/]+$/.test(pathname);
}

/**
 * The door scanner for one show — the organiser's side of the same basement.
 *
 * `/app/me/shows/<slug>/scan` is where a venue checks tickets, and it is
 * behind the `/app` network-only gate like the ticket page. The scanner keeps
 * the show's guest list (hashed — see src/lib/door-manifest.ts) in the page's
 * own storage; what the worker has to provide is the page itself, with its
 * scripts, so the list can be READ with no signal. Stored only when the
 * organiser presses "Download for the door" (WARM_DOOR) or has opened the page
 * online, and cleared with the tickets on sign-out.
 */
function isDoorPage(pathname) {
  return /^\/app\/me\/shows\/[^/]+\/scan$/.test(pathname);
}

/** The two private pages this cache stores on purpose. Everything else under
 *  `/app` stays network-only. */
function isOfflinePrivatePage(pathname) {
  return isTicketDetail(pathname) || isDoorPage(pathname);
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }

  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (isCacheable(response)) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || (await networkFetch) || (await offlineFallback());
}

async function networkWithCacheFallback(request, cacheName, options = {}) {
  try {
    const response = await fetch(request);
    const storable = options.storePrivate ? Boolean(response && response.ok) : isCacheable(response);
    if (storable && request.method === 'GET') {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || (await offlineFallback());
  }
}

function isStaticAsset(pathname) {
  // Exclude .json — manifest.json is pre-cached in STATIC_ASSETS; other .json
  // files are typically API responses that must not be cached by the SW.
  return /\.(css|js|png|jpe?g|svg|webp|woff2?)$/i.test(pathname);
}

self.addEventListener('push', (event) => {
  let data = { title: 'iHYPE', body: 'Something new is happening on iHYPE.' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch { /* ignore */ }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // WORKBENCH_PATH. A push with no explicit url should open the app
      // surface, not the module deck the cutover moved off (row 269).
      data: { url: data.url || '/app/map' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/app/map';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

/**
 * The offline response.
 *
 * Prefers the real `/offline` page, which is design-mapped (Offline.dc.html),
 * translated, brand-tokened, and auto-retries with backoff — and which nothing
 * reached until this was wired up: the app had two offline experiences, and the
 * one users actually got was the crude inline copy below.
 *
 * The inline copy is kept, but only as the last resort it was always meant to
 * be. It covers the one case the cached page cannot: a visitor whose very first
 * request happens with no network, so `install` never ran and nothing is in the
 * cache. That is why this is not simply a redirect to `/offline` — a redirect
 * with nothing cached to redirect to is a dead end.
 */
/**
 * Every `/_next/static/...` script and stylesheet a page's HTML names, fetched
 * into the static cache if not already there. Fonts referenced from inside the
 * CSS are deliberately not chased: the fallback face still renders the ticket.
 */
async function warmPageAssets(html, statics) {
  const urls = new Set();
  for (const match of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.(?:js|css))"/g)) urls.add(match[1]);
  /* The RSC flight payload names a route's OWN client chunks as bare
     "static/chunks/…js" strings, never as script tags — measured 2026-09-10
     on the door page: its page chunk, the /app layout chunk and one shared
     chunk were loaded by the browser, referenced nowhere with src=, and so
     never stored; offline, React hydrated from the shared chunks, could not
     load the route's, and threw into the error boundary. The ticket page
     escaped this only because the wallet's <Link>s prefetch its chunk while
     online, which then lands in this cache by the ordinary cache-first rule;
     a page nothing links to on the same visit gets no such luck. Brackets in
     a dynamic segment are stored percent-encoded, because that is how the
     browser requests them. */
  for (const match of html.matchAll(/static\/chunks\/[^"'\\\s<>]+\.js/g)) {
    urls.add(`/_next/${match[0]}`.replace(/\[/g, '%5B').replace(/\]/g, '%5D'));
  }
  for (const url of urls) {
    try {
      if (await statics.match(url)) continue;
      const asset = await fetch(url);
      if (asset.ok) await statics.put(url, asset);
    } catch {
      // One missing chunk is one missing chunk; the rest still help.
    }
  }
}

async function offlineFallback() {
  try {
    const cached = await caches.match('/offline');
    if (cached) return cached;
  } catch {
    // Cache API unavailable (private mode, storage pressure) — fall through.
  }
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>iHYPE offline</title>
<style>
body{background:linear-gradient(115deg,#0d0610,#060813 48%,#051014);color:#f7f4ff;font-family:system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:2rem;text-align:center}
h1{font-size:2rem;margin:0 0 .75rem}
p{color:#aeb8d3;line-height:1.65;max-width:400px;margin:0 auto 1.5rem}
a{display:inline-block;padding:.8rem 1.5rem;background:linear-gradient(135deg,#ff4635,#ff3d87 44%,#39d8df);color:#fff;border-radius:99px;text-decoration:none;font-weight:800}
</style>
</head>
<body>
<div>
  <h1>You're offline.</h1>
  <p>iHYPE needs a connection to load this page.</p>
  <a href="/">Back to iHYPE</a>
</div>
</body>
</html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}
