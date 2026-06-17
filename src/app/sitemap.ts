import type { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/utils';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // rebuild hourly

const base = getBaseUrl();

const STATIC: MetadataRoute.Sitemap = [
  { url: `${base}/`,          changeFrequency: 'weekly',  priority: 1.0 },
  { url: `${base}/about`,     changeFrequency: 'monthly', priority: 0.6 },
  { url: `${base}/artists`,   changeFrequency: 'daily',   priority: 0.8 },
  { url: `${base}/shows`,     changeFrequency: 'hourly',  priority: 0.9 },
  { url: `${base}/register`,  changeFrequency: 'monthly', priority: 0.7 },
  { url: `${base}/login`,     changeFrequency: 'monthly', priority: 0.5 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [artists, venues, shows] = await Promise.all([
    db.profile.findMany({
      where: { type: 'ARTIST' },
      select: { slug: true, updatedAt: true },
      orderBy: { hypeCount: 'desc' },
      take: 5000,
    }),
    db.profile.findMany({
      where: { type: 'VENUE' },
      select: { slug: true, updatedAt: true },
      orderBy: { hypeCount: 'desc' },
      take: 2000,
    }),
    db.show.findMany({
      where: { status: { not: 'CANCELED' } },
      select: { slug: true, updatedAt: true },
      orderBy: { startsAt: 'desc' },
      take: 5000,
    }),
  ]).catch(() => [[], [], []]);

  const artistEntries: MetadataRoute.Sitemap = artists
    .filter(p => p.slug)
    .map(p => ({ url: `${base}/artists/${p.slug}`, lastModified: p.updatedAt, changeFrequency: 'weekly', priority: 0.8 }));

  const venueEntries: MetadataRoute.Sitemap = venues
    .filter(p => p.slug)
    .map(p => ({ url: `${base}/venues/${p.slug}`, lastModified: p.updatedAt, changeFrequency: 'weekly', priority: 0.7 }));

  const showEntries: MetadataRoute.Sitemap = shows
    .filter(s => s.slug)
    .map(s => ({ url: `${base}/shows/${s.slug}`, lastModified: s.updatedAt, changeFrequency: 'daily', priority: 0.8 }));

  return [...STATIC, ...artistEntries, ...venueEntries, ...showEntries];
}
