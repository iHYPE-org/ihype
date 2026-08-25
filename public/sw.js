const CACHE_VERSION = 'ihype-ca2fdf5e';
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
  '/hype',
  '/tickets',
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
  '/api'
];

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

  if (data.type === 'WARM_TICKETS' && Array.isArray(data.paths)) {
    event.waitUntil((async () => {
      const cache = await caches.open(TICKETS_CACHE);
      // Sequential and individually guarded: cache.addAll rejects the whole
      // batch if any one request fails, and a single expired ticket must not
      // cost the holder every other one.
      for (const path of data.paths.slice(0, 50)) {
        if (typeof path !== 'string' || !path.startsWith('/tickets/')) continue;
        try {
          const response = await fetch(path, { credentials: 'same-origin' });
          if (response.ok) await cache.put(path, response.clone());
        } catch {
          // Offline already, or the ticket is gone. Nothing to do.
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
  if (isNetworkOnly(url.pathname)) return;

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (request.destination === 'document' || url.pathname.endsWith('.html')) {
    // Individual purchased ticket pages — network-first, fall back to cache
    // so the holder can show their QR at the venue door with no connectivity.
    if (url.pathname.startsWith('/tickets/')) {
      event.respondWith(networkWithCacheFallback(request, TICKETS_CACHE));
      return;
    }
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
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || (await networkFetch) || (await offlineFallback());
}

async function networkWithCacheFallback(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
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
