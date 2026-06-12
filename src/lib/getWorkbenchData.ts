import type { WorkbenchData, WbTrendingProfile } from '@/components/WorkbenchShellV2';
import { db, withDbRetry } from '@/lib/db';
import { MOCK_DATA } from '@/lib/workbench-mock';
import { getArtistUploadStreak } from '@/lib/streaks';
import { getProfilePathForType } from '@/lib/account-routing';

// Accent palette for tracks/shows when no color is stored
const PALETTE = ['#ff5029', '#b983ff', '#22e5d4', '#ff3e9a', '#ffb84a', '#7fb3ff'];

function fmtDuration(secs: number | null | undefined): string {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export async function getWorkbenchData(userId: string): Promise<WorkbenchData> {
  try {
    // Step 1: Lean user + profile scalar query (no nested relations).
    // Keeping this query small prevents slow-join timeouts from the old
    // monolithic query that embedded mediaUploads/shows/AP-entries inline.
    const user = await withDbRetry(() => db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        createdAt: true,
        profiles: {
          select: {
            id: true,
            hexId: true,
            type: true,
            name: true,
            city: true,
            isVerified: true,
            verificationRequested: true,
            hypeCount: true,
            slug: true,
            genres: true,
            stripeConnectOnboarded: true,
            headline: true,
            bio: true,
            aboutContent: true,
            topFiveContent: true,
            mediaContent: true,
            nowPlaying: true,
            links: true,
            merchUrl: true,
            merchContent: true,
            tourContent: true,
            requestContent: true,
            upcomingContent: true,
            previousShowHighlights: true,
            addressLine1: true,
            stateRegion: true,
            postalCode: true,
            country: true,
            hoursText: true,
            parkingDetails: true,
            stayRecommendations: true,
            heroImage: true,
            avatarImage: true,
            logoImage: true,
            galleryImage: true,
            featureVideoUrl: true,
            themePreset: true,
            themeAccentTone: true,
            themeBackdropTone: true,
            pagePublishedAt: true,
            fanShareEnabled: true,
          },
        },
      },
    }));

    if (!user) {
      return MOCK_DATA;
    }

    // Collect profile ids needed for aggregation queries
    const profileIds = user.profiles.map((p) => p.id);

    // Pick primary profile by type priority: ARTIST > DJ > VENUE > LISTENER (fan)
    const TYPE_PRIORITY: Record<string, number> = { ARTIST: 0, DJ: 1, VENUE: 2 };
    const primaryProfile = user.profiles.slice().sort((a, b) =>
      (TYPE_PRIORITY[a.type] ?? 99) - (TYPE_PRIORITY[b.type] ?? 99)
    )[0];
    const isCreatorProfile = primaryProfile && ['ARTIST', 'DJ', 'VENUE'].includes(primaryProfile.type);

    // Step 2: All remaining queries in one Promise.all — every item has .catch()
    // so a single slow or failing query cannot propagate to the outer catch.
    const [
      ticketOrders, hypeEvents, profileHypes, radioShows,
      uploadStreak, hypeSeedDays, weeklyHypeCounts, pastShows,
      hypedToday, listeningNowCount, trendingProfiles,
      mediaUploads, hostedShows, headlinerShows, accountsPayableEntries,
      dbNotifications, weeklyListensCount, totalHypeGivenCount,
      userBadges, dbCollabPosts, dbAvailabilityDates,
    ] = await Promise.all([
      // Fetch user's ticket orders
      db.ticketOrder.findMany({
        where: { buyerUserId: userId, status: { in: ['RESERVED', 'CAPTURED'] } },
        take: 20,
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
      }).catch(() => [] as {
        id: string; confirmationCode: string; status: string;
        show: { id: string; title: string; startsAt: Date; ticketPriceCents: number; venueProfile: { name: string } | null };
        tickets: { id: string; serializedId: string | null; status: string; holderName: string | null }[];
      }[]),
      // Hype events (shows this user hyped) for activity
      db.hypeEvent.findMany({
        where: { userId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, createdAt: true,
          show: { select: { title: true } },
        },
      }).catch(() => [] as { id: string; createdAt: Date; show: { title: string } }[]),
      // Incoming hypes on user's profiles
      db.profileHypeEvent.findMany({
        where: { profile: { ownerId: userId } },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, createdAt: true,
          profile: { select: { name: true } },
        },
      }).catch(() => [] as { id: string; createdAt: Date; profile: { name: string } | null }[]),
      // Radio shows created by user
      db.show.findMany({
        where: { creatorId: userId, isRadioShow: true },
        take: 5,
        orderBy: [{ featured: 'desc' }, { startsAt: 'desc' }],
        select: {
          id: true, title: true, description: true, status: true, startsAt: true, featured: true,
          headlinerProfile: { select: { id: true, name: true } },
        },
      }).catch(() => [] as { id: string; title: string; description: string | null; status: string; startsAt: Date; featured: boolean; headlinerProfile: { id: string; name: string } | null }[]),
      // Upload streak (skip for listener-only profiles)
      isCreatorProfile ? getArtistUploadStreak(primaryProfile!.id).catch(() => 0) : Promise.resolve(0),
      // Hype streak: days with at least one hype seed in last 30 days
      db.seed.findMany({
        where: { userId, action: 'hype', createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }).catch(() => [] as { createdAt: Date }[]),
      // Weekly hype counts per profile
      profileIds.length > 0
        ? db.profileHypeEvent.groupBy({
            by: ['profileId'],
            where: {
              profileId: { in: profileIds },
              createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
            _count: { profileId: true },
            orderBy: { _count: { profileId: 'desc' } },
          }).catch(() => [] as { profileId: string; _count: { profileId: number } }[])
        : Promise.resolve([] as { profileId: string; _count: { profileId: number } }[]),
      // Past shows for creator profiles
      isCreatorProfile && primaryProfile
        ? db.show.findMany({
            where: {
              status: 'ENDED',
              OR: [
                { headlinerProfileId: primaryProfile.id },
                { venueProfileId: primaryProfile.id },
              ],
            },
            take: 4,
            orderBy: { startsAt: 'desc' },
            select: {
              id: true, title: true, startsAt: true, hypeCount: true,
              ticketsSoldCount: true, ticketCapacity: true, ticketPriceCents: true,
              venueProfile: { select: { name: true } },
              headlinerProfile: { select: { name: true } },
            },
          }).catch(() => [] as {
            id: string; title: string; startsAt: Date; hypeCount: number;
            ticketsSoldCount: number; ticketCapacity: number | null; ticketPriceCents: number;
            venueProfile: { name: string } | null; headlinerProfile: { name: string } | null;
          }[])
        : Promise.resolve([] as {
            id: string; title: string; startsAt: Date; hypeCount: number;
            ticketsSoldCount: number; ticketCapacity: number | null; ticketPriceCents: number;
            venueProfile: { name: string } | null; headlinerProfile: { name: string } | null;
          }[]),
      // Global hype count today
      db.hypeEvent.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }).catch(() => 0),
      // Listening now proxy: media listens in last 5 minutes
      db.mediaListen.count({
        where: { completedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
      }).catch(() => 0),
      // Trending artist/DJ profiles
      db.profile.findMany({
        where: { type: { in: ['ARTIST', 'DJ'] }, hypeCount: { gt: 0 }, fanShareEnabled: true },
        orderBy: { hypeCount: 'desc' },
        take: 6,
        select: { id: true, name: true, slug: true, city: true, genres: true, hypeCount: true, avatarImage: true, type: true },
      }).catch(() => [] as { id: string; name: string; slug: string; city: string | null; genres: string[]; hypeCount: number; avatarImage: string | null; type: string }[]),
      // Media uploads for all of the user's profiles
      profileIds.length > 0
        ? db.artistMediaAsset.findMany({
            where: { profileId: { in: profileIds } },
            take: 50,
            orderBy: { createdAt: 'desc' },
            select: { id: true, hexId: true, title: true, storageUrl: true, notes: true, freeUseEnabled: true, profileId: true, durationSecs: true },
          }).catch(() => [] as { id: string; hexId: string; title: string; storageUrl: string | null; notes: string | null; freeUseEnabled: boolean; profileId: string; durationSecs: number | null }[])
        : Promise.resolve([] as { id: string; hexId: string; title: string; storageUrl: string | null; notes: string | null; freeUseEnabled: boolean; profileId: string; durationSecs: number | null }[]),
      // Upcoming hosted shows (venue perspective)
      profileIds.length > 0
        ? db.show.findMany({
            where: { venueProfileId: { in: profileIds }, status: { in: ['SCHEDULED', 'LIVE'] }, startsAt: { gte: new Date() } },
            take: 20,
            orderBy: { startsAt: 'asc' },
            select: {
              id: true, title: true, startsAt: true, hypeCount: true,
              ticketsSoldCount: true, ticketCapacity: true, ticketPriceCents: true,
              venueProfileId: true,
              headlinerProfile: { select: { name: true } },
            },
          }).catch(() => [] as {
            id: string; title: string; startsAt: Date; hypeCount: number;
            ticketsSoldCount: number; ticketCapacity: number | null; ticketPriceCents: number;
            venueProfileId: string | null;
            headlinerProfile: { name: string } | null;
          }[])
        : Promise.resolve([] as {
            id: string; title: string; startsAt: Date; hypeCount: number;
            ticketsSoldCount: number; ticketCapacity: number | null; ticketPriceCents: number;
            venueProfileId: string | null;
            headlinerProfile: { name: string } | null;
          }[]),
      // Upcoming headliner shows (artist/DJ perspective)
      profileIds.length > 0
        ? db.show.findMany({
            where: { headlinerProfileId: { in: profileIds }, status: { in: ['SCHEDULED', 'LIVE'] }, startsAt: { gte: new Date() } },
            take: 20,
            orderBy: { startsAt: 'asc' },
            select: {
              id: true, title: true, startsAt: true, hypeCount: true,
              ticketsSoldCount: true, ticketCapacity: true, ticketPriceCents: true,
              headlinerProfileId: true,
              venueProfile: { select: { name: true } },
            },
          }).catch(() => [] as {
            id: string; title: string; startsAt: Date; hypeCount: number;
            ticketsSoldCount: number; ticketCapacity: number | null; ticketPriceCents: number;
            headlinerProfileId: string | null;
            venueProfile: { name: string } | null;
          }[])
        : Promise.resolve([] as {
            id: string; title: string; startsAt: Date; hypeCount: number;
            ticketsSoldCount: number; ticketCapacity: number | null; ticketPriceCents: number;
            headlinerProfileId: string | null;
            venueProfile: { name: string } | null;
          }[]),
      // Pending payouts for all profiles
      profileIds.length > 0
        ? db.accountsPayableEntry.findMany({
            where: { profileId: { in: profileIds }, status: 'PENDING' },
            take: 50,
            orderBy: { createdAt: 'desc' },
            select: { id: true, amountCents: true, payeeLabel: true, createdAt: true, profileId: true },
          }).catch(() => [] as { id: string; amountCents: number; payeeLabel: string; createdAt: Date; profileId: string | null }[])
        : Promise.resolve([] as { id: string; amountCents: number; payeeLabel: string; createdAt: Date; profileId: string | null }[]),
      // Recent notifications for this user
      db.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, type: true, body: true, read: true, link: true, createdAt: true },
      }).catch(() => [] as { id: string; type: string; body: string; read: boolean; link: string | null; createdAt: Date }[]),
      // Media listens in the last 7 days (weekly listens)
      db.mediaListen.count({
        where: { userId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }).catch(() => 0),
      // Total profile hypes this user has given
      db.profileHypeEvent.count({ where: { userId } }).catch(() => 0),
      // Badges awarded to this user
      db.badge.findMany({
        where: { userId },
        orderBy: { awardedAt: 'desc' },
        select: { type: true, awardedAt: true },
      }).catch(() => [] as { type: string; awardedAt: Date }[]),
      // Collab board posts (recent 20)
      db.collabBoardPost.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, type: true, role: true, body: true, contact: true, createdAt: true, userId: true },
      }).catch(() => [] as { id: string; type: string; role: string; body: string; contact: string | null; createdAt: Date; userId: string }[]),
      // Upcoming availability dates for creator profiles
      isCreatorProfile && primaryProfile
        ? db.availabilityDate.findMany({
            where: { profileId: primaryProfile.id, date: { gte: new Date() } },
            orderBy: { date: 'asc' },
            take: 30,
            select: { id: true, date: true, note: true },
          }).catch(() => [] as { id: string; date: Date; note: string | null }[])
        : Promise.resolve([] as { id: string; date: Date; note: string | null }[]),
    ]);

    // Count songs played by this user
    const songsPlayedCount = await db.mediaListen.count({
      where: { userId },
    }).catch(() => 0);

    // Recent listener counts for radio shows (ShowListen in last 5 min)
    const radioShowIds = radioShows.map(r => r.id);
    const radioListenerRows = radioShowIds.length > 0
      ? await db.showListen.groupBy({
          by: ['showId'],
          where: { showId: { in: radioShowIds }, completedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
          _count: { showId: true },
        }).catch(() => [] as { showId: string; _count: { showId: number } }[])
      : [] as { showId: string; _count: { showId: number } }[];
    const radioListenerMap = new Map(radioListenerRows.map(r => [r.showId, r._count.showId]));

    const followerCount = profileIds.length > 0
      ? await db.follow.count({ where: { followeeProfileId: { in: profileIds } } }).catch(() => 0)
      : 0;

    const venueProfileIds = user.profiles.filter(p => p.type === 'VENUE').map(p => p.id);
    const venueRequests = venueProfileIds.length > 0
      ? await db.venueConnectionRequest.findMany({
          where: { venueProfileId: { in: venueProfileIds }, status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true, artistName: true, note: true, requesterType: true, createdAt: true, status: true,
            artistProfile: { select: { slug: true } },
          },
        }).catch(() => [] as { id: string; artistName: string; note: string | null; requesterType: string; createdAt: Date; status: string; artistProfile: { slug: string } | null }[])
      : [];

    // ── Shape the response ──────────────────────────────────────

    const needsGenreQuiz = (primaryProfile?.genres?.length ?? 0) === 0 && !!primaryProfile;
    const userName = primaryProfile?.name ?? user.name ?? 'Fan';
    const initials = userName.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('');
    const city = primaryProfile?.city ?? '';
    const activeProfileTypes = user.profiles.map((p) => p.type as string);

    // Group fetched nested data by profileId for O(1) lookups
    const mediaByProfile = new Map<string, typeof mediaUploads>();
    for (const m of mediaUploads) {
      const arr = mediaByProfile.get(m.profileId) ?? [];
      arr.push(m);
      mediaByProfile.set(m.profileId, arr);
    }

    const hostedByProfile = new Map<string, typeof hostedShows>();
    for (const s of hostedShows) {
      if (!s.venueProfileId) continue;
      const arr = hostedByProfile.get(s.venueProfileId) ?? [];
      arr.push(s);
      hostedByProfile.set(s.venueProfileId, arr);
    }

    const headlinerByProfile = new Map<string, typeof headlinerShows>();
    for (const s of headlinerShows) {
      if (!s.headlinerProfileId) continue;
      const arr = headlinerByProfile.get(s.headlinerProfileId) ?? [];
      arr.push(s);
      headlinerByProfile.set(s.headlinerProfileId, arr);
    }

    // Tracks from media uploads across all profiles
    const allMedia = user.profiles.flatMap((p) => {
      const uploads = mediaByProfile.get(p.id) ?? [];
      return uploads.slice(0, 8).map((m, i) => ({
        id: m.id,
        title: m.title,
        artistName: primaryProfile?.name ?? userName,
        duration: fmtDuration(m.durationSecs),
        durationSec: m.durationSecs ?? 0,
        hypeCount: 0,
        color: PALETTE[i % PALETTE.length],
        album: 'Single',
        mediaUrl: m.storageUrl ?? '',
      }));
    });

    // Shows from headliner + hosted
    const allShows = user.profiles.flatMap((p) => {
      const pHeadliner = headlinerByProfile.get(p.id) ?? [];
      const pHosted = hostedByProfile.get(p.id) ?? [];
      return [
        ...pHeadliner.map((s) => {
          const now = new Date();
          const diff = s.startsAt.getTime() - now.getTime();
          const sold = s.ticketsSoldCount;
          const cap = s.ticketCapacity ?? 0;
          const nearSold = cap > 0 && sold / cap > 0.85;
          const tonight = diff < 86400000 && diff > 0;
          const thisWeek = diff < 7 * 86400000 && diff > 0;
          const status: 'TONIGHT' | 'THIS WEEK' | 'UPCOMING' | 'NEAR SOLD' = nearSold ? 'NEAR SOLD' : tonight ? 'TONIGHT' : thisWeek ? 'THIS WEEK' : 'UPCOMING';
          return {
            id: s.id,
            name: s.title,
            venue: s.venueProfile?.name ?? 'TBD',
            date: s.startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            time: s.startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            hype: s.hypeCount,
            sold,
            capacity: cap,
            price: Math.round(s.ticketPriceCents / 100),
            status,
          };
        }),
        ...pHosted.map((s) => {
          const now = new Date();
          const diff = s.startsAt.getTime() - now.getTime();
          const sold = s.ticketsSoldCount;
          const cap = s.ticketCapacity ?? 0;
          const nearSold = cap > 0 && sold / cap > 0.85;
          const tonight = diff < 86400000 && diff > 0;
          const thisWeek = diff < 7 * 86400000 && diff > 0;
          const status: 'TONIGHT' | 'THIS WEEK' | 'UPCOMING' | 'NEAR SOLD' = nearSold ? 'NEAR SOLD' : tonight ? 'TONIGHT' : thisWeek ? 'THIS WEEK' : 'UPCOMING';
          return {
            id: s.id,
            name: s.headlinerProfile?.name ?? s.title,
            venue: p.name,
            date: s.startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            time: s.startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            hype: s.hypeCount,
            sold,
            capacity: cap,
            price: Math.round(s.ticketPriceCents / 100),
            status,
          };
        }),
      ];
    });

    // Tickets
    const tickets = ticketOrders.map((o) => {
      const t = o.tickets[0];
      return {
        id: o.id,
        showId: o.show.id,
        showName: o.show.title + (o.show.venueProfile?.name ? ` @ ${o.show.venueProfile.name}` : ''),
        date: o.show.startsAt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
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
    const pendingCents = accountsPayableEntries.reduce((s, e) => s + e.amountCents, 0);

    // Radio shows
    const wbRadioShows = radioShows.map((r, i) => ({
      id: r.id,
      name: r.title,
      host: r.headlinerProfile?.name ?? userName,
      hostProfileId: r.headlinerProfile?.id,
      time: r.startsAt.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
      next: r.status === 'LIVE' ? 'now' : 'upcoming',
      live: r.status === 'LIVE',
      listeners: radioListenerMap.get(r.id) ?? 0,
      color: PALETTE[i % PALETTE.length],
      desc: r.description ?? '',
    }));

    // Stats
    const stats = [
      { label: 'HYPE THIS WEEK', value: String(primaryProfile?.hypeCount ?? 0), delta: '', color: '#ff3e9a' },
      { label: 'PAYOUT PENDING', value: `$${(pendingCents / 100).toFixed(2)}`, delta: '45/45/10', color: '#ffb84a' },
    ];

    // Total hype count
    const totalHype = user.profiles.reduce((s, p) => s + p.hypeCount, 0);

    // Build weekly hype map
    const weeklyMap: Record<string, number> = {};
    for (const row of weeklyHypeCounts) {
      weeklyMap[row.profileId] = row._count.profileId;
    }

    // Primary profile's media uploads and shows (for pageEditor)
    const primaryUploads = primaryProfile ? (mediaByProfile.get(primaryProfile.id) ?? []).slice(0, 8) : [];
    const primaryHosted = primaryProfile ? (hostedByProfile.get(primaryProfile.id) ?? []) : [];
    const primaryHeadliner = primaryProfile ? (headlinerByProfile.get(primaryProfile.id) ?? []) : [];

    const responseData: WorkbenchData = {
      userName,
      userInitials: initials || 'FN',
      city,
      greeting: `Welcome back, ${userName.split(' ')[0]}.`,
      listeningNow: listeningNowCount,
      hypedToday: hypedToday,
      showsTonight: allShows.filter((s) => s.status === 'TONIGHT').length,
      activeProfileTypes,
      hasPublishedPage: user.profiles.some(p => !!p.pagePublishedAt),
      profileType: (primaryProfile?.type as string) ?? 'LISTENER',
      profileId: primaryProfile?.id,
      profileHexId: primaryProfile?.hexId,
      isAdmin: user.role === 'ADMIN',
      profilePath: primaryProfile ? getProfilePathForType(primaryProfile.type, primaryProfile.slug) : '',
      isVerified: primaryProfile?.isVerified ?? false,
      verificationRequested: primaryProfile?.verificationRequested ?? false,
      pendingVenueRequestCount: venueRequests.length,
      profileCompletion: (() => {
        if (!primaryProfile) return { percent: 100, missing: [] };
        const checks: Array<{ label: string; ok: boolean }> = [
          { label: 'Display name', ok: !!primaryProfile.name?.trim() },
          { label: 'Bio', ok: !!primaryProfile.bio?.trim() },
          { label: 'Headline', ok: !!primaryProfile.headline?.trim() },
          { label: 'Avatar image', ok: !!primaryProfile.avatarImage?.trim() },
          { label: 'Hero image', ok: !!primaryProfile.heroImage?.trim() },
          { label: 'Genres', ok: (primaryProfile.genres?.length ?? 0) > 0 },
          { label: 'City', ok: !!primaryProfile.city?.trim() },
        ];
        const ok = checks.filter(c => c.ok).length;
        const missing = checks.filter(c => !c.ok).map(c => c.label);
        return { percent: Math.round((ok / checks.length) * 100), missing, checks };
      })(),
      stats,
      tracks: allMedia.length > 0 ? allMedia : [],
      shows: allShows,
      tickets,
      activity: allActivity,
      radioShows: wbRadioShows,
      notifications: dbNotifications.map(n => ({
        id: n.id,
        title: n.type.replace(/_/g, ' '),
        body: n.body,
        time: timeAgo(n.createdAt),
        kind: (['hype', 'show', 'radio', 'payout', 'request', 'security'] as const).find(k => n.type.toLowerCase().includes(k)) ?? 'hype' as const,
        href: n.link ?? undefined,
        unread: !n.read,
      })),
      venueRequests: venueRequests.map(r => ({
        id: r.id,
        artistName: r.artistName,
        note: r.note,
        requesterType: r.requesterType,
        createdAt: r.createdAt.toISOString(),
        artistProfileSlug: r.artistProfile?.slug ?? null,
        status: r.status as 'PENDING' | 'BOOKED' | 'DISMISSED',
      })),
      badges: userBadges.map(b => ({ type: b.type, awardedAt: b.awardedAt.toISOString() })),
      followerCount,
      availabilityDates: dbAvailabilityDates.map(d => ({ id: d.id, date: d.date.toISOString(), note: d.note })),
      collabPosts: dbCollabPosts.map(p => ({
        id: p.id,
        type: p.type,
        role: p.role,
        body: p.body,
        contact: p.contact,
        createdAt: p.createdAt.toISOString(),
        isOwn: p.userId === userId,
      })),
      uploadStreak: uploadStreak ?? 0,
      hypeStreak: (() => {
        const days = new Set(hypeSeedDays.map(h => {
          const d = new Date(h.createdAt);
          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        }));
        let streak = 0;
        const now = new Date();
        for (let i = 0; i < 30; i++) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          if (!days.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)) break;
          streak++;
        }
        return streak;
      })(),
      needsGenreQuiz: needsGenreQuiz ?? false,
      stripeConnectOnboarded: primaryProfile?.stripeConnectOnboarded ?? false,
      hypeCount7d: primaryProfile ? (weeklyMap[primaryProfile.id] ?? 0) : 0,
      joinedAt: user.createdAt.toISOString(),
      weeklyListens: weeklyListensCount,
      lifeStats: {
        totalHype,
        totalHypeGiven: totalHypeGivenCount,
        totalEarnings: pendingCents / 100,
        songsPlayed: songsPlayedCount,
        eventsAttended: ticketOrders.filter(o => o.status === 'CAPTURED').length,
      },
      trending: trendingProfiles.map((p): WbTrendingProfile => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        type: p.type,
        city: p.city ?? '',
        genre: p.genres[0] ?? '',
        hypeCount: p.hypeCount,
        avatarImage: p.avatarImage ?? '',
      })),
      pageEditor: primaryProfile ? {
        profileId: primaryProfile.id,
        slug: primaryProfile.slug,
        type: primaryProfile.type,
        name: primaryProfile.name,
        headline: primaryProfile.headline ?? '',
        bio: primaryProfile.bio ?? '',
        aboutContent: primaryProfile.aboutContent ?? '',
        topFiveContent: primaryProfile.topFiveContent ?? '',
        mediaContent: primaryProfile.mediaContent ?? '',
        nowPlaying: primaryProfile.nowPlaying ?? '',
        links: primaryProfile.links ?? '',
        merchUrl: primaryProfile.merchUrl ?? '',
        merchContent: primaryProfile.merchContent ?? '',
        tourContent: primaryProfile.tourContent ?? '',
        requestContent: primaryProfile.requestContent ?? '',
        upcomingContent: primaryProfile.upcomingContent ?? '',
        previousShowHighlights: primaryProfile.previousShowHighlights ?? '',
        addressLine1: primaryProfile.addressLine1 ?? '',
        city: primaryProfile.city ?? '',
        stateRegion: primaryProfile.stateRegion ?? '',
        postalCode: primaryProfile.postalCode ?? '',
        country: primaryProfile.country ?? '',
        hoursText: primaryProfile.hoursText ?? '',
        parkingDetails: primaryProfile.parkingDetails ?? '',
        stayRecommendations: primaryProfile.stayRecommendations ?? '',
        heroImage: primaryProfile.heroImage ?? '',
        avatarImage: primaryProfile.avatarImage ?? '',
        logoImage: primaryProfile.logoImage ?? '',
        galleryImage: primaryProfile.galleryImage ?? '',
        featureVideoUrl: primaryProfile.featureVideoUrl ?? '',
        themePreset: primaryProfile.themePreset ?? '',
        themeAccentTone: primaryProfile.themeAccentTone ?? '',
        themeBackdropTone: primaryProfile.themeBackdropTone ?? '',
        fanShareEnabled: primaryProfile.fanShareEnabled ?? false,
        songs: primaryUploads.map((m) => ({
          hexId: m.hexId,
          title: m.title ?? '',
          notes: m.notes ?? null,
          freeUseEnabled: m.freeUseEnabled,
        })),
        upcomingShows: [
          ...primaryHeadliner.map((s) => {
            const cap = s.ticketCapacity ?? 0;
            const sold = s.ticketsSoldCount;
            const nearSold = cap > 0 && sold / cap > 0.85;
            return {
              id: s.id,
              name: s.title,
              venue: s.venueProfile?.name ?? 'TBD',
              date: s.startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              time: s.startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              hype: s.hypeCount,
              sold,
              capacity: cap,
              price: Math.round(s.ticketPriceCents / 100),
              status: (nearSold ? 'NEAR SOLD' : 'UPCOMING') as 'NEAR SOLD' | 'UPCOMING',
            };
          }),
          ...primaryHosted.map((s) => {
            const cap = s.ticketCapacity ?? 0;
            const sold = s.ticketsSoldCount;
            const nearSold = cap > 0 && sold / cap > 0.85;
            return {
              id: s.id,
              name: s.headlinerProfile?.name ?? s.title,
              venue: primaryProfile.name,
              date: s.startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              time: s.startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              hype: s.hypeCount,
              sold,
              capacity: cap,
              price: Math.round(s.ticketPriceCents / 100),
              status: (nearSold ? 'NEAR SOLD' : 'UPCOMING') as 'NEAR SOLD' | 'UPCOMING',
            };
          }),
        ],
        previousShows: pastShows.map((s) => ({
          id: s.id,
          name: s.headlinerProfile?.name ?? s.title,
          venue: s.venueProfile?.name ?? primaryProfile.name,
          date: s.startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          time: s.startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          hype: s.hypeCount,
          sold: s.ticketsSoldCount,
          capacity: s.ticketCapacity ?? 0,
          price: Math.round(s.ticketPriceCents / 100),
          status: 'ENDED' as const,
        })),
      } : undefined,
    };

    return responseData;
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.error('getWorkbenchData error:', msg, e instanceof Error ? e.stack : '');
    // Dynamically capture to Sentry without a static import that breaks the CF Workers bundle
    try {
      const { captureException } = await import('@sentry/nextjs');
      captureException(e, { tags: { location: 'getWorkbenchData' } });
    } catch { /* Sentry unavailable — console.error above is sufficient */ }
    return {
      ...MOCK_DATA,
      degraded: true,
      tracks: [],
      shows: [],
      tickets: [],
      radioShows: [],
      notifications: [],
      venueRequests: [],
      badges: [],
      collabPosts: [],
      availabilityDates: [],
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
