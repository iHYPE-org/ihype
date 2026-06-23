/**
 * iHYPE Service Worker — sw.js
 * Precaches the app shell + offline fallback.
 * Serves stale-while-revalidate for feed requests.
 *
 * Registration: add to index.html (or any entry point):
 *   <script>
 *     if ('serviceWorker' in navigator) {
 *       navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(console.warn);
 *     }
 *   </script>
 */

const VERSION = 'ihype-v1';

// App shell — precache on install
const PRECACHE = [
  '/',
  '/offline.html',
  '/styles.css',
  '/lib/api.js',
  '/lib/db.js',
  '/ui_kits/fan-app/index.html',
  '/ui_kits/fan-app/data.js',
  '/assets/logo/favicon.svg',
];

// Network-first routes (always try network; fallback to cache)
const NETWORK_FIRST = [
  '/v1/feed/',
  '/v1/events',
  '/v1/charts/',
];

// Cache-first routes (serve from cache; revalidate in bg)
const CACHE_FIRST = [
  '/styles.css',
  '/lib/',
  '/assets/',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

/* ── Install: precache app shell ──────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

/* ── Activate: clear old caches ───────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: routing strategy ──────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  // Network-first (API feeds)
  if (NETWORK_FIRST.some(p => url.pathname.startsWith(p))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first (static assets, fonts)
  if (CACHE_FIRST.some(p => url.pathname.startsWith(p) || url.hostname.includes(p))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Stale-while-revalidate (HTML pages)
  event.respondWith(staleWhileRevalidate(request));
});

/* ── Strategy helpers ─────────────────────────────────────────────── */
async function networkFirst(request) {
  try {
    const res = await fetch(request);
    const cache = await caches.open(VERSION);
    cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match('/offline.html');
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    const cache = await caches.open(VERSION);
    cache.put(request, res.clone());
    return res;
  } catch {
    return caches.match('/offline.html');
  }
}

async function staleWhileRevalidate(request) {
  const cache  = await caches.open(VERSION);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(res => {
    cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || networkPromise || caches.match('/offline.html');
}

/* ── Push notifications ────────────────────────────────────────────── */
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'iHYPE', {
      body:  data.body  || '',
      icon:  '/assets/logo/favicon.svg',
      badge: '/assets/logo/favicon.svg',
      data:  data,
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(wins => {
      if (wins.length > 0) { wins[0].focus(); return; }
      clients.openWindow('/ui_kits/fan-app/index.html');
    })
  );
});
