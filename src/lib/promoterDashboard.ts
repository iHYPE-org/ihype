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
