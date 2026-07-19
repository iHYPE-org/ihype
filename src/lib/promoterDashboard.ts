import { db } from '@/lib/db';
import { getBaseUrl } from '@/lib/utils';

export type PromotableShow = {
  slug: string;
  title: string;
  startsAt: string | null;
  venueName: string | null;
  promoterPayoutPercent: number;
  promoLink: string;
};

export type PromoterDashboard = {
  hasProfile: boolean;
  refHexId: string | null;
  clicks: number;
  ordersDriven: number;
  ticketsSold: number;
  grossRevenueCents: number;
  earnedCents: number;        // attributed promoter payout (settlement pending)
  shows: PromotableShow[];
};

const EMPTY: PromoterDashboard = {
  hasProfile: false,
  refHexId: null,
  clicks: 0,
  ordersDriven: 0,
  ticketsSold: 0,
  grossRevenueCents: 0,
  earnedCents: 0,
  shows: [],
};

/**
 * Builds the fan-facing share-to-earn dashboard: the user's promo ref, their
 * attributed promotion performance (clicks → orders → earned promoter pool
 * share), and the list of upcoming ticketed shows they can promote.
 *
 * The attribution + payout math already runs at checkout
 * (TicketOrder.affiliatePromoterProfileId / promoterPayoutCents); this just
 * surfaces it. Actual cash settlement is gated on Stripe (deferred), so
 * earnedCents is labeled as pending in the UI.
 */
export async function getPromoterDashboard(userId: string): Promise<PromoterDashboard> {
  const profiles = await db.profile.findMany({
    where: { ownerId: userId },
    select: { id: true, hexId: true, type: true },
    orderBy: { createdAt: 'asc' },
  }).catch(() => [] as { id: string; hexId: string; type: string }[]);

  if (profiles.length === 0) return EMPTY;

  const profileIds = profiles.map((p: { id: string }) => p.id);
  const hexIds = profiles.map((p: { hexId: string }) => p.hexId);
  // Same primary-profile choice the referral endpoint uses.
  const primary = profiles.find((p: { type: string }) => p.type === 'LISTENER') ?? profiles[0];
  const refHexId = primary?.hexId ?? null;
  const baseUrl = getBaseUrl();

  const [orders, clicks, upcoming] = await Promise.all([
    db.ticketOrder.findMany({
      where: {
        affiliatePromoterProfileId: { in: profileIds },
        status: { in: ['CAPTURED', 'RESERVED'] },
      },
      select: { subtotalCents: true, quantity: true, promoterPayoutCents: true },
    }).catch(() => [] as { subtotalCents: number; quantity: number; promoterPayoutCents: number }[]),
    db.auditLog.count({
      where: {
        action: { in: ['referral_click', 'affiliate_link_click'] },
        OR: [{ entityId: { in: hexIds } }, { entityId: { in: profileIds } }],
      },
    }).catch(() => 0),
    db.show.findMany({
      where: {
        isTicketed: true,
        status: { in: ['SCHEDULED', 'LIVE'] },
        startsAt: { gte: new Date() },
      },
      orderBy: { startsAt: 'asc' },
      take: 20,
      select: {
        slug: true, title: true, startsAt: true, promoterPayoutPercent: true,
        venueProfile: { select: { name: true } },
      },
    }).catch(() => [] as {
      slug: string; title: string; startsAt: Date | null;
      promoterPayoutPercent: number; venueProfile: { name: string } | null;
    }[]),
  ]);

  const ordersDriven = orders.length;
  const ticketsSold = orders.reduce((sum: number, o: { quantity: number }) => sum + o.quantity, 0);
  const grossRevenueCents = orders.reduce((sum: number, o: { subtotalCents: number }) => sum + o.subtotalCents, 0);
  const earnedCents = orders.reduce((sum: number, o: { promoterPayoutCents: number }) => sum + o.promoterPayoutCents, 0);

  const shows: PromotableShow[] = refHexId
    ? upcoming
        .filter((s: { slug: string | null }) => !!s.slug)
        .map((s: { slug: string; title: string; startsAt: Date | null; promoterPayoutPercent: number; venueProfile: { name: string } | null }) => ({
          slug: s.slug,
          title: s.title,
          startsAt: s.startsAt ? s.startsAt.toISOString() : null,
          venueName: s.venueProfile?.name ?? null,
          promoterPayoutPercent: s.promoterPayoutPercent,
          promoLink: `${baseUrl}/shows/${s.slug}?ref=${refHexId}`,
        }))
    : [];

  return {
    hasProfile: true,
    refHexId,
    clicks,
    ordersDriven,
    ticketsSold,
    grossRevenueCents,
    earnedCents,
    shows,
  };
}

export type PromoterAnalyticsRange = '7d' | '30d' | 'ytd';

export type EarningsBucket = {
  label: string;
  earnedCents: number;
};

export type TopPromoterLink = {
  hexId: string;
  profileType: string;
  clicks: number;
  ticketsSold: number;
  earnedCents: number;
};

function rangeStart(range: PromoterAnalyticsRange, now: Date): Date {
  if (range === '7d') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (range === 'ytd') {
    return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
}

/**
 * Buckets this user's real promoterPayoutCents (across all owned profiles'
 * affiliate attribution) into a small number of time buckets for the
 * earnings-over-time chart. Bucket width scales with the selected range so
 * the bar count stays readable (daily for 7d, weekly for 30d, monthly for
 * YTD) — all from real TicketOrder rows, no synthetic data.
 */
export async function getPromoterEarningsSeries(
  userId: string,
  range: PromoterAnalyticsRange
): Promise<EarningsBucket[]> {
  const profiles = await db.profile.findMany({
    where: { ownerId: userId },
    select: { id: true },
  }).catch(() => [] as { id: string }[]);
  if (profiles.length === 0) return [];

  const profileIds = profiles.map((p: { id: string }) => p.id);
  const now = new Date();
  const start = rangeStart(range, now);

  const orders = await db.ticketOrder.findMany({
    where: {
      affiliatePromoterProfileId: { in: profileIds },
      status: { in: ['CAPTURED', 'RESERVED'] },
      createdAt: { gte: start },
    },
    select: { createdAt: true, promoterPayoutCents: true },
  }).catch(() => [] as { createdAt: Date; promoterPayoutCents: number }[]);

  const bucketMs = range === '7d' ? 24 * 60 * 60 * 1000 : range === '30d' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  const bucketCount = range === '7d' ? 7 : range === '30d' ? 5 : 12;

  const buckets: EarningsBucket[] = [];
  for (let i = bucketCount - 1; i >= 0; i--) {
    const bucketEnd = new Date(now.getTime() - i * bucketMs);
    const bucketStart = new Date(bucketEnd.getTime() - bucketMs);
    const earnedCents = orders
      .filter((o: { createdAt: Date }) => o.createdAt >= bucketStart && o.createdAt < bucketEnd)
      .reduce((sum: number, o: { promoterPayoutCents: number }) => sum + o.promoterPayoutCents, 0);
    const label = range === '7d'
      ? bucketEnd.toLocaleDateString('en-US', { weekday: 'short' })
      : range === '30d'
        ? `Wk of ${bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : bucketEnd.toLocaleDateString('en-US', { month: 'short' });
    buckets.push({ label, earnedCents });
  }
  return buckets;
}

/**
 * Per-HYPE-Link (per owned profile) breakdown of clicks/tickets/earnings —
 * the "top-performing links" list. A user with a single profile has a single
 * link; users with multiple profiles (e.g. a fan profile plus an artist
 * profile) can see which one is actually driving activity. Lifetime, same
 * window as the main dashboard totals.
 */
export async function getPromoterTopLinks(userId: string): Promise<TopPromoterLink[]> {
  const profiles = await db.profile.findMany({
    where: { ownerId: userId },
    select: { id: true, hexId: true, type: true },
  }).catch(() => [] as { id: string; hexId: string; type: string }[]);
  if (profiles.length === 0) return [];

  const links = await Promise.all(
    profiles.map(async (p: { id: string; hexId: string; type: string }) => {
      const [clicks, orders] = await Promise.all([
        db.auditLog.count({
          where: {
            action: { in: ['referral_click', 'affiliate_link_click'] },
            OR: [{ entityId: p.hexId }, { entityId: p.id }],
          },
        }).catch(() => 0),
        db.ticketOrder.findMany({
          where: {
            affiliatePromoterProfileId: p.id,
            status: { in: ['CAPTURED', 'RESERVED'] },
          },
          select: { quantity: true, promoterPayoutCents: true },
        }).catch(() => [] as { quantity: number; promoterPayoutCents: number }[]),
      ]);
      const ticketsSold = orders.reduce((sum: number, o: { quantity: number }) => sum + o.quantity, 0);
      const earnedCents = orders.reduce((sum: number, o: { promoterPayoutCents: number }) => sum + o.promoterPayoutCents, 0);
      return { hexId: p.hexId, profileType: p.type, clicks, ticketsSold, earnedCents };
    })
  );

  return links
    .filter((l: TopPromoterLink) => l.clicks > 0 || l.ticketsSold > 0 || l.earnedCents > 0)
    .sort((a: TopPromoterLink, b: TopPromoterLink) => b.earnedCents - a.earnedCents);
}
