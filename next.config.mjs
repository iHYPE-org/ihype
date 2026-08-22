import withBundleAnalyzer from '@next/bundle-analyzer';

/** @type {import('next').NextConfig} */
// src/middleware.ts sets Content-Security-Policy, X-Frame-Options,
// X-Content-Type-Options, Referrer-Policy, and Permissions-Policy on every
// route its matcher covers (everything except /api, /_next/static,
// /_next/image, and /favicon.ico) — CSP needs a fresh per-request nonce
// middleware alone can provide. Setting those same 5 headers here for
// '/:path*' too would send two values for each on every page (browsers often
// treat duplicate/conflicting header values as invalid rather than picking
// one, which can silently disable the protection instead of enforcing it).
// Keep this file's copies scoped to exactly the routes middleware excludes,
// and don't reintroduce them under '/:path*'.
const baselineSecurityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin'
  },
  {
    key: 'Cross-Origin-Resource-Policy',
    value: 'same-site'
  },
  {
    key: 'Origin-Agent-Cluster',
    value: '?1'
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'off'
  }
];

// Mirrors src/middleware.ts's non-CSP security headers, for the routes its
// matcher doesn't reach (API routes and static/image assets).
const middlewareExcludedRouteHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  webpack(config) {
    config.resolve.alias['@opentelemetry/instrumentation'] = false;
    // CF Workers doesn't support these Node built-ins; stub them so
    // @sentry/node integration files don't crash the Worker on cold start.
    config.resolve.alias['node:child_process'] = false;
    config.resolve.alias['node:readline'] = false;
    config.resolve.alias['child_process'] = false;
    config.resolve.alias['readline'] = false;
    return config;
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    // Restrict the optimizer to our own media host. A '**' wildcard turns
    // /_next/image into an open proxy that will fetch and re-serve any URL.
    remotePatterns: [
      { protocol: 'https', hostname: 'ihype.org' },
      { protocol: 'https', hostname: '*.ihype.org' }
    ]
  },
  outputFileTracingIncludes: {
    '/*': ['./node_modules/.prisma/client/*.wasm']
  },
  experimental: {
    workerThreads: true
  },
  async rewrites() {
    return [
      // Public shared-queue links live at /aux/:slug, but the route directory
      // is src/app/aux-queue — 'aux' is a reserved device name on Windows
      // (like con/nul/prn), so a folder named aux makes `git clone` fail to
      // check out the tree on every Windows machine. Keep the URL, rename the
      // directory, and never add a path segment named exactly aux/con/nul/
      // prn/com1-9/lpt1-9 anywhere in the repo.
      {
        source: '/aux/:slug',
        destination: '/aux-queue/:slug'
      }
    ];
  },
  async redirects() {
    return [
      // ── Compatibility aliases into Music · Map · Me ────────────────────
      //
      // Every one of these was a page whose whole body was `redirect(...)`, and
      // not one of them redirected. A `redirect()` under a `loading.tsx`
      // boundary cannot answer with a 307 — the shell is already streaming, so
      // Next emits a 200 carrying `<meta http-equiv="refresh" content="1;url=…">`
      // — and `src/app/loading.tsx` is such a boundary for EVERY route in the
      // app. Measured on production: `/shows/<slug>` returned 200 with a 42KB
      // body and a one-second meta refresh.
      //
      // So each of these was slower than a link, and invisible to anything that
      // does not execute the refresh: crawlers and link unfurlers saw an empty
      // shell. The `/app`, `/radio/live` and `/for-djs` entries above already
      // say this; these 39 are the rest of the set.
      //
      // A config redirect resolves in the router before any rendering, so it
      // cannot depend on render or streaming order.
      //
      // `permanent: false` throughout, matching `/promoters/:path*` above and
      // for the same reason: these are slug and section mappings, and a 308 is
      // cached by browsers effectively forever. If MMM's route shapes move
      // again, a permanent redirect would be unrecallable.
      //
      // Query strings carry across on their own — Next appends the incoming
      // query to the destination — so `/payouts?tab=history` and
      // `/legal?tab=privacy` keep their tab without an entry per value.
      { source: '/artists/:slug/analytics', destination: '/app/me/artists/:slug/analytics', permanent: false },
      { source: '/artists/:slug/believers', destination: '/app/me/artists/:slug/believers', permanent: false },
      { source: '/artists/:slug/dashboard', destination: '/app/me/artists/:slug/dashboard', permanent: false },
      { source: '/artists/:slug/epk', destination: '/app/me/artists/:slug/epk', permanent: false },
      { source: '/artists/:slug/onboarding', destination: '/app/me/artists/:slug/onboarding', permanent: false },
      { source: '/artists/:slug/presskit', destination: '/app/me/artists/:slug/epk', permanent: false },
      { source: '/artists/:slug', destination: '/app/artists/:slug', permanent: false },
      { source: '/venues/:slug/analytics', destination: '/app/me/venues/:slug/analytics', permanent: false },
      { source: '/venues/:slug/booking-inbox', destination: '/app/me/venues/:slug/booking-inbox', permanent: false },
      { source: '/venues/:slug/calendar', destination: '/app/me/venues/:slug/calendar', permanent: false },
      { source: '/venues/:slug/dashboard', destination: '/app/me/venues/:slug/dashboard', permanent: false },
      { source: '/venues/:slug/onboarding', destination: '/app/me/venues/:slug/onboarding', permanent: false },
      { source: '/venues/:slug', destination: '/app/venues/:slug', permanent: false },
      { source: '/fans/:slug', destination: '/app/fans/:slug', permanent: false },
      { source: '/shows/:slug/cancel', destination: '/app/me/shows/:slug/cancel', permanent: false },
      { source: '/shows/:slug/lineup', destination: '/app/me/shows/:slug/lineup', permanent: false },
      { source: '/shows/:slug/scan', destination: '/app/me/shows/:slug/scan', permanent: false },
      { source: '/shows/map', destination: '/app/map?layer=events', permanent: false },
      { source: '/playlist/:slug', destination: '/app/playlists/:slug', permanent: false },
      { source: '/tracks/:hexId', destination: '/app/tracks/:hexId', permanent: false },
      { source: '/tickets/:serializedId', destination: '/app/me/tickets/:serializedId', permanent: false },
      { source: '/tickets', destination: '/app/me?section=tickets', permanent: false },
      { source: '/payout/:id', destination: '/app/me/payouts/:id', permanent: false },
      { source: '/payouts', destination: '/app/me/payouts', permanent: false },
      { source: '/settings/accessibility', destination: '/app/me/accessibility', permanent: false },
      { source: '/settings', destination: '/app/me/settings', permanent: false },
      { source: '/pages', destination: '/app/me/profiles', permanent: false },
      { source: '/search', destination: '/app/music/discover?focus=search', permanent: false },
      { source: '/radio/station', destination: '/app/music/radio', permanent: false },
      { source: '/radio', destination: '/app/music/radio', permanent: false },
      { source: '/for-you', destination: '/app/music/recommended', permanent: false },
      { source: '/this-weekend', destination: '/app/map?layer=events', permanent: false },
      { source: '/community', destination: '/app/me?section=about', permanent: false },
      { source: '/events/new', destination: '/app/me/events/new', permanent: false },
      { source: '/me/analytics', destination: '/app/me', permanent: false },
      { source: '/me/booking', destination: '/app/me/booking', permanent: false },
      { source: '/me/dashboard', destination: '/app/me', permanent: false },
      { source: '/me/promote/analytics', destination: '/app/me', permanent: false },
      { source: '/me/promote', destination: '/app/me', permanent: false },
      {
        // A real `?tab=` is carried across explicitly. It has to be captured
        // and re-emitted rather than left to Next's query pass-through,
        // because the fallback below names `tab` in its OWN destination and a
        // destination's query wins over the incoming one — `/legal?tab=privacy`
        // landed on `terms`. Caught by curling every alias after the build;
        // nothing about the rule looks wrong reading it.
        //
        // `.+`, NOT `.*`, and the difference was a hard 500 on production for
        // bare `/legal` — a URL that ships in signup consent copy, the cookie
        // banner, sent email and the app-store listings. `.*` matches the empty
        // string, and OpenNext's `has` matcher (unlike Next's own, which
        // rejects an absent query before it ever runs the regex) therefore
        // accepted this rule for a request with no `tab` at all, captured
        // `tab: ''`, and handed that to path-to-regexp's `compile` — which
        // throws on an empty required param rather than emitting an empty one.
        // The thrown error became the 500. So it reproduced only on Workers,
        // and `next start` answered a clean 307 the whole time.
        //
        // Any `has` regex whose destination re-emits the capture must refuse
        // the empty string. `src/lib/__tests__/next-config-redirects.test.ts`
        // asserts that for every entry in this list.
        source: '/legal',
        has: [{ type: 'query', key: 'tab', value: '(?<tab>.+)' }],
        destination: '/info?tab=:tab',
        permanent: false
      },
      {
        // Bare `/legal` keeps the page's old default of `terms`. The config
        // cannot validate a value against the tab list the way the page did;
        // `/info` falls back on its own for one it does not recognise.
        source: '/legal',
        destination: '/info?tab=terms',
        permanent: false
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.ihype.org' }],
        destination: 'https://ihype.org/:path*',
        permanent: true
      },
      {
        // The Music/Map/Me shell's default surface. Done here rather than with a
        // `redirect()` in src/app/app/page.tsx: that page's layout renders the
        // shell (an async server component that awaits auth plus a DB read), and
        // in the Workerd build `/app` answered 200 with the shell already
        // flushed instead of redirecting — the thrown redirect never reached the
        // client. A config redirect is emitted before any rendering happens, so
        // it cannot depend on render or streaming order. If this entry is ever
        // removed, `/app` 404s loudly rather than rendering a shell with no
        // module in it.
        source: '/app',
        destination: '/app/map',
        permanent: false
      },
      {
        // /radio/live was a six-line page whose only body was
        // `redirect('/radio')` — the live player and saved shows are both
        // there. Moved here and the page deleted, for the same reason as the
        // `/app` entry above: a redirect thrown from a page can be streamed
        // after the response has begun, whereas a config redirect is emitted
        // before any rendering happens. Nothing in the app links here, so this
        // exists purely for URLs already in the wild.
        source: '/radio/live',
        destination: '/radio',
        permanent: false
      },
      {
        // The Radio Show Creator. Radio is computed per listener now
        // (src/lib/stations.ts) and advertising airs on the always-on station
        // (src/lib/station-breaks.ts), so there is nothing left for a person
        // to author — the studio and its DJ-only gate are gone.
        //
        // Redirected rather than left to 404 because this URL is in real
        // notification emails and in bookmarks belonging to the accounts that
        // used it. `permanent: false`: the role removal is finished, but this
        // is a surface decision, and a 308 is cached by browsers effectively
        // forever if it later turns out /radio is the wrong landing.
        source: '/radio/studio',
        destination: '/radio',
        permanent: false
      },
      {
        // The DJ profile surfaces. Every one of these gated on
        // `profile.type !== 'DJ' -> notFound()`, so the data migration in this
        // same deploy (20260806130000_reassign_dj_profiles) turns all of them
        // into 404s the moment it runs — there is no longer a DJ-typed row for
        // them to serve. The three profiles now live at /artists/[slug], which
        // already has the dashboard/analytics/onboarding equivalents.
        //
        // A catch-all so the subpages come along without four entries. Here
        // rather than as page-level `redirect()`s for the reason /app and
        // /for-djs are: a server-component redirect streams as a 200 carrying a
        // NEXT_REDIRECT marker, which browsers follow but crawlers do not, and
        // these are public indexable profile URLs.
        //
        // `permanent: false` deliberately, despite the role not coming back:
        // the destination is a *slug* mapping, and a 308 is cached by browsers
        // effectively forever — if any of these three slugs is ever reassigned,
        // a permanent redirect would be unrecallable.
        source: '/promoters/:path*',
        destination: '/artists/:path*',
        permanent: false
      },
      {
        // Was already an alias — it redirected to /promoters/[slug], which now
        // redirects onward. Pointed straight at the destination instead, so
        // this is one hop rather than two.
        source: '/djs/:path*',
        destination: '/artists/:path*',
        permanent: false
      },
      {
        // The DJ recruiting kit. The role is being removed
        // (docs/dj-role-removal-scope.md, signed off 2026-08-05) and there is
        // no DJ option left at /join or /register, so this recruits for
        // something that cannot be joined.
        //
        // Here rather than as a `redirect()` in the page, for the same reason
        // as /app above: a server-component redirect streams as a 200 with a
        // NEXT_REDIRECT marker, which a browser follows but a crawler does not.
        // This is a public, indexable marketing URL, so it needs a real 308.
        // Permanent because the role is not coming back.
        source: '/for-djs',
        destination: '/for-artists',
        permanent: true
      },
      {
        source: '/auth',
        destination: '/login',
        permanent: false
      },
      {
        source: '/ihype-auth.html',
        destination: '/login',
        permanent: false
      },
      {
        source: '/ihype-login.html',
        destination: '/login',
        permanent: false
      },
      {
        source: '/ihype-register.html',
        destination: '/register',
        permanent: false
      },
      {
        source: '/ihype-forgot.html',
        destination: '/forgot',
        permanent: false
      },
      {
        source: '/ihype-home.html',
        destination: '/',
        permanent: false
      },
      {
        source: '/ihype-homepage.html',
        destination: '/',
        permanent: false
      },
      {
        source: '/ihype-promise.html',
        destination: '/',
        permanent: false
      },
      {
        source: '/index.html',
        destination: '/',
        permanent: false
      },
      {
        source: '/ihype-hype-engine.html',
        destination: '/',
        permanent: false
      },
      {
        source: '/ihype-rec-engine.html',
        destination: '/app/map',
        permanent: false
      },
      {
        source: '/ihype-ticketing.html',
        destination: '/app/map',
        permanent: false
      },
      {
        source: '/ihype-show-creator.html',
        destination: '/app/map',
        permanent: false
      },
      {
        source: '/ihype-page-customizer.html',
        destination: '/app/map',
        permanent: false
      },
      {
        source: '/ihype-profile.html',
        destination: '/app/map',
        permanent: false
      },
      {
        source: '/ihype-media.html',
        destination: '/app/map',
        permanent: false
      },
      {
        source: '/ihype-show.html',
        destination: '/app/map',
        permanent: false
      },
      {
        source: '/ihype-search.html',
        destination: '/search',
        permanent: false
      },
      {
        source: '/ihype-governance.html',
        destination: '/about',
        permanent: false
      },
      {
        source: '/ihype-investor.html',
        destination: '/about',
        permanent: false
      },
      {
        source: '/ihype-beta.html',
        destination: '/beta',
        permanent: false
      },
      {
        source: '/trending',
        destination: '/app/map',
        permanent: true
      },
      {
        source: '/leaderboard',
        destination: '/app/map',
        permanent: true
      },
      {
        source: '/playlists/curated',
        destination: '/app/map',
        permanent: true
      },
      {
        source: '/admin/reports',
        destination: '/admin/review?tab=reports',
        permanent: true
      },
      {
        source: '/admin/verifications',
        destination: '/admin/review?tab=verifications',
        permanent: true
      },
      {
        source: '/admin/duplicates',
        destination: '/admin/review?tab=duplicates',
        permanent: true
      },
      {
        source: '/admin/rate-limits',
        destination: '/status',
        permanent: true
      },
      {
        source: '/settings/notifications',
        destination: '/app/map',
        permanent: true
      },
      {
        source: '/settings/data',
        destination: '/app/map',
        permanent: true
      },
      {
        source: '/workbench/analytics',
        destination: '/app/map',
        permanent: true
      },
      {
        source: '/workbench/tickets',
        destination: '/app/map',
        permanent: true
      },
      {
        source: '/artists',
        destination: '/app/map',
        permanent: true
      },
      {
        source: '/fans',
        destination: '/app/map',
        permanent: true
      },
      {
        source: '/promoters',
        destination: '/app/map',
        permanent: true
      },
      {
        source: '/venues',
        destination: '/app/map',
        permanent: true
      },
      {
        source: '/playlists',
        destination: '/app/map',
        permanent: true
      },
      {
        source: '/workbench',
        destination: '/app/map',
        permanent: true
      },
      {
        source: '/workbench/:path*',
        destination: '/app/map',
        permanent: true
      },
      {
        source: '/collab',
        destination: '/app/map',
        permanent: true
      },
      {
        source: '/customizer',
        destination: '/app/map',
        permanent: false
      },
      {
        source: '/show-creator',
        destination: '/app/map',
        permanent: false
      },
      {
        source: '/media',
        destination: '/app/map',
        permanent: false
      },
      {
        source: '/governance',
        destination: '/about',
        permanent: false
      },
      {
        source: '/investor',
        destination: '/about',
        permanent: false
      },
      {
        source: '/hype',
        destination: '/',
        permanent: false
      },
      {
        source: '/trust',
        destination: '/about',
        permanent: false
      },
      {
        source: '/promise',
        destination: '/about',
        permanent: false
      },
      {
        source: '/integrity',
        destination: '/about',
        permanent: false
      },
      {
        source: '/launch-readiness',
        destination: '/',
        permanent: false
      },
      {
        source: '/dashboard',
        destination: '/app/map',
        permanent: true
      },
      {
        source: '/listeners',
        destination: '/app/map',
        permanent: true
      },
      {
        source: '/listeners/:slug',
        destination: '/fans/:slug',
        permanent: true
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: baselineSecurityHeaders
      },
      {
        source: '/api/:path*',
        headers: middlewareExcludedRouteHeaders
      },
      {
        source: '/_next/static/:path*',
        headers: middlewareExcludedRouteHeaders
      },
      {
        source: '/_next/image/:path*',
        headers: middlewareExcludedRouteHeaders
      },
      {
        source: '/favicon.ico',
        headers: middlewareExcludedRouteHeaders
      },
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store' }]
      },
      {
        source: '/:path*.html',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }]
      },
      {
        source: '/',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }]
      },
      {
        source: '/promise',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }]
      },
      {
        source: '/home',
        headers: [{ key: 'Cache-Control', value: 'no-store' }]
      },
      {
        source: '/listen',
        headers: [{ key: 'Cache-Control', value: 'no-store' }]
      },
      {
        source: '/hype',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }]
      },
      {
        source: '/tickets',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }]
      },
      {
        source: '/login',
        headers: [{ key: 'Cache-Control', value: 'no-store' }]
      },
      {
        source: '/api/auth/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }]
      },

      {
        source: '/forgot',
        headers: [{ key: 'Cache-Control', value: 'no-store' }]
      },
      {
        source: '/media',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }]
      },
      {
        source: '/register/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }]
      },
      {
        source: '/search',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=600' }]
      },
      {
        source: '/governance',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=600' }]
      },
      {
        source: '/investor',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }]
      },
      {
        source: '/artists/:slug',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' }]
      },
      {
        source: '/shows/:slug',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=30, stale-while-revalidate=120' }]
      },
      {
        source: '/venues/:slug',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' }]
      },
      {
        source: '/fans/:slug',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' }]
      },
      // /profile/:slug — cache headers set directly in the route handler
    ];
  }
};

const bundleAnalyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });
export default bundleAnalyzer(nextConfig);
