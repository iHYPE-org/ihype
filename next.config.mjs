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
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
  "connect-src 'self' https://api.mux.com https://stream.mux.com https://*.mux.com",
  "frame-src 'self' https://*.mux.com",
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
  experimental: {
    workerThreads: true
  },
  async redirects() {
    return [
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
        destination: '/artists',
        permanent: false
      },
      {
        source: '/ihype-ticketing.html',
        destination: '/home',
        permanent: false
      },
      {
        source: '/ihype-show-creator.html',
        destination: '/promoters?module=show-creator',
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
        destination: '/artists?module=tour-creator',
        permanent: false
      },
      {
        source: '/ihype-show.html',
        destination: '/promoters?module=show-creator',
        permanent: false
      },
      {
        source: '/ihype-search.html',
        destination: '/artists',
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
        source: '/discover',
        destination: '/artists',
        permanent: false
      },
      {
        source: '/customizer',
        destination: '/home',
        permanent: false
      },
      {
        source: '/show-creator',
        destination: '/promoters?module=show-creator',
        permanent: false
      },
      {
        source: '/media',
        destination: '/artists',
        permanent: false
      },
      {
        source: '/search',
        destination: '/artists',
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
        destination: '/fans',
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
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=600' }]
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
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' }]
      },
      {
        source: '/forgot',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' }]
      },
      {
        source: '/media',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }]
      },
      {
        source: '/register/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' }]
      },
      {
        source: '/forgot',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }]
      },
      {
        source: '/media',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }]
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
      // /profile/:slug — cache headers set directly in the route handler
      // /shows/:slug   — handled by src/app/shows/[slug]/page.tsx (no static rewrite)
    ];
  }
};

const bundleAnalyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });
export default bundleAnalyzer(nextConfig);
