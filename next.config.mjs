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
        destination: '/home',
        permanent: false
      },
      {
        source: '/ihype-ticketing.html',
        destination: '/home',
        permanent: false
      },
      {
        source: '/ihype-show-creator.html',
        destination: '/home',
        permanent: false
      },
      {
        source: '/ihype-page-customizer.html',
        destination: '/home',
        permanent: false
      },
      {
        source: '/ihype-profile.html',
        destination: '/home',
        permanent: false
      },
      {
        source: '/ihype-media.html',
        destination: '/home',
        permanent: false
      },
      {
        source: '/ihype-show.html',
        destination: '/home',
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
        destination: '/home',
        permanent: true
      },
      {
        source: '/leaderboard',
        destination: '/home',
        permanent: true
      },
      {
        source: '/playlists/curated',
        destination: '/home',
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
        destination: '/home',
        permanent: true
      },
      {
        source: '/settings/data',
        destination: '/home',
        permanent: true
      },
      {
        source: '/workbench/analytics',
        destination: '/home',
        permanent: true
      },
      {
        source: '/workbench/tickets',
        destination: '/home',
        permanent: true
      },
      {
        source: '/artists',
        destination: '/home',
        permanent: true
      },
      {
        source: '/fans',
        destination: '/home',
        permanent: true
      },
      {
        source: '/promoters',
        destination: '/home',
        permanent: true
      },
      {
        source: '/venues',
        destination: '/home',
        permanent: true
      },
      {
        source: '/playlists',
        destination: '/home',
        permanent: true
      },
      {
        source: '/workbench',
        destination: '/home',
        permanent: true
      },
      {
        source: '/workbench/:path*',
        destination: '/home',
        permanent: true
      },
      {
        source: '/collab',
        destination: '/home',
        permanent: true
      },
      {
        source: '/customizer',
        destination: '/home',
        permanent: false
      },
      {
        source: '/show-creator',
        destination: '/home',
        permanent: false
      },
      {
        source: '/media',
        destination: '/home',
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
        destination: '/home',
        permanent: true
      },
      {
        source: '/listeners',
        destination: '/home',
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
