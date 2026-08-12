/**
 * The ME module's role-aware dashboard data.
 *
 * The handoff draws a role switcher, a stats grid, an activity list and a HYPE
 * link card, all varying by role. Every figure here is a real aggregate — the
 * prototype's numbers ($3,180 paid out, 82% fill rate) are placeholders, and
 * this codebase's rule is that a stat with nothing behind it is omitted rather
 * than fabricated or zeroed.
 *
 * Two product facts from the handoff shape this file:
 *
 *   - **Fan is implicit and permanent** (`BACKEND_REWRITE.md` §1). Every account
 *     holds it and it cannot be removed, so `fan` is always in the role list and
 *     is always first.
 *   - **Promoting is role-independent** (§3). There is no promoter role and one
 *     must never be added: any account earns from the 10% pool by sharing its
 *     HYPE link. So promoter earnings are a *fan* stat, not a separate role.
 */

import { db } from '@/lib/db';
import { buildTicketQrCodeDataUrl } from '@/lib/tickets';

export const MMM_ME_ROLES = ['fan', 'artist', 'venue'] as const;
export type MmmMeRole = (typeof MMM_ME_ROLES)[number];

export type MmmStat = { value: string; label: string };
export type MmmActivityRow = { title: string; sub: string; amount: string; tone: 'positive' | 'hot' | 'neutral' };

export type MmmMeData = {
  role: MmmMeRole;
  /** Roles this account actually holds — the switcher renders only these. */
  availableRoles: MmmMeRole[];
  stats: MmmStat[];
  activityLabel: string;
  activity: MmmActivityRow[];
  /** Artist and Venue only. Fans have no page creator — removed deliberately. */
  page: { name: string; status: string; slug: string; kind: 'artists' | 'venues' } | null;
  hypeLink: { url: string; clicks: number | null; tickets: number | null; earnedCents: number | null } | null;
  /**
   * Whether this account already has an advertiser profile.
   *
   * The 2026-08-10 shell template adds Advertiser as a third profile card
   * beside Artist and Venue. It is NOT in `availableRoles` and must not be: an
   * advertiser has no `Profile` row and no dashboard of this shape — it has
   * `/advertise/dashboard` — so putting it in the role switcher would offer a
   * tab that renders nothing. It is a card and an add button, not a role.
   */
  hasAdvertiser: boolean;
  /**
   * Valid tickets this account holds, for the My Tickets summary line.
   *
   * `null` means the count could not be read, and renders as no line at all
   * rather than "0 tickets" — the same rule the analytics engine follows,
   * because a zero is a claim and a failed read is not.
   */
  ticketCount: number | null;
  /**
   * The member's own tickets, rendered INSIDE the ME module rather than linked
   * out to the legacy `/tickets` page.
   *
   * Empty means "none, or could not be read" — the surface shows the same
   * thing either way here, because unlike a count there is no figure to be
   * wrong about: a list with nothing in it is a list with nothing in it.
   */
  tickets: MmmMeTicket[];
};

export type MmmMeTicket = {
  serializedId: string;
  title: string;
  /** `Venue · City`, already joined, with either half omitted if unknown. */
  where: string;
  startsAt: string;
  /** Face value, from the SHOW's own price — a Ticket row carries no price. */
  faceValue: string | null;
  /** The buyer's share of Stripe's fee for this ticket, or null pre-fee. */
  processingFee: string | null;
  scannedAt: string | null;
  /** Inline SVG data URL. Cheap enough to send with the list: ~1KB each. */
  qrDataUrl: string;
};

/**
 * What a per-role loader returns.
 *
 * The three account-level fields are stamped once by `loadMmmMe` and are
 * deliberately NOT part of this type: a loader that could set `availableRoles`
 * is a loader that can get it wrong, and two of them once returned an empty
 * array — which hid the role switcher the moment you switched to a creator
 * role, leaving no way back to Fan without editing the URL. Naming the seam in
 * the type is what stops that returning.
 */
type MmmMeRoleData = Omit<MmmMeData, 'availableRoles' | 'hasAdvertiser' | 'ticketCount' | 'tickets'>;

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const count = (value: number) => value.toLocaleString('en-US');

function thirtyDaysAgo(now: Date) {
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
}

/**
 * Resolves which roles an account holds. `fan` is unconditional (§1's "Fan is
 * implicit and permanent"); the others come from the member's own Profile rows,
 * which is the same source the legacy shell's role gates use.
 */
export function resolveAvailableRoles(profileTypes: readonly string[]): MmmMeRole[] {
  const roles: MmmMeRole[] = ['fan'];
  if (profileTypes.includes('ARTIST')) roles.push('artist');
  if (profileTypes.includes('VENUE')) roles.push('venue');
  return roles;
}

export async function loadMmmMe(userId: string, requestedRole: string | undefined, now = new Date()): Promise<MmmMeData> {
  const profiles = await db.profile.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, type: true, name: true, slug: true, hexId: true, hypeCount: true,
      isVerified: true, verified: true, city: true, stateRegion: true, capacity: true,
    },
  });

  const availableRoles = resolveAvailableRoles(profiles.map((profile) => profile.type));
  const role: MmmMeRole = availableRoles.includes(requestedRole as MmmMeRole)
    ? (requestedRole as MmmMeRole)
    : availableRoles[0];

  // The HYPE link is handle-based and belongs to the account, not to a role —
  // every account has one, including a plain fan. `/h/<code>` is the real
  // short-link route; the code is the first-created profile's hexId, which is
  // what /api/me already returns as `inviteHexId`.
  const linkProfile = profiles[0] ?? null;

  // Account-level facts, read once and independent of which role is being
  // viewed. Both are `.catch()`'d separately: a failure hides the advertiser
  // card and the ticket line rather than taking the whole surface down, which
  // is the rule the admin workbench and the analytics engine already follow.
  const [advertiser, ticketCount, ticketRows] = await Promise.all([
    db.advertiserAccount
      .findUnique({ where: { userId }, select: { id: true } })
      .catch(() => null),
    db.ticket
      .count({ where: { status: 'VALID', ticketOrder: { buyerUserId: userId } } })
      .catch(() => null),
    // SCANNED as well as VALID: a ticket you used is still yours, and the
    // design shows it as an "attended" row with its check-in time. VOID is
    // excluded — a refunded ticket is not a ticket.
    db.ticket
      .findMany({
        where: { status: { in: ['VALID', 'SCANNED'] }, ticketOrder: { buyerUserId: userId } },
        // Newest shows first at the database, then re-ordered below. Ascending
        // here would spend the `take` on the oldest attended tickets and could
        // push every upcoming show out of the list entirely.
        orderBy: { show: { startsAt: 'desc' } },
        take: 24,
        select: {
          serializedId: true,
          scannedAt: true,
          ticketOrder: { select: { processingFeeCents: true, quantity: true } },
          show: {
            select: {
              title: true,
              startsAt: true,
              ticketPriceCents: true,
              venueProfile: { select: { name: true, city: true } },
            },
          },
        },
      })
      .catch(() => []),
  ]);

  /**
   * Upcoming first, soonest first; attended after them, most recent first.
   *
   * A single `startsAt` sort puts July's attended ticket above August's
   * upcoming one, which is backwards for the only question this list answers —
   * what am I going to, and when. It is also what the design draws.
   */
  const nowMs = Date.now();
  const ordered = [...ticketRows].sort((a, b) => {
    const aPast = a.show.startsAt.getTime() < nowMs;
    const bPast = b.show.startsAt.getTime() < nowMs;
    if (aPast !== bPast) return aPast ? 1 : -1;
    return aPast
      ? b.show.startsAt.getTime() - a.show.startsAt.getTime()
      : a.show.startsAt.getTime() - b.show.startsAt.getTime();
  });

  const tickets: MmmMeTicket[] = await Promise.all(
    ordered.map(async (row) => ({
      serializedId: row.serializedId,
      title: row.show.title,
      where: [row.show.venueProfile?.name, row.show.venueProfile?.city]
        .filter(Boolean)
        .join(' · '),
      startsAt: row.show.startsAt.toISOString(),
      // Free shows say Free rather than $0 — the same distinction the map pins
      // already make. A price that could not be read is omitted, not zeroed.
      faceValue: row.show.ticketPriceCents > 0 ? money(row.show.ticketPriceCents) : 'Free',
      // Per TICKET, not per order: an order of three carries one fee, and
      // showing the whole thing on each ticket would treble it on screen.
      // Orders placed before the fee existed carry 0 and show no line at all,
      // rather than a $0.00 that reads as a fee that was waived.
      processingFee:
        row.ticketOrder.processingFeeCents > 0
          ? money(Math.round(row.ticketOrder.processingFeeCents / Math.max(1, row.ticketOrder.quantity)))
          : null,
      scannedAt: row.scannedAt?.toISOString() ?? null,
      qrDataUrl: await buildTicketQrCodeDataUrl(row.serializedId),
    })),
  ).catch(() => []);

  // `availableRoles` is stamped here, once, for every branch. The per-role
  // loaders used to each return their own value and two of them returned an
  // empty array — which hid the switcher as soon as you switched to a creator
  // role, so there was no way back to Fan without editing the URL. The two
  // account-level fields above ride the same seam for the same reason.
  const withRoles = (data: MmmMeRoleData): MmmMeData => ({
    ...data,
    availableRoles,
    hasAdvertiser: advertiser !== null,
    ticketCount,
    tickets,
  });

  if (role === 'fan') return withRoles(await loadFan(userId, linkProfile, now));
  const profile = profiles.find((entry) => entry.type === (role === 'artist' ? 'ARTIST' : 'VENUE'));
  if (!profile) return withRoles(await loadFan(userId, linkProfile, now));
  return withRoles(role === 'artist'
    ? await loadArtist(profile, linkProfile, now)
    : await loadVenue(profile, linkProfile, now));
}

async function hypeLinkFor(
  profile: { id: string; hexId: string } | null,
  now: Date,
): Promise<MmmMeData['hypeLink']> {
  if (!profile) return null;
  // Each figure is caught independently: a failing referral query must not
  // blank the link itself, which is the primary surface for a fan.
  const [tickets, earned] = await Promise.all([
    db.ticketOrder
      .count({ where: { affiliatePromoterProfileId: profile.id, status: { not: 'VOID' } } })
      .catch(() => null),
    db.accountsPayableEntry
      .aggregate({
        _sum: { amountCents: true },
        where: { profileId: profile.id, category: 'PROMOTER_AFFILIATE', status: 'RELEASED' },
      })
      .then((result) => result._sum?.amountCents ?? 0)
      .catch(() => null),
  ]);
  void now;
  return {
    url: `ihype.org/h/${profile.hexId}`,
    // Click-through counts are recorded per short-link visit by /h/[code]; the
    // aggregate is not exposed as a single query yet, so it is omitted rather
    // than shown as zero beside two real numbers.
    clicks: null,
    tickets,
    earnedCents: earned,
  };
}

async function loadFan(userId: string, linkProfile: { id: string; hexId: string } | null, now: Date): Promise<MmmMeRoleData> {
  const [hypesCast, showsAttended, following, orders, hypeLink] = await Promise.all([
    db.profileHypeEvent.count({ where: { userId } }).catch(() => null),
    db.showAttendee.count({ where: { userId } }).catch(() => null),
    db.follow.count({ where: { followerId: userId } }).catch(() => null),
    db.ticketOrder.findMany({
      where: { buyerUserId: userId, status: { not: 'VOID' } },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: { id: true, totalChargeCents: true, createdAt: true, show: { select: { title: true, startsAt: true } } },
    }).catch(() => []),
    hypeLinkFor(linkProfile, now),
  ]);

  const stats: MmmStat[] = [];
  if (hypesCast !== null) stats.push({ value: count(hypesCast), label: 'Hypes cast' });
  if (showsAttended !== null) stats.push({ value: count(showsAttended), label: 'Shows attended' });
  if (hypeLink?.earnedCents !== null && hypeLink?.earnedCents !== undefined) {
    stats.push({ value: money(hypeLink.earnedCents), label: 'Promoter earnings' });
  }
  if (following !== null) stats.push({ value: count(following), label: 'Following' });

  return {
    role: 'fan',
    // Overwritten by loadMmmMe — see withRoles().
    stats,
    activityLabel: 'Recent tickets',
    activity: orders.map((order) => ({
      title: order.show?.title ?? 'Ticket order',
      sub: order.show?.startsAt
        ? new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(order.show.startsAt)
        : '',
      amount: `-${money(order.totalChargeCents)}`,
      tone: 'neutral' as const,
    })),
    // Deliberately null: the fan page creator was removed in this handoff.
    // Fans share a HYPE link instead of maintaining a page.
    page: null,
    hypeLink,
  };
}

async function loadArtist(
  profile: { id: string; name: string; slug: string; hexId: string; hypeCount: number; isVerified: boolean; verified: boolean; city: string | null; stateRegion: string | null },
  linkProfile: { id: string; hexId: string } | null,
  now: Date,
): Promise<MmmMeRoleData> {
  const [paidOut, upcoming, followers, releases, hypeLink] = await Promise.all([
    db.accountsPayableEntry.aggregate({
      _sum: { amountCents: true },
      where: { profileId: profile.id, category: 'ARTIST_PAYOUT', status: 'RELEASED', paidAt: { gte: thirtyDaysAgo(now) } },
    }).then((result) => result._sum?.amountCents ?? 0).catch(() => null),
    db.show.count({
      where: { headlinerProfileId: profile.id, status: 'SCHEDULED', startsAt: { gte: now } },
    }).catch(() => null),
    db.follow.count({ where: { followeeProfileId: profile.id } }).catch(() => null),
    db.accountsPayableEntry.findMany({
      where: { profileId: profile.id, category: 'ARTIST_PAYOUT', status: 'RELEASED' },
      orderBy: { paidAt: 'desc' },
      take: 4,
      select: { id: true, amountCents: true, paidAt: true, show: { select: { title: true, ticketsSoldCount: true } } },
    }).catch(() => []),
    hypeLinkFor(linkProfile, now),
  ]);

  const stats: MmmStat[] = [{ value: count(profile.hypeCount), label: 'Total hypes' }];
  if (paidOut !== null) stats.push({ value: money(paidOut), label: 'Paid out 30d' });
  if (upcoming !== null) stats.push({ value: count(upcoming), label: 'Upcoming shows' });
  if (followers !== null) stats.push({ value: count(followers), label: 'Followers' });

  return {
    role: 'artist',  // Overwritten by loadMmmMe — see withRoles().
    stats,
    activityLabel: 'Recent payouts',
    activity: releases.map((entry) => ({
      title: entry.show?.title ?? 'Show payout',
      sub: [
        entry.paidAt ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(entry.paidAt) : null,
        entry.show ? `${entry.show.ticketsSoldCount} tickets` : null,
      ].filter(Boolean).join(' · '),
      amount: `+${money(entry.amountCents)}`,
      tone: 'positive' as const,
    })),
    page: {
      name: profile.name,
      slug: profile.slug,
      kind: 'artists',
      status: [
        profile.isVerified || profile.verified ? 'Verified' : 'Unverified',
        [profile.city, profile.stateRegion].filter(Boolean).join(', ') || null,
      ].filter(Boolean).join(' · '),
    },
    hypeLink,
  };
}

async function loadVenue(
  profile: { id: string; name: string; slug: string; hexId: string; isVerified: boolean; verified: boolean; city: string | null; stateRegion: string | null; capacity: number | null },
  linkProfile: { id: string; hexId: string } | null,
  now: Date,
): Promise<MmmMeRoleData> {
  const [gate, booked, recentShows, settlements, hypeLink] = await Promise.all([
    db.accountsPayableEntry.aggregate({
      _sum: { amountCents: true },
      where: { profileId: profile.id, category: 'VENUE_PAYOUT', status: 'RELEASED', paidAt: { gte: thirtyDaysAgo(now) } },
    }).then((result) => result._sum?.amountCents ?? 0).catch(() => null),
    db.show.count({ where: { venueProfileId: profile.id, status: 'SCHEDULED', startsAt: { gte: now } } }).catch(() => null),
    db.show.findMany({
      where: { venueProfileId: profile.id, startsAt: { lt: now }, ticketCapacity: { gt: 0 } },
      orderBy: { startsAt: 'desc' },
      take: 20,
      select: { ticketsSoldCount: true, ticketCapacity: true },
    }).catch(() => []),
    db.accountsPayableEntry.findMany({
      where: { profileId: profile.id, category: 'VENUE_PAYOUT', status: 'RELEASED' },
      orderBy: { paidAt: 'desc' },
      take: 4,
      select: { id: true, amountCents: true, paidAt: true, show: { select: { title: true, ticketsSoldCount: true } } },
    }).catch(() => []),
    hypeLinkFor(linkProfile, now),
  ]);

  const stats: MmmStat[] = [];
  // Fill rate is only meaningful once a show has actually happened here; with
  // no past ticketed show the stat is omitted rather than shown as 0%.
  if (recentShows.length > 0) {
    const totalCapacity = recentShows.reduce((sum, show) => sum + (show.ticketCapacity ?? 0), 0);
    const totalSold = recentShows.reduce((sum, show) => sum + show.ticketsSoldCount, 0);
    if (totalCapacity > 0) stats.push({ value: `${Math.round((totalSold / totalCapacity) * 100)}%`, label: 'Avg fill rate' });
  }
  if (gate !== null) stats.push({ value: money(gate), label: 'Gate 30d' });
  if (booked !== null) stats.push({ value: count(booked), label: 'Shows booked' });
  if (profile.capacity) stats.push({ value: count(profile.capacity), label: 'Capacity' });

  return {
    role: 'venue',  // Overwritten by loadMmmMe — see withRoles().
    stats,
    activityLabel: 'Recent settlements',
    activity: settlements.map((entry) => ({
      title: entry.show?.title ?? 'Show settlement',
      sub: [
        entry.paidAt ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(entry.paidAt) : null,
        entry.show ? `${entry.show.ticketsSoldCount} sold` : null,
      ].filter(Boolean).join(' · '),
      amount: `+${money(entry.amountCents)}`,
      tone: 'positive' as const,
    })),
    page: {
      name: profile.name,
      slug: profile.slug,
      kind: 'venues',
      status: [
        profile.isVerified || profile.verified ? 'Verified' : 'Unverified',
        [profile.city, profile.stateRegion].filter(Boolean).join(', ') || null,
        profile.capacity ? `${profile.capacity} cap` : null,
      ].filter(Boolean).join(' · '),
    },
    hypeLink,
  };
}
