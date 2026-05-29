import type { WorkbenchData } from '@/components/WorkbenchShellV2';
import { db } from '@/lib/db';
import { MOCK_DATA } from '@/lib/workbench-mock';
import { getArtistUploadStreak } from '@/lib/streaks';

// Accent palette for tracks/shows when no color is stored
const PALETTE = ['#ff5029', '#b983ff', '#22e5d4', '#ff3e9a', '#ffb84a', '#7fb3ff'];

export async function getWorkbenchData(userId: string): Promise<WorkbenchData> {
  try {
    // Fetch user + profiles in one query
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        profiles: {
          select: {
            id: true,
            type: true,
            name: true,
            city: true,
            isVerified: true,
            verificationRequested: true,
            hypeCount: true,
            slug: true,
            genres: true,
            mediaUploads: {
              take: 8,
              orderBy: { createdAt: 'desc' },
              select: { id: true, hexId: true, title: true, storageUrl: true },
            },
            hostedShows: {
              where: { status: { in: ['SCHEDULED', 'LIVE'] }, startsAt: { gte: new Date() } },
              take: 4,
              orderBy: { startsAt: 'asc' },
              select: {
                id: true, title: true, startsAt: true, hypeCount: true,
                ticketsSoldCount: true, ticketCapacity: true, ticketPriceCents: true,
                headlinerProfile: { select: { name: true } },
              },
            },
            headlinerShows: {
              where: { status: { in: ['SCHEDULED', 'LIVE'] }, startsAt: { gte: new Date() } },
              take: 4,
              orderBy: { startsAt: 'asc' },
              select: {
                id: true, title: true, startsAt: true, hypeCount: true,
                ticketsSoldCount: true, ticketCapacity: true, ticketPriceCents: true,
                venueProfile: { select: { name: true } },
              },
            },
            accountsPayableEntries: {
              where: { status: 'PENDING' },
              take: 10,
              orderBy: { createdAt: 'desc' },
              select: { id: true, amountCents: true, payeeLabel: true, createdAt: true },
            },
          },
        },
      },
    });

    if (!user) {
      return MOCK_DATA;
    }

    // Fetch remaining data in parallel — none of these depend on each other
    const primaryProfile = user.profiles[0];
    const [ticketOrders, hypeEvents, profileHypes, radioShows, uploadStreak] = await Promise.all([
      // Fetch user's ticket orders
      db.ticketOrder.findMany({
        where: { buyerUserId: userId, status: { in: ['RESERVED', 'CAPTURED'] } },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, confirmationCode: true, status: true,
          show: {
            select: {
              id: true, title: true, startsAt: true, ticketPriceCents: true,
              venueProfile: { select: { name: true } },
            },
          },
          tickets: {
            take: 1,
            select: { id: true, serializedId: true, status: true, holderName: true },
          },
        },
      }),
      // Fetch hype events (shows this user hyped) for activity
      db.hypeEvent.findMany({
        where: { userId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, createdAt: true,
          show: { select: { title: true } },
        },
      }),
      // Fetch incoming hypes on user's profiles
      db.profileHypeEvent.findMany({
        where: {
          profile: { ownerId: userId },
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          profile: { select: { name: true } },
        },
      }).catch(() => [] as { id: string; createdAt: Date; profile: { name: string } | null }[]),
      // Fetch radio shows (user-created)
      db.show.findMany({
        where: { creatorId: userId, isRadioShow: true },
        take: 5,
        orderBy: { startsAt: 'desc' },
        select: {
          id: true, title: true, status: true, startsAt: true,
          headlinerProfile: { select: { name: true } },
        },
      }),
      getArtistUploadStreak(primaryProfile?.id ?? ''),
    ]);

    // Count songs played by this user
    const songsPlayedCount = await db.mediaListen.count({
      where: { userId },
    }).catch(() => 0);

    // ── Shape the response ──────────────────────────────────────

    const needsGenreQuiz = (primaryProfile?.genres?.length ?? 0) === 0 && !!primaryProfile;
    const userName = primaryProfile?.name ?? user.name ?? 'Fan';
    const initials = userName.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('');
    const city = primaryProfile?.city ?? '';
    const activeProfileTypes = user.profiles.map((p) => p.type as string);

    // Tracks from media uploads across all profiles
    const allMedia = user.profiles.flatMap((p) => p.mediaUploads.map((m, i) => ({
      id: m.id,
      title: m.title,
      artistName: primaryProfile?.name ?? userName,
      duration: '3:00',
      durationSec: 180,
      hypeCount: 0,
      color: PALETTE[i % PALETTE.length],
      album: 'Single',
      mediaUrl: m.storageUrl ?? '',
    })));

    // Shows from headliner + hosted
    const allShows = user.profiles.flatMap((p) => [
      ...p.headlinerShows.map((s) => {
        const now = new Date();
        const diff = s.startsAt.getTime() - now.getTime();
        const tonight = diff < 86400000 && diff > 0;
        const thisWeek = diff < 7 * 86400000 && diff > 0;
        const status: 'TONIGHT' | 'THIS WEEK' | 'UPCOMING' = tonight ? 'TONIGHT' : thisWeek ? 'THIS WEEK' : 'UPCOMING';
        return {
          id: s.id,
          name: s.title,
          venue: s.venueProfile?.name ?? 'TBD',
          date: s.startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          time: s.startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          hype: s.hypeCount,
          sold: s.ticketsSoldCount,
          capacity: s.ticketCapacity ?? 0,
          price: Math.round(s.ticketPriceCents / 100),
          status,
        };
      }),
      ...p.hostedShows.map((s) => {
        const now = new Date();
        const diff = s.startsAt.getTime() - now.getTime();
        const tonight = diff < 86400000 && diff > 0;
        const thisWeek = diff < 7 * 86400000 && diff > 0;
        const status: 'TONIGHT' | 'THIS WEEK' | 'UPCOMING' = tonight ? 'TONIGHT' : thisWeek ? 'THIS WEEK' : 'UPCOMING';
        return {
          id: s.id,
          name: s.headlinerProfile?.name ?? s.title,
          venue: primaryProfile?.name ?? 'Venue',
          date: s.startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          time: s.startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          hype: s.hypeCount,
          sold: s.ticketsSoldCount,
          capacity: s.ticketCapacity ?? 0,
          price: Math.round(s.ticketPriceCents / 100),
          status,
        };
      }),
    ]);

    // Tickets
    const tickets = ticketOrders.map((o) => {
      const t = o.tickets[0];
      return {
        id: o.id,
        showId: o.show.id,
        showName: o.show.title + (o.show.venueProfile?.name ? ` @ ${o.show.venueProfile.name}` : ''),
        date: o.show.startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
        seat: 'GA',
        price: Math.round(o.show.ticketPriceCents / 100),
        status: t?.status === 'VALID' ? 'CONFIRMED' : (t?.status ?? 'CONFIRMED'),
        code: t?.serializedId ?? o.confirmationCode,
      };
    });

    // Activity — merge outgoing hypes with incoming profile hypes
    const allActivity = [
      ...hypeEvents.map((h) => ({
        text: `You hyped ${h.show.title}`,
        time: timeAgo(h.createdAt),
        kind: 'hype' as const,
      })),
      ...profileHypes.map((ph) => ({
        text: `Someone hyped ${ph.profile?.name ?? 'your profile'}`,
        time: timeAgo(ph.createdAt),
        kind: 'hype' as const,
      })),
    ].slice(0, 10);

    // Pending payout
    const pendingCents = user.profiles.flatMap((p) => p.accountsPayableEntries).reduce((s, e) => s + e.amountCents, 0);

    // Radio shows
    const wbRadioShows = radioShows.map((r, i) => ({
      id: r.id,
      name: r.title,
      host: r.headlinerProfile?.name ?? userName,
      time: r.startsAt.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
      next: r.status === 'LIVE' ? 'now' : 'upcoming',
      live: r.status === 'LIVE',
      listeners: 0,
      color: PALETTE[i % PALETTE.length],
      desc: '',
    }));

    // Stats
    const stats = [
      { label: 'HYPE THIS WEEK', value: String(primaryProfile?.hypeCount ?? 0), delta: '', color: '#ff3e9a' },
      { label: 'PAYOUT PENDING', value: `$${(pendingCents / 100).toFixed(2)}`, delta: '45/45/10', color: '#ffb84a' },
    ];

    // Total hype count
    const totalHype = user.profiles.reduce((s, p) => s + p.hypeCount, 0);

    const responseData: WorkbenchData = {
      userName,
      userInitials: initials || 'FN',
      city,
      greeting: `Welcome back, ${userName.split(' ')[0]}.`,
      listeningNow: 0,
      hypedToday: 0,
      showsTonight: allShows.filter((s) => s.status === 'TONIGHT').length,
      activeProfileTypes,
      profileType: (primaryProfile?.type as string) ?? 'LISTENER',
      isAdmin: user.role === 'ADMIN',
      profilePath: primaryProfile ? `/${primaryProfile.type.toLowerCase()}s/${primaryProfile.slug}` : '',
      isVerified: primaryProfile?.isVerified ?? false,
      verificationRequested: primaryProfile?.verificationRequested ?? false,
      pendingVenueRequestCount: 0,
      profileCompletion: { percent: 100, missing: [] },
      stats,
      tracks: allMedia.length > 0 ? allMedia : [],
      shows: allShows,
      tickets,
      activity: allActivity,
      radioShows: wbRadioShows,
      notifications: [],
      uploadStreak: uploadStreak ?? 0,
      needsGenreQuiz: needsGenreQuiz ?? false,
      lifeStats: {
        totalHype,
        totalEarnings: pendingCents / 100,
        songsPlayed: songsPlayedCount,
        eventsAttended: 0,
      },
    };

    return responseData;
  } catch (e) {
    console.error('getWorkbenchData error:', e);
    return {
      ...MOCK_DATA,
      degraded: true,
      tracks: [],
      shows: [],
      tickets: [],
      radioShows: [],
      notifications: [],
    };
  }
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
