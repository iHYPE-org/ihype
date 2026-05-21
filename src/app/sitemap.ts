import type { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const base = getBaseUrl();

// Sitemap index — Next 16 renders this as an index referencing the named
// sub-sitemaps when entries have only `url` pointing to other sitemap XMLs.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    { url: `${base}/sitemap-static.xml`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/sitemap-artists.xml`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/sitemap-venues.xml`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/sitemap-shows.xml`, changeFrequency: 'hourly', priority: 0.9 }
  ];
}
