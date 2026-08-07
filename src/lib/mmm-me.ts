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
import { getProfilePathForType } from '@/lib/profile-paths';

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
  /**
   * Set only while a creator profile has not finished its onboarding wizard.
   *
   * This exists because `/welcome` stopped gating new creators behind the
   * wizard and now lands everyone in the app (DESIGN_SYNC row 275). Setup is
   * still real work — verification is what activates the 70% split, and it has
   * to happen before a payout can route anywhere — so removing the gate only
   * simplifies the product if the task follows the member into the app instead
   * of vanishing. Null for fans, and null the moment `onboardedAt` is stamped.
   */
  setup: { href: string; label: string } | null;
  hypeLink: { url: string; clicks: number | null; tickets: number | null; earnedCents: number | null } | null;
};

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
      onboardedAt: true,
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

  // `availableRoles` is stamped here, once, for every branch. The per-role
  // loaders used to each return their own value and two of them returned an
  // empty array — which hid the switcher as soon as you switched to a creator
  // role, so there was no way back to Fan without editing the URL.
  //
  // `setup` is stamped in the same seam for the same reason: three loaders each
  // deriving it independently is how that bug happened. It is also account-wide
  // rather than role-scoped on purpose — an artist looking at their Fan tab
  // still has a page to finish setting up.
  const setupProfile = profiles.find(
    (entry) => (entry.type === 'ARTIST' || entry.type === 'VENUE') && !entry.onboardedAt,
  );
  const setup: MmmMeData['setup'] = setupProfile
    ? {
        href: `${getProfilePathForType(setupProfile.type, setupProfile.slug)}/onboarding`,
        label: setupProfile.type === 'VENUE' ? 'List your room' : 'Set up your page',
      }
    : null;

  const withRoles = (data: MmmMeData): MmmMeData => ({ ...data, availableRoles, setup });

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

async function loadFan(userId: string, linkProfile: { id: string; hexId: string } | null, now: Date): Promise<MmmMeData> {
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
    setup: null,  // Stamped by loadMmmMe's withRoles(), same as availableRoles.
    // Overwritten by loadMmmMe — see withRoles().
    availableRoles: ['fan'],
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
): Promise<MmmMeData> {
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
    role: 'artist',
    setup: null,  // Stamped by loadMmmMe's withRoles(), same as availableRoles.
    availableRoles: [],  // Overwritten by loadMmmMe — see withRoles().
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
): Promise<MmmMeData> {
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
    role: 'venue',
    setup: null,  // Stamped by loadMmmMe's withRoles(), same as availableRoles.
    availableRoles: [],  // Overwritten by loadMmmMe — see withRoles().
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
