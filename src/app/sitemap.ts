import type { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/utils';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // rebuild hourly

const base = getBaseUrl();

const STATIC: MetadataRoute.Sitemap = [
  { url: `${base}/`,               changeFrequency: 'weekly',  priority: 1.0 },
  { url: `${base}/about`,          changeFrequency: 'monthly', priority: 0.6 },
  { url: `${base}/shows`,          changeFrequency: 'hourly',  priority: 0.9 },
  { url: `${base}/discover`,       changeFrequency: 'hourly',  priority: 0.8 },
  { url: `${base}/radio`,          changeFrequency: 'daily',   priority: 0.7 },
  { url: `${base}/this-weekend`,   changeFrequency: 'daily',   priority: 0.7 },
  { url: `${base}/for-you`,        changeFrequency: 'daily',   priority: 0.6 },
  { url: `${base}/journal`,        changeFrequency: 'weekly',  priority: 0.6 },
  { url: `${base}/community`,      changeFrequency: 'weekly',  priority: 0.5 },
  { url: `${base}/community-rules`, changeFrequency: 'monthly', priority: 0.3 },
  { url: `${base}/charter`,        changeFrequency: 'monthly', priority: 0.6 },
  { url: `${base}/transparency`,   changeFrequency: 'monthly', priority: 0.5 },
  { url: `${base}/audit`,          changeFrequency: 'monthly', priority: 0.4 },
  { url: `${base}/walkthrough`,    changeFrequency: 'monthly', priority: 0.4 },
  { url: `${base}/advertise`,      changeFrequency: 'monthly', priority: 0.5 },
  { url: `${base}/support`,        changeFrequency: 'monthly', priority: 0.4 },
  { url: `${base}/launch`,         changeFrequency: 'monthly', priority: 0.4 },
  { url: `${base}/ticket-policy`,  changeFrequency: 'monthly', priority: 0.3 },
  { url: `${base}/copyright`,      changeFrequency: 'monthly', priority: 0.3 },
  { url: `${base}/dmca`,           changeFrequency: 'monthly', priority: 0.3 },
  { url: `${base}/register`,       changeFrequency: 'monthly', priority: 0.7 },
  { url: `${base}/login`,          changeFrequency: 'monthly', priority: 0.5 },
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
