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
