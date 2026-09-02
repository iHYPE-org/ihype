import type { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/utils';

export default function robots(): MetadataRoute.Robots {
  const base = getBaseUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/home',
          '/app',
          '/pages',
          '/api/',
          '/auth/',
          '/login',
          '/register',
          '/fans',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
