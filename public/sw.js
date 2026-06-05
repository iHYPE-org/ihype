const CACHE_VERSION = 'ihype-dc713da';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

const CORE_PAGES = [
  '/',
  '/shows',
  '/hype',
  '/tickets'
];

const NETWORK_ONLY_PATHS = [
  '/home',
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

self.addEventListener('install', (event) => {
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
            .filter((key) => key.startsWith('ihype-') && key !== STATIC_CACHE && key !== PAGE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== location.origin) return;
  if (isNetworkOnly(url.pathname)) return;

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (request.destination === 'document' || url.pathname.endsWith('.html')) {
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

  return cached || (await networkFetch) || offlineFallback();
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
    return cached || offlineFallback();
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
      data: { url: data.url || '/home' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/home';
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

function offlineFallback() {
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
  <p>iHYPE needs a connection to load this page. Try going back to the Promise.</p>
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
