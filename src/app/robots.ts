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
          '/listen',
          '/pages',
          '/api/',
          '/auth/',
          '/login',
          '/register',
          '/logout',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
