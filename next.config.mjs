import withBundleAnalyzer from '@next/bundle-analyzer';

/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production';
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://js.stripe.com${isProduction ? '' : " 'unsafe-eval'"}`,
  "connect-src 'self' https://challenges.cloudflare.com https://api.stripe.com",
  "frame-src 'self' https://challenges.cloudflare.com https://js.stripe.com",
  'upgrade-insecure-requests'
].join('; ');

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
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
    value: 'camera=(), microphone=(self), geolocation=()'
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
  },
  {
    key: 'Content-Security-Policy',
    value: contentSecurityPolicy
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
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  },
  outputFileTracingIncludes: {
    '/*': ['./node_modules/.prisma/client/*.wasm']
  },
  experimental: {
    workerThreads: true
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
        destination: '/home',
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
        destination: '/',
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
        source: '/settings',
        destination: '/home',
        permanent: true
      },
      {
        source: '/discover',
        destination: '/home',
        permanent: true
      },
      {
        source: '/radio',
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
        source: '/search',
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
        source: '/beta',
        destination: '/',
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
        headers: securityHeaders
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
