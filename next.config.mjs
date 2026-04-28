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
  "style-src 'self' 'unsafe-inline'",
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
  async redirects() {
    return [
      {
        source: '/auth',
        destination: '/login',
        permanent: false
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
      {
        source: '/promise',
        destination: '/',
        permanent: false
      }
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/',           destination: '/ihype-homepage.html' },
        { source: '/login',      destination: '/ihype-auth.html' },
        { source: '/register',   destination: '/ihype-auth.html' },
        { source: '/hype',       destination: '/ihype-hype-engine.html' },
        { source: '/discover',   destination: '/ihype-rec-engine.html' },
        { source: '/tickets',    destination: '/ihype-ticketing.html' },
        { source: '/customizer',    destination: '/ihype-page-customizer.html' },
        { source: '/show-creator', destination: '/ihype-show-creator.html' },
        { source: '/home',         destination: '/ihype-home.html' }
      ],
      afterFiles: [],
      fallback: []
    };
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
      }
    ];
  }
};

export default nextConfig;
