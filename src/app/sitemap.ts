import type { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/utils';
import { db } from '@/lib/db';
import { getDemoCreatorExclusion, getDemoOwnerExclusion } from '@/lib/runtime-flags';
import type { ShowStatus } from '@prisma/client';

/**
 * Which shows belong in the sitemap. Deliberately WIDER than
 * `PUBLIC_SHOW_STATUSES` in `@/lib/profile-detail`: that answers "is this show
 * upcoming", and a past show is still a page worth indexing. What is excluded
 * is the show nobody may see (DRAFT) and the one that is not happening
 * (CANCELED).
 */
const INDEXABLE_SHOW_STATUSES: ShowStatus[] = ['SCHEDULED', 'LIVE', 'ENDED'];

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // rebuild hourly

const base = getBaseUrl();

const STATIC: MetadataRoute.Sitemap = [
  { url: `${base}/`,               changeFrequency: 'weekly',  priority: 1.0 },
  { url: `${base}/shows`,          changeFrequency: 'hourly',  priority: 0.9 },
  { url: `${base}/discover`,       changeFrequency: 'hourly',  priority: 0.8 },
  { url: `${base}/radio`,          changeFrequency: 'daily',   priority: 0.7 },
  { url: `${base}/this-weekend`,   changeFrequency: 'daily',   priority: 0.7 },
  { url: `${base}/for-you`,        changeFrequency: 'daily',   priority: 0.6 },
  { url: `${base}/journal`,        changeFrequency: 'weekly',  priority: 0.6 },
  { url: `${base}/community`,      changeFrequency: 'weekly',  priority: 0.5 },
  { url: `${base}/community-rules`, changeFrequency: 'monthly', priority: 0.3 },
  { url: `${base}/info`,           changeFrequency: 'monthly', priority: 0.5 },
  { url: `${base}/walkthrough`,    changeFrequency: 'monthly', priority: 0.4 },
  { url: `${base}/advertise`,      changeFrequency: 'monthly', priority: 0.5 },
  { url: `${base}/support`,        changeFrequency: 'monthly', priority: 0.4 },
  { url: `${base}/launch`,         changeFrequency: 'monthly', priority: 0.4 },
  { url: `${base}/ticket-policy`,  changeFrequency: 'monthly', priority: 0.3 },
  { url: `${base}/copyright`,      changeFrequency: 'monthly', priority: 0.3 },
  { url: `${base}/delete-account`, changeFrequency: 'monthly', priority: 0.3 },
  { url: `${base}/dmca`,           changeFrequency: 'monthly', priority: 0.3 },
  /* `/register` and `/login` are NOT here, and that is not an oversight:
     `robots.ts` disallows both. Submitting a URL in the sitemap that robots.txt
     forbids is a contradiction search engines report as an error, and it was
     doing it for the two highest-priority entries in the list. `/join` is the
     indexable way in — it is allowed, and it is the page that explains the
     roles before asking for anything. */
  { url: `${base}/join`,           changeFrequency: 'monthly', priority: 0.6 },
  { url: `${base}/for-artists`,    changeFrequency: 'monthly', priority: 0.6 },
  { url: `${base}/for-venues`,     changeFrequency: 'monthly', priority: 0.6 },
  { url: `${base}/for-fans`,       changeFrequency: 'monthly', priority: 0.6 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /**
   * The sitemap must not offer search engines a URL the page itself refuses to
   * render. It was doing exactly that in two ways:
   *
   *  - **DRAFT shows were submitted to Google.** The filter was
   *    `status: { not: 'CANCELED' }`, which includes DRAFT — and a draft's page
   *    404s for everyone but its creator (`canViewShow`). So the sitemap
   *    published the existence and URL of unannounced shows, and every one of
   *    them was a crawl that ended in a 404. ENDED shows stay: a past show is a
   *    real page worth indexing, which is not the same as an unannounced one.
   *  - **Demo accounts were submitted too.** Profiles were selected on `type`
   *    alone, with no `getDemoCreatorExclusion()` and no demo-owner check,
   *    while both profile pages 404 a demo profile whenever
   *    `shouldHideDemoContent()` is on. The launch seed created those accounts,
   *    so this is not hypothetical.
   */
  const [artists, venues, shows] = await Promise.all([
    db.profile.findMany({
      where: { type: 'ARTIST', ...getDemoOwnerExclusion() },
      select: { slug: true, updatedAt: true },
      orderBy: { hypeCount: 'desc' },
      take: 5000,
    }),
    db.profile.findMany({
      where: { type: 'VENUE', ...getDemoOwnerExclusion() },
      select: { slug: true, updatedAt: true },
      orderBy: { hypeCount: 'desc' },
      take: 2000,
    }),
    db.show.findMany({
      where: {
        status: { in: INDEXABLE_SHOW_STATUSES },
        ...getDemoCreatorExclusion(),
      },
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
