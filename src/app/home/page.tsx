import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getSharedDiscoverFeed } from '@/lib/discover-feed';
import { detectRequestLocation } from '@/lib/request-location';
import type { ProfileType } from '@prisma/client';
import { WorkbenchShell, type WorkbenchData, type WbStat, type WbTrack, type WbShow, type WbActivity } from '@/components/WorkbenchShell';

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
    select: { id: true, type: true, slug: true, name: true, hexId: true, hypeCount: true, city: true, stateRegion: true },
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

  // ── Greeting subtitle ──
  const nextShow = eventsResult.upcoming[0];
  const greetingSub = nextShow
    ? `Your next show: ${nextShow.title} on ${nextShow.startsAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`
    : discoverFeed.mediaEntries.length > 0
    ? `${discoverFeed.mediaEntries.length} new tracks in your discover feed.`
    : `Welcome to your iHYPE workbench, ${roleLabel(profile.type)}.`;

  const wbData: WorkbenchData = {
    userName: parts[0] ?? userName,
    userInitials: initials,
    city,
    greeting: greetingSub,
    stats: wbStats,
    tracks: wbTracks,
    shows: wbShows,
    tickets: wbTickets,
    activity: wbActivity,
    radioShows,
    activeProfileTypes,
    profileId: profile.id,
    lifeStats,
    listeningNow: discoverFeed.mediaEntries.reduce((a, e) => a + (e.artistHypeCount ?? 0), 0),
    hypedToday: discoverFeed.mediaEntries.slice(0, 10).reduce((a, e) => a + (e.artistHypeCount ?? 0), 0),
    showsTonight: eventsResult.upcoming.filter(s => {
      const diff = s.startsAt.getTime() - now.getTime();
      return diff >= 0 && diff < 24 * 60 * 60 * 1000;
    }).length,
  };

  return <WorkbenchShell data={wbData} />;
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
