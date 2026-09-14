import type { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/utils';
import { db } from '@/lib/db';
import { getDemoCreatorExclusion } from '@/lib/runtime-flags';
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

/* WHAT A CRAWLER CAN ACTUALLY READ, AND NOTHING ELSE.
 *
 * Six entries were removed on 2026-09-14 because `robots.txt` forbids where
 * they land, which is the same contradiction the note below records fixing for
 * `/register` and `/login` — that fix went to the two URLs named at the time
 * rather than to the rule, so it came back. Measured against production:
 *
 *   /shows         404 signed in, 307 to /login signed out — the route is gone,
 *   /discover      404 — deleted 2026-08-18 and not even aliased,
 *   /radio         307 -> /app/music/radio      \
 *   /this-weekend  307 -> /app/map              |  all four land under /app,
 *   /for-you       307 -> /app/music/recommended|  which robots disallows.
 *   /community     307 -> /app/me/info/community/
 *
 * `npm run audit:published-urls` is the gate that keeps them out; it reads this
 * file, the route tree, `next.config.mjs` and `robots.ts` rather than restating
 * any of them.
 *
 * ANSWERED 2026-09-14, and that is why there are no artist or venue entries
 * below. Every artist and every venue used to be submitted as
 * `/artists|venues/<slug>`, both of which 307 into `/app` — the same
 * contradiction as the six above, left in place only because the reason was a
 * product decision rather than a mistake and the decision had not been made.
 * The owner made it: "no access to anything without an account post sign in
 * (we want to prevent any unauthorized bullshit)". So the panes stay behind
 * auth, the entries are wrong, and they are gone; `audit:published-urls` is a
 * gate at 0 rather than a budget of 2.
 *
 * WHAT THIS COSTS, stated because it is a real cost and not an oversight: no
 * artist or venue page is indexable, so search engines cannot send anyone to
 * one. That is the accepted price of the closed alpha. The shows below are the
 * exception and must stay — `/shows/[slug]` renders logged out on purpose,
 * because it is the URL that sells tickets, and removing it would leave the
 * product with no crawlable page about anything happening. Reopen this only
 * with a decision to make the panes public, and change the auth gate in the
 * same breath; a sitemap entry cannot make a page readable. */
const STATIC: MetadataRoute.Sitemap = [
  { url: `${base}/`,               changeFrequency: 'weekly',  priority: 1.0 },
  { url: `${base}/journal`,        changeFrequency: 'weekly',  priority: 0.6 },
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
   *    so this is not hypothetical. Profiles are no longer listed at all (see
   *    the block above), so only the show query carries an exclusion now — but
   *    the rule is the reason, not the query: anything added here needs one.
   */
  /* One query, so no `Promise.all`: it held three until the artist and venue
     lists came out, and a one-element all() with a `[[]]` catch is a shape
     that invites a wrong index the next time something is added back. */
  const shows = await db.show.findMany({
    where: {
      status: { in: INDEXABLE_SHOW_STATUSES },
      ...getDemoCreatorExclusion(),
    },
    select: { slug: true, updatedAt: true },
    orderBy: { startsAt: 'desc' },
    take: 5000,
  }).catch(() => []);

  const showEntries: MetadataRoute.Sitemap = shows
    .filter(s => s.slug)
    .map(s => ({ url: `${base}/shows/${s.slug}`, lastModified: s.updatedAt, changeFrequency: 'daily', priority: 0.8 }));

  return [...STATIC, ...showEntries];
}
