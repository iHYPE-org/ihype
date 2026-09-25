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
 *     must never be added: any account shares its HYPE link, which records the
 *     referral. It earns nothing since 2026-09-25; past referral earnings from
 *     the old split are a *fan* stat, not a separate role.
 */

import { formatDate, formatDoorTime, formatNumber, formatUsd } from '@/lib/format-locale';
import type { Locale } from '@/lib/i18n/locales';
import { db } from '@/lib/db';
import { buildTicketQrCodeDataUrl } from '@/lib/tickets';

/**
 * `advertiser` joined on 2026-09-24 (DESIGN_SYNC row 510; owner: "advertiser
 * role isn't a selection to view as (should be)"). It has no Profile row and
 * no public page, so its view is the campaign figures and one card that opens
 * the dashboard — the earlier note here that it "must not" be a role was a
 * decision the owner has reversed.
 */
export const MMM_ME_ROLES = ['fan', 'artist', 'venue', 'advertiser'] as const;
export type MmmMeRole = (typeof MMM_ME_ROLES)[number];

export type MmmStat = { value: string; label: string };
/**
 * One row of the ME pane's recent activity. Everything here is DATA — the
 * component translates. `title` is the show's own name and `fallbackTitle`
 * the English key `MmmMe` translates when the show is gone (a lib string
 * drawn raw is English in every locale, DESIGN_SYNC row 425); `when` is
 * already formatted in the member's locale; `count` is a number and its
 * unit, never the sentence.
 */
export type MmmActivityRow = {
  title: string | null;
  fallbackTitle: 'Ticket order' | 'Show payout' | 'Show settlement' | 'Sponsorship';
  when: string | null;
  count: { unit: 'tickets' | 'sold'; n: number } | null;
  amount: string;
  tone: 'positive' | 'hot' | 'neutral';
};

export type MmmMeData = {
  role: MmmMeRole;
  /** Roles this account actually holds — the switcher renders only these. */
  availableRoles: MmmMeRole[];
  stats: MmmStat[];
  /** `null` when the read FAILED — the pane says so rather than drawing an
   *  empty-state sentence over it (row 513; row 408's rule). */
  activity: MmmActivityRow[] | null;
  /** Artist and Venue only. Fans have no page creator — removed deliberately. */
  page: { name: string; status: string; slug: string; kind: 'artists' | 'venues' | 'advertising' } | null;
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
   * Whether this account may open the admin console.
   *
   * Passed in rather than derived here: the allowlist rule lives in
   * `isAdminSession()`, which needs the Session, and this loader is given a
   * user id. Deriving it from `User.role` alone would re-create exactly the
   * hole `admin-allowlist.ts` closed — the role on the row is granted, the
   * address on it is what ALLOWS it.
   */
  isAdmin: boolean;
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
};

export type MmmMeTicket = {
  serializedId: string;
  title: string;
  /** `Venue · City`, already joined, with either half omitted if unknown. */
  where: string;
  startsAt: string;
  /** The venue's IANA zone (`Show.timeZone`), so the wallet renders the door
      time on the venue's clock and not the Worker's UTC. Null for a show that
      predates the column; the formatter then says which clock it used. */
  timeZone: string | null;
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
type MmmMeRoleData = Omit<MmmMeData, 'availableRoles' | 'hasAdvertiser' | 'ticketCount' | 'tickets' | 'isAdmin'>;

const money = (locale: Locale, cents: number) => formatUsd(locale, cents, 0);
const count = (locale: Locale, value: number) => formatNumber(locale, value);

function thirtyDaysAgo(now: Date) {
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
}

/**
 * Resolves which roles an account holds. `fan` is unconditional (§1's "Fan is
 * implicit and permanent"); the others come from the member's own Profile rows,
 * which is the same source the legacy shell's role gates use.
 */
export function resolveAvailableRoles(profileTypes: readonly string[], hasAdvertiser = false): MmmMeRole[] {
  const roles: MmmMeRole[] = ['fan'];
  if (profileTypes.includes('ARTIST')) roles.push('artist');
  if (profileTypes.includes('VENUE')) roles.push('venue');
  // From the AdvertiserAccount row, not a Profile type: the fifth account
  // type has no Profile (row 229) and is viewed here through its campaigns.
  if (hasAdvertiser) roles.push('advertiser');
  return roles;
}

export type LoadMmmMeOptions = {
  /* `includeTickets` is gone (2026-09-24, DESIGN_SYNC row 513): the wallet
     reads `loadWalletTickets` directly, and the ME pane never drew a ticket
     (its count line is `ticketCount`). Row 509 had already taken the QR
     encodes off ME; this takes the last reader of the flag with it. */
  now?: Date;
};

/**
 * The wallet's tickets, ordered and with a QR each: the one read the Tickets
 * tab draws (2026-09-24, DESIGN_SYNC row 513). `/app/tickets` used to call the
 * whole of `loadMmmMe` for this, which also read the profiles, the advertiser
 * account, the ticket count and the fan board's four counts and hype-link
 * figures, none of which the wallet renders.
 */
/**
 * `null` is a read that FAILED, never an empty wallet: the wallet draws demo
 * tickets over an empty list, so a swallowed failure used to show a member
 * holding real tickets two fake ones under a "Demo content" badge — at the
 * door, on the one surface with no tolerance for it (row 513).
 */
export async function loadWalletTickets(userId: string, locale: Locale): Promise<MmmMeTicket[] | null> {
  // SCANNED as well as VALID: a ticket you used is still yours, and the
  // design shows it as an "attended" row with its check-in time. VOID is
  // excluded — a refunded ticket is not a ticket.
  const ticketRows = await db.ticket
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
              timeZone: true,
              ticketPriceCents: true,
              venueProfile: { select: { name: true, city: true } },
            },
          },
        },
      })
      .catch(() => null);
  if (!ticketRows) return null;

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

  return Promise.all(
    ordered.map(async (row) => ({
      serializedId: row.serializedId,
      title: row.show.title,
      where: [row.show.venueProfile?.name, row.show.venueProfile?.city]
        .filter(Boolean)
        .join(' · '),
      startsAt: row.show.startsAt.toISOString(),
      timeZone: row.show.timeZone ?? null,
      // Free shows say Free rather than $0 — the same distinction the map pins
      // already make. A price that could not be read is omitted, not zeroed.
      faceValue: row.show.ticketPriceCents > 0 ? money(locale, row.show.ticketPriceCents) : 'Free',
      // Per TICKET, not per order: an order of three carries one fee, and
      // showing the whole thing on each ticket would treble it on screen.
      // Orders placed before the fee existed carry 0 and show no line at all,
      // rather than a $0.00 that reads as a fee that was waived.
      processingFee:
        row.ticketOrder.processingFeeCents > 0
          ? money(locale, Math.round(row.ticketOrder.processingFeeCents / Math.max(1, row.ticketOrder.quantity)))
          : null,
      scannedAt: row.scannedAt?.toISOString() ?? null,
      qrDataUrl: await buildTicketQrCodeDataUrl(row.serializedId),
    })),
  ).catch(() => null);
}

export async function loadMmmMe(userId: string, requestedRole: string | undefined, locale: Locale, isAdmin = false, options: LoadMmmMeOptions = {}): Promise<MmmMeData> {
  const { now = new Date() } = options;
  // The advertiser account is read beside the profiles because it decides a
  // ROLE now (row 510); a failed read hides the advertiser view and its card
  // rather than taking the surface down.
  const [profiles, advertiser] = await Promise.all([
    db.profile.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, type: true, name: true, slug: true, hexId: true, hypeCount: true,
        isVerified: true, verified: true, city: true, stateRegion: true, capacity: true,
      },
    }),
    db.advertiserAccount
      .findUnique({ where: { userId }, select: { id: true, companyName: true } })
      .catch(() => null),
  ]);

  const availableRoles = resolveAvailableRoles(profiles.map((profile) => profile.type), advertiser !== null);
  const role: MmmMeRole = availableRoles.includes(requestedRole as MmmMeRole)
    ? (requestedRole as MmmMeRole)
    : availableRoles[0];

  // The HYPE link is handle-based and belongs to the account, not to a role —
  // every account has one, including a plain fan. `/h/<code>` is the real
  // short-link route; the code is the first-created profile's hexId, which is
  // what /api/me already returns as `inviteHexId`.
  const linkProfile = profiles[0] ?? null;

  // Account-level facts, read once and independent of which role is being
  // viewed. Both are `.catch()`'d separately: a failure hides the ticket line
  // rather than taking the whole surface down, which is the rule the admin
  // workbench and the analytics engine already follow.
  const ticketCount = await db.ticket
    .count({ where: { status: 'VALID', ticketOrder: { buyerUserId: userId } } })
    .catch(() => null);

  // `availableRoles` is stamped here, once, for every branch. The per-role
  // loaders used to each return their own value and two of them returned an
  // empty array — which hid the switcher as soon as you switched to a creator
  // role, so there was no way back to Fan without editing the URL. The two
  // account-level fields above ride the same seam for the same reason.
  const withRoles = (data: MmmMeRoleData): MmmMeData => ({
    ...data,
    availableRoles,
    hasAdvertiser: advertiser !== null,
    isAdmin,
    ticketCount,
  });

  if (role === 'fan') return withRoles(await loadFan(userId, linkProfile, now, locale));
  if (role === 'advertiser') {
    return withRoles(advertiser
      ? await loadAdvertiser(userId, advertiser, linkProfile, now, locale)
      : await loadFan(userId, linkProfile, now, locale));
  }
  const profile = profiles.find((entry) => entry.type === (role === 'artist' ? 'ARTIST' : 'VENUE'));
  if (!profile) return withRoles(await loadFan(userId, linkProfile, now, locale));
  return withRoles(role === 'artist'
    ? await loadArtist(profile, linkProfile, now, locale)
    : await loadVenue(profile, linkProfile, now, locale));
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

async function loadFan(userId: string, linkProfile: { id: string; hexId: string } | null, now: Date, locale: Locale): Promise<MmmMeRoleData> {
  const [hypesCast, showsAttended, following, orders, hypeLink] = await Promise.all([
    db.profileHypeEvent.count({ where: { userId } }).catch(() => null),
    db.showAttendee.count({ where: { userId } }).catch(() => null),
    db.follow.count({ where: { followerId: userId } }).catch(() => null),
    db.ticketOrder.findMany({
      where: { buyerUserId: userId, status: { not: 'VOID' } },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: { id: true, totalChargeCents: true, createdAt: true, show: { select: { title: true, startsAt: true, timeZone: true } } },
    }).catch(() => null),
    hypeLinkFor(linkProfile, now),
  ]);

  const stats: MmmStat[] = [];
  if (hypesCast !== null) stats.push({ value: count(locale, hypesCast), label: 'Hypes cast' });
  if (showsAttended !== null) stats.push({ value: count(locale, showsAttended), label: 'Shows attended' });
  /* Past referral earnings only: since 2026-09-25 a HYPE link earns no share
     of a ticket, so this figure can only be PROMOTER_AFFILIATE payables from
     orders sold under the old split. Zero is the normal state and draws no
     tile; a null read draws none either. */
  if (hypeLink?.earnedCents) {
    stats.push({ value: money(locale, hypeLink.earnedCents), label: 'Past referral earnings' });
  }
  if (following !== null) stats.push({ value: count(locale, following), label: 'Following' });

  return {
    role: 'fan',
    // Overwritten by loadMmmMe — see withRoles().
    stats,
    activity: orders === null ? null : orders.map((order) => ({
      title: order.show?.title ?? null,
      fallbackTitle: 'Ticket order' as const,
      /* The venue's clock. This forced UTC, which put a late-evening show on
         the following day in every zone west of Greenwich — the fan's own
         ticket row and the show page disagreeing about the night. */
      when: order.show?.startsAt
        ? formatDoorTime(locale, order.show.startsAt, order.show.timeZone, { weekday: 'short', month: 'short', day: 'numeric' })
        : null,
      count: null,
      amount: `-${money(locale, order.totalChargeCents)}`,
      tone: 'neutral' as const,
    })),
    // Deliberately null: the fan page creator was removed in this handoff.
    // Fans share a HYPE link instead of maintaining a page.
    page: null,
    hypeLink,
  };
}

/**
 * The advertiser view: the account's campaigns, said the way the dashboard
 * says them. Every figure is a read the schema stores and each is caught on
 * its own — a failed count is a missing tile, never a zero (the analytics
 * engine's rule). "Paid" is the budget of every campaign whose card was
 * charged (`authorizedAt`); "Refunded" is the settlement record, never
 * budget − spent (row 340). No metered vocabulary: `spentCents` never moves
 * for a sponsorship (row 384), so nothing here is derived from it.
 */
async function loadAdvertiser(
  userId: string,
  account: { id: string; companyName: string | null },
  linkProfile: { id: string; hexId: string } | null,
  now: Date,
  locale: Locale,
): Promise<MmmMeRoleData> {
  const [live, impressions, paid, refunded, recent, hypeLink] = await Promise.all([
    db.ad.count({ where: { advertiserId: userId, status: 'APPROVED' } }).catch(() => null),
    db.adImpression
      .count({ where: { ad: { advertiserId: userId }, createdAt: { gte: thirtyDaysAgo(now) } } })
      .catch(() => null),
    db.ad
      .aggregate({ _sum: { budgetCents: true }, where: { advertiserId: userId, authorizedAt: { not: null } } })
      .then((result) => result._sum?.budgetCents ?? 0)
      .catch(() => null),
    db.ad
      .aggregate({ _sum: { refundedCents: true }, where: { advertiserId: userId } })
      .then((result) => result._sum?.refundedCents ?? 0)
      .catch(() => null),
    db.ad
      .findMany({
        where: { advertiserId: userId },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { id: true, title: true, status: true, budgetCents: true, authorizedAt: true, createdAt: true },
      })
      .catch(() => null),
    hypeLinkFor(linkProfile, now),
  ]);

  const stats: MmmStat[] = [];
  if (live !== null) stats.push({ value: count(locale, live), label: 'Live campaigns' });
  if (impressions !== null) stats.push({ value: count(locale, impressions), label: 'Impressions 30d' });
  if (paid !== null) stats.push({ value: money(locale, paid), label: 'Paid' });
  if (refunded !== null) stats.push({ value: money(locale, refunded), label: 'Refunded' });

  return {
    role: 'advertiser',  // Overwritten by loadMmmMe — see withRoles().
    stats,
    activity: recent === null ? null : recent.map((campaign) => ({
      title: campaign.title,
      fallbackTitle: 'Sponsorship' as const,
      when: formatDate(locale, campaign.createdAt, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      count: null,
      amount: campaign.authorizedAt ? money(locale, campaign.budgetCents) : '—',
      tone: campaign.status === 'APPROVED' ? ('positive' as const) : campaign.status === 'PENDING' || campaign.status === 'AWAITING_PAYMENT' ? ('hot' as const) : ('neutral' as const),
    })),
    page: {
      // Empty rather than an English word: the card translates the fallback at the draw.
      name: account.companyName?.trim() || '',
      slug: 'advertising',
      kind: 'advertising',
      status: 'Advertiser account',
    },
    hypeLink,
  };
}

async function loadArtist(
  profile: { id: string; name: string; slug: string; hexId: string; hypeCount: number; isVerified: boolean; verified: boolean; city: string | null; stateRegion: string | null },
  linkProfile: { id: string; hexId: string } | null,
  now: Date,
  locale: Locale,
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
    }).catch(() => null),
    hypeLinkFor(linkProfile, now),
  ]);

  const stats: MmmStat[] = [{ value: count(locale, profile.hypeCount), label: 'Total hypes' }];
  if (paidOut !== null) stats.push({ value: money(locale, paidOut), label: 'Paid out 30d' });
  if (upcoming !== null) stats.push({ value: count(locale, upcoming), label: 'Upcoming shows' });
  if (followers !== null) stats.push({ value: count(locale, followers), label: 'Followers' });

  return {
    role: 'artist',  // Overwritten by loadMmmMe — see withRoles().
    stats,
    activity: releases === null ? null : releases.map((entry) => ({
      title: entry.show?.title ?? null,
      fallbackTitle: 'Show payout' as const,
      when: entry.paidAt ? formatDate(locale, entry.paidAt, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : null,
      count: entry.show ? { unit: 'tickets' as const, n: entry.show.ticketsSoldCount } : null,
      amount: `+${money(locale, entry.amountCents)}`,
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
  locale: Locale,
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
    }).catch(() => null),
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
  if (gate !== null) stats.push({ value: money(locale, gate), label: 'Gate 30d' });
  if (booked !== null) stats.push({ value: count(locale, booked), label: 'Shows booked' });
  if (profile.capacity) stats.push({ value: count(locale, profile.capacity), label: 'Capacity' });

  return {
    role: 'venue',  // Overwritten by loadMmmMe — see withRoles().
    stats,
    activity: settlements === null ? null : settlements.map((entry) => ({
      title: entry.show?.title ?? null,
      fallbackTitle: 'Show settlement' as const,
      when: entry.paidAt ? formatDate(locale, entry.paidAt, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : null,
      count: entry.show ? { unit: 'sold' as const, n: entry.show.ticketsSoldCount } : null,
      amount: `+${money(locale, entry.amountCents)}`,
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
