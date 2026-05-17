import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getSharedDiscoverFeed } from '@/lib/discover-feed';
import { detectRequestLocation } from '@/lib/request-location';
import type { ProfileType } from '@prisma/client';
import { WorkbenchShell, type WorkbenchData, type WbStat, type WbTrack, type WbShow, type WbActivity, type WbNotification } from '@/components/WorkbenchShell';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { getDiscoveryStreak } from '@/lib/streaks';

export const dynamic = 'force-dynamic';

// ── helpers ──────────────────────────────────────────────────────

function roleLabel(type: ProfileType) {
  if (type === 'DJ') return 'Promoter/DJ';
  if (type === 'VENUE') return 'Venue';
  if (type === 'LISTENER') return 'Fan';
  return 'Artist';
}

function discoverHref(type: ProfileType) {
  if (type === 'DJ') return '/promoters';
  if (type === 'VENUE') return '/venues';
  if (type === 'LISTENER') return '/fans';
  return '/artists';
}

function profileHref(type: ProfileType, slug: string) {
  if (type === 'DJ') return `/promoters/${slug}`;
  if (type === 'VENUE') return `/venues/${slug}`;
  if (type === 'LISTENER') return `/fans/${slug}`;
  return `/artists/${slug}`;
}

function getProfileCompletion(
  profile: {
    type: ProfileType;
    headline: string | null;
    bio: string | null;
    avatarImage: string | null;
    genres: string[];
    city: string | null;
    contactInfo: string | null;
    addressLine1?: string | null;
    hoursText?: string | null;
    songUploadCount?: number;
  },
  showCount: number
) {
  const checks: Array<{ ok: boolean; label: string }> = [
    { ok: Boolean(profile.headline || profile.bio), label: 'Story' },
    { ok: Boolean(profile.avatarImage), label: 'Image' },
    { ok: profile.genres.length > 0 || Boolean(profile.city), label: 'Tags/market' }
  ];

  if (profile.type === 'VENUE') {
    checks.push(
      { ok: Boolean(profile.addressLine1 || profile.city), label: 'Room/location' },
      { ok: Boolean(profile.hoursText || profile.contactInfo), label: 'Booking info' },
      { ok: showCount > 0, label: 'First event' }
    );
  } else if (profile.type === 'ARTIST' || profile.type === 'DJ') {
    checks.push(
      { ok: Boolean(profile.contactInfo), label: 'Contact' },
      { ok: Boolean((profile.songUploadCount ?? 0) > 0 || showCount > 0), label: profile.type === 'DJ' ? 'First show' : 'Media/show' }
    );
  } else {
    checks.push(
      { ok: Boolean(profile.bio || profile.city), label: 'Taste signal' },
      { ok: true, label: 'Fan lane' }
    );
  }

  const passed = checks.filter((check) => check.ok).length;
  return {
    percent: Math.round((passed / checks.length) * 100),
    missing: checks.filter((check) => !check.ok).map((check) => check.label),
    checks
  };
}

// Palette for track art gradients (cycles through)
const COLORS = ['#ff5029', '#b983ff', '#22e5d4', '#ff3e9a', '#ffb84a', '#7fb3ff'];

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;
  const role = session.user.role as string | null | undefined;

  const profileTypeMap: Record<string, ProfileType> = {
    ARTIST: 'ARTIST', DJ: 'DJ', VENUE: 'VENUE', FAN: 'LISTENER'
  };
  const preferredType = role ? (profileTypeMap[role] ?? null) : null;

  const profile = await db.profile.findFirst({
    where: preferredType ? { ownerId: userId, type: preferredType } : { ownerId: userId },
    select: {
      id: true,
      type: true,
      slug: true,
      name: true,
      hexId: true,
      hypeCount: true,
      city: true,
      stateRegion: true,
      headline: true,
      bio: true,
      avatarImage: true,
      genres: true,
      contactInfo: true,
      addressLine1: true,
      hoursText: true,
      songUploadCount: true
    },
    orderBy: { createdAt: 'asc' }
  });

  if (!profile) redirect('/login');

  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [discoverFeed, viewerLocation, rawStats, eventsResult] = await Promise.all([
    getSharedDiscoverFeed(null),
    detectRequestLocation(),
    fetchStats(profile, userId, thirtyDaysAgo, now),
    fetchEvents(profile, userId, now)
  ]);

  const city = profile.city
    ? [profile.city, profile.stateRegion].filter(Boolean).join(', ')
    : [viewerLocation?.city, viewerLocation?.stateRegion ?? viewerLocation?.country].filter(Boolean).join(', ') || 'your city';

  // ── Build WbTracks from discover feed ──
  const mediaEntries = discoverFeed.mediaEntries.slice(0, 8);
  const wbTracks: WbTrack[] = mediaEntries.map((e, i) => ({
    id: e.id,
    title: e.title,
    artistName: e.artistName,
    duration: '3:30',
    durationSec: 210,
    hypeCount: e.artistHypeCount ?? 0,
    color: COLORS[i % COLORS.length],
    album: e.artistName,
    mediaUrl: `/api/media/${e.id}`,
    artistSlug: e.artistSlug ?? null,
  }));

  // ── Build WbShows from events ──
  const allShows = [...eventsResult.upcoming, ...eventsResult.past.slice(0, 3)];
  const wbShows: WbShow[] = allShows.slice(0, 6).map((s) => {
    const isTonight = s.startsAt >= now && s.startsAt < new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const isLive = s.status === 'LIVE';
    const nearSold = (s.ticketsSoldCount ?? 0) / Math.max(1, s.ticketCapacity ?? 200) > 0.85;
    return {
      id: s.id,
      name: s.title,
      venue: (s as any).venueProfile?.name ?? (s as any).headlinerProfile?.name ?? 'Local venue',
      date: s.startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      time: s.startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      hype: s.hypeCount ?? 0,
      sold: s.ticketsSoldCount ?? 0,
      capacity: s.ticketCapacity ?? 200,
      price: s.ticketPriceCents ? s.ticketPriceCents / 100 : 0,
      status: isLive || isTonight ? 'TONIGHT' : nearSold ? 'NEAR SOLD' : s.startsAt >= now ? 'UPCOMING' : 'THIS WEEK',
    };
  });

  // ── Build WbStats ──
  const STAT_COLORS = ['#ff3e9a', '#22e5d4', '#b983ff', '#ffb84a', '#22e5d4', '#ff5029'];
  const wbStats: WbStat[] = rawStats.slice(0, 4).map((s, i) => ({
    label: s.label.toUpperCase(),
    value: String(s.value),
    delta: '↑ this period',
    color: STAT_COLORS[i % STAT_COLORS.length],
  }));

  // ── Build WbActivity from recent events ──
  const wbActivity: WbActivity[] = eventsResult.upcoming.slice(0, 5).map((s) => ({
    text: `${s.title}${(s as any).venueProfile?.name ? ' @ ' + (s as any).venueProfile.name : ''} — ${s.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    time: 'upcoming',
    kind: 'show',
  }));
  if (wbActivity.length === 0) {
    wbActivity.push({ text: 'No recent activity — start hyping tracks!', time: 'now', kind: 'hype' });
  }
  // Lazily merge fan feed below — variable referenced after the block that builds it.

  // ── Determine active profile types for role-conditional sidebar items ──
  const allProfileRows = await db.profile.findMany({
    where: { ownerId: userId },
    select: { type: true }
  });
  const activeProfileTypes = allProfileRows.map(p => p.type);

  // ── User name / initials ──
  const userName = profile.name ?? session.user.name ?? 'there';
  const parts = userName.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : userName.slice(0, 2).toUpperCase();

  // ── Radio shows (real ones if DJ, else discover feed shows) ──
  let radioShows: WorkbenchData['radioShows'] = [];
  const radioRows = await db.show.findMany({
    where: { isRadioShow: true, status: { not: 'CANCELED' } },
    include: { promoterProfile: { select: { name: true } } },
    orderBy: { startsAt: 'asc' },
    take: 6
  });
  radioShows = radioRows.map((r, i) => ({
    id: r.id,
    name: r.title,
    host: (r as any).promoterProfile?.name ?? 'iHYPE Radio',
    time: r.startsAt.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
    next: r.startsAt > now ? r.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'live now',
    live: r.status === 'LIVE',
    listeners: 0,
    color: COLORS[i % COLORS.length],
    desc: r.description ?? `A radio show on iHYPE featuring independent artists.`,
  }));

  // ── Tickets from upcoming shows ──
  const wbTickets = eventsResult.upcoming.slice(0, 3).map((s) => ({
    id: s.id,
    showName: `${s.title}${(s as any).venueProfile?.name ? ' @ ' + (s as any).venueProfile.name : ''}`,
    date: s.startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    seat: 'General Admission',
    price: s.ticketPriceCents ? s.ticketPriceCents / 100 : 0,
    status: 'CONFIRMED',
    code: `iH-${s.id.slice(0, 8).toUpperCase()}`,
  }));

  // ── Life stats ──
  const [totalHype, totalEarnings, songsPlayed, eventsAttended] = await Promise.all([
    db.profileHypeEvent.count({ where: { profileId: profile.id } }).catch(() => 0),
    db.ticketOrder.aggregate({ where: { buyerUserId: userId }, _sum: { subtotalCents: true } }).then(r => Math.round((r._sum.subtotalCents ?? 0) / 100)).catch(() => 0),
    db.mediaListen.count({ where: { userId } }).catch(() => 0),
    db.ticketOrder.count({ where: { buyerUserId: userId, status: 'CAPTURED' } }).catch(() => 0),
  ]);
  const lifeStats = { totalHype, totalEarnings, songsPlayed, eventsAttended };

  const pendingVenueRequestCount = profile.type === 'VENUE'
    ? await db.venueConnectionRequest.count({ where: { venueProfileId: profile.id, status: 'PENDING' } }).catch(() => 0)
    : 0;
  const referralStats = profile.type === 'DJ'
    ? await Promise.all([
        db.ticketOrder.count({ where: { affiliatePromoterProfileId: profile.id, status: { not: 'VOID' } } }),
        db.ticketOrder.aggregate({
          where: { affiliatePromoterProfileId: profile.id, status: { not: 'VOID' } },
          _sum: { totalChargeCents: true, promoterPayoutCents: true }
        })
      ]).then(([buyers, sums]) => ({
        clicks: buyers,
        buyers,
        grossCents: sums._sum.totalChargeCents ?? 0,
        payoutCents: sums._sum.promoterPayoutCents ?? 0
      })).catch(() => ({ clicks: 0, buyers: 0, grossCents: 0, payoutCents: 0 }))
    : undefined;

  // ── Fan activity feed (recent uploads + upcoming shows from hyped profiles) ──
  let fanActivityFeed: WbActivity[] = [];
  if (profile.type === 'LISTENER') {
    const hypedProfiles = await db.profileHypeEvent.findMany({
      where: { userId },
      select: { profileId: true },
      take: 50
    }).catch(() => [] as { profileId: string }[]);
    const hypedIds = hypedProfiles.map(h => h.profileId);
    if (hypedIds.length > 0) {
      const [recentUploads, upcomingFromHyped] = await Promise.all([
        db.artistMediaAsset.findMany({
          where: { profileId: { in: hypedIds }, createdAt: { gte: thirtyDaysAgo } },
          include: { profile: { select: { name: true, slug: true } } },
          orderBy: { createdAt: 'desc' },
          take: 12
        }).catch(() => []),
        db.show.findMany({
          where: {
            status: { not: 'CANCELED' },
            startsAt: { gte: now },
            OR: [
              { headlinerProfileId: { in: hypedIds } },
              { promoterProfileId: { in: hypedIds } },
              { venueProfileId: { in: hypedIds } }
            ]
          },
          include: { venueProfile: { select: { name: true } }, headlinerProfile: { select: { name: true } } },
          orderBy: { startsAt: 'asc' },
          take: 8
        }).catch(() => [])
      ]);
      const uploadItems: WbActivity[] = recentUploads.map((m: any) => ({
        text: `${m.profile?.name ?? 'An artist'} uploaded "${m.title}"`,
        time: m.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        kind: 'hype' as const,
      }));
      const showItems: WbActivity[] = upcomingFromHyped.map((s: any) => ({
        text: `${s.headlinerProfile?.name ?? s.title}${s.venueProfile?.name ? ' @ ' + s.venueProfile.name : ''}`,
        time: s.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        kind: 'show' as const,
      }));
      fanActivityFeed = [...uploadItems, ...showItems].slice(0, 20);
    }
  }

  // ── Greeting subtitle ──
  const nextShow = eventsResult.upcoming[0];
  const greetingSub = nextShow
    ? `Your next show: ${nextShow.title} on ${nextShow.startsAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`
    : discoverFeed.mediaEntries.length > 0
    ? `${discoverFeed.mediaEntries.length} new tracks in your discover feed.`
    : `Welcome to your iHYPE workbench, ${roleLabel(profile.type)}.`;
  const emailVerified = (session.user as { emailVerified?: Date | string | null }).emailVerified ?? null;
  const needsEmailVerification = !emailVerified && Boolean(session.user.email);
  const profileCompletion = getProfileCompletion(profile, eventsResult.upcoming.length + eventsResult.past.length);
  const notificationCandidates: Array<WbNotification | null> = [
    needsEmailVerification ? {
      id: 'verify-email',
      title: 'Verify your email',
      body: 'Keep ticket updates, booking requests, and security alerts deliverable.',
      time: 'now',
      kind: 'security',
      href: '/verify-email',
      actionLabel: 'Verify',
      unread: true
    } : null,
    profileCompletion.percent < 100 ? {
      id: 'profile-completion',
      title: 'Finish your public page',
      body: `${profileCompletion.missing.slice(0, 2).join(' + ') || 'A few details'} will make discovery and booking easier.`,
      time: 'today',
      kind: 'hype',
      view: 'settings',
      actionLabel: 'Edit page',
      unread: true
    } : null,
    pendingVenueRequestCount > 0 ? {
      id: 'venue-requests',
      title: 'Booking requests waiting',
      body: `${pendingVenueRequestCount} artist or fan recommendation${pendingVenueRequestCount === 1 ? '' : 's'} need a venue response.`,
      time: 'new',
      kind: 'request',
      view: 'venue',
      actionLabel: 'Review',
      unread: true
    } : null,
    nextShow ? {
      id: 'next-show',
      title: 'Upcoming show reminder',
      body: `${nextShow.title} is ${nextShow.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Share it or prep your ticket.`,
      time: 'soon',
      kind: 'show',
      view: 'tickets',
      actionLabel: 'Open',
      unread: false
    } : null,
    profile.type === 'DJ' ? {
      id: 'referral-stats',
      title: 'Referral analytics updated',
      body: `${referralStats?.buyers ?? 0} ticket buyer${(referralStats?.buyers ?? 0) === 1 ? '' : 's'} attributed to your promoter link.`,
      time: 'live',
      kind: 'payout',
      view: 'tickets',
      actionLabel: 'View',
      unread: false
    } : null,
    radioShows[0] ? {
      id: 'radio-pick',
      title: 'Radio curation is active',
      body: `${radioShows[0].name} is available for listeners in the Radio tab.`,
      time: radioShows[0].live ? 'live' : 'next',
      kind: 'radio',
      view: 'studio',
      actionLabel: 'Create yours',
      unread: false
    } : null
  ];
  const notifications = notificationCandidates.filter((item): item is WbNotification => Boolean(item));

  const wbData: WorkbenchData = {
    userName: parts[0] ?? userName,
    userInitials: initials,
    city,
    greeting: greetingSub,
    stats: wbStats,
    tracks: wbTracks,
    shows: wbShows,
    tickets: wbTickets,
    activity: fanActivityFeed.length > 0 ? fanActivityFeed : wbActivity,
    radioShows,
    activeProfileTypes,
    profileType: profile.type,
    profileId: profile.id,
    profileHexId: profile.hexId,
    profilePath: profileHref(profile.type, profile.slug),
    pendingVenueRequestCount,
    profileCompletion,
    notifications,
    referralStats,
    lifeStats,
    listeningNow: discoverFeed.mediaEntries.reduce((a, e) => a + (e.artistHypeCount ?? 0), 0),
    hypedToday: discoverFeed.mediaEntries.slice(0, 10).reduce((a, e) => a + (e.artistHypeCount ?? 0), 0),
    showsTonight: eventsResult.upcoming.filter(s => {
      const diff = s.startsAt.getTime() - now.getTime();
      return diff >= 0 && diff < 24 * 60 * 60 * 1000;
    }).length,
  };

  // Starter pack: only fetched if the user has no signal yet.
  const userTotalHype = await db.hypeEvent.count({ where: { userId } }).catch(() => 0);
  let starterPack: Array<{ id: string; name: string; slug: string; hypeCount: number; city: string | null; genre: string | null }> = [];
  if (userTotalHype === 0 && profile.type === 'LISTENER') {
    const top = await db.profile.findMany({
      where: { type: 'ARTIST' },
      orderBy: [{ verified: 'desc' }, { hypeCount: 'desc' }],
      take: 6,
      select: { id: true, name: true, slug: true, hypeCount: true, city: true, genres: true }
    }).catch(() => []);
    starterPack = top.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      hypeCount: p.hypeCount,
      city: p.city,
      genre: p.genres[0] ?? null,
    }));
  }

  const discoveryStreak = await getDiscoveryStreak(session.user.id).catch(() => 0);

  return (
    <>
      <EmailVerificationBanner needsVerification={needsEmailVerification} />
      {discoveryStreak >= 2 ? (
        <div className="container" style={{ paddingTop: 12 }}>
          <div className="badge" style={{ display: 'inline-flex', gap: 6 }}>
            <span aria-hidden>{'\u{1F525}'}</span>
            <strong>{discoveryStreak} day streak</strong>
          </div>
        </div>
      ) : null}
      <WorkbenchShell data={wbData} starterPack={starterPack} />
    </>
  );
}

// ── Data helpers ─────────────────────────────────────────────────────

type ShowRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  startsAt: Date;
  isTicketed: boolean;
  hypeCount: number;
  ticketCapacity?: number | null;
  ticketPriceCents?: number | null;
  ticketsSoldCount: number;
  venueProfile?: { name: string; slug: string } | null;
  headlinerProfile?: { name: string; slug: string } | null;
  promoterProfile?: { name: string; slug: string } | null;
};

async function fetchEvents(
  profile: { id: string; type: ProfileType },
  userId: string,
  now: Date
): Promise<{ upcoming: ShowRow[]; past: ShowRow[] }> {
  const showWhere =
    profile.type === 'ARTIST' ? { headlinerProfileId: profile.id }
    : profile.type === 'DJ'   ? { promoterProfileId: profile.id }
    : profile.type === 'VENUE' ? { venueProfileId: profile.id }
    : null;

  if (!showWhere) {
    const hyped = await db.hypeEvent.findMany({
      where: { userId },
      include: {
        show: {
          include: {
            venueProfile:   { select: { name: true, slug: true } },
            headlinerProfile: { select: { name: true, slug: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const shows = hyped.map(h => h.show).filter(Boolean) as ShowRow[];
    return {
      upcoming: shows.filter(s => s.status === 'LIVE' || s.startsAt >= now),
      past:     shows.filter(s => s.status === 'ENDED' || (s.startsAt < now && s.status !== 'LIVE'))
    };
  }

  const shows = await db.show.findMany({
    where: { ...showWhere, status: { not: 'CANCELED' } },
    include: {
      venueProfile:    { select: { name: true, slug: true } },
      headlinerProfile: { select: { name: true, slug: true } },
      promoterProfile:  { select: { name: true, slug: true } }
    },
    orderBy: { startsAt: 'asc' },
    take: 20
  }) as ShowRow[];

  return {
    upcoming: shows.filter(s => s.status === 'LIVE' || s.startsAt >= now),
    past:     shows.filter(s => s.status === 'ENDED' || (s.startsAt < now && s.status !== 'LIVE'))
  };
}

async function fetchStats(
  profile: { id: string; type: ProfileType; slug: string; hypeCount: number },
  userId: string,
  thirtyDaysAgo: Date,
  now: Date
): Promise<Array<{ label: string; value: string | number }>> {
  if (profile.type === 'ARTIST') {
    const [mediaListens, showListens, recentHypes, upcomingCount] = await Promise.all([
      db.mediaListen.count({ where: { artistProfileSlug: profile.slug, completedAt: { not: null } } }),
      db.showListen.count({ where: { show: { headlinerProfileId: profile.id } } }),
      db.profileHypeEvent.count({ where: { profileId: profile.id, createdAt: { gte: thirtyDaysAgo } } }),
      db.show.count({ where: { headlinerProfileId: profile.id, startsAt: { gte: now }, status: { not: 'CANCELED' } } })
    ]);
    return [
      { label: 'Hype this week', value: profile.hypeCount },
      { label: 'New hypes (30d)', value: recentHypes },
      { label: 'Song listens', value: mediaListens },
      { label: 'Upcoming shows', value: upcomingCount }
    ];
  }

  if (profile.type === 'DJ') {
    const shows = await db.show.findMany({
      where: { promoterProfileId: profile.id, status: { not: 'CANCELED' } },
      select: { id: true, ticketsSoldCount: true }
    });
    const showIds = shows.map(s => s.id);
    const [grossCents, recentHypes] = await Promise.all([
      showIds.length
        ? db.ticketOrder.aggregate({ _sum: { subtotalCents: true }, where: { showId: { in: showIds }, status: { not: 'VOID' } } }).then(r => r._sum.subtotalCents ?? 0)
        : 0,
      db.profileHypeEvent.count({ where: { profileId: profile.id, createdAt: { gte: thirtyDaysAgo } } })
    ]);
    return [
      { label: 'Hype this week',  value: profile.hypeCount },
      { label: 'Tickets sold',    value: shows.reduce((a, r) => a + r.ticketsSoldCount, 0) },
      { label: 'Gross revenue',   value: `$${(grossCents / 100).toFixed(0)}` },
      { label: 'Payout pending',  value: `$${((grossCents * 0.9) / 100).toFixed(0)}` }
    ];
  }

  if (profile.type === 'VENUE') {
    const shows = await db.show.findMany({
      where: { venueProfileId: profile.id, status: { not: 'CANCELED' } },
      select: { id: true, ticketsSoldCount: true }
    });
    const showIds = shows.map(s => s.id);
    const grossCents = showIds.length
      ? await db.ticketOrder.aggregate({ _sum: { subtotalCents: true }, where: { showId: { in: showIds }, status: { not: 'VOID' } } }).then(r => r._sum.subtotalCents ?? 0)
      : 0;
    return [
      { label: 'Hype this week',  value: profile.hypeCount },
      { label: 'Shows hosted',    value: shows.length },
      { label: 'Tickets sold',    value: shows.reduce((a, r) => a + r.ticketsSoldCount, 0) },
      { label: 'Gross revenue',   value: `$${(grossCents / 100).toFixed(0)}` }
    ];
  }

  // Fan
  const [songListens, showListens, recentHypes, upcomingCount] = await Promise.all([
    db.mediaListen.count({ where: { userId, completedAt: { not: null } } }),
    db.showListen.count({ where: { userId } }),
    db.hypeEvent.count({ where: { userId, createdAt: { gte: thirtyDaysAgo } } }),
    db.hypeEvent.count({ where: { userId, show: { startsAt: { gte: now }, status: { not: 'CANCELED' } } } })
  ]);
  return [
    { label: 'Hype this week',   value: profile.hypeCount },
    { label: 'New hypes (30d)',  value: recentHypes },
    { label: 'Songs listened',   value: songListens },
    { label: 'Upcoming events',  value: upcomingCount }
  ];
}
