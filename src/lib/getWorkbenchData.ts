import type { WorkbenchData, WbTrendingProfile } from '@/components/WorkbenchShellV2';
import { db, withDbRetry } from '@/lib/db';
import { MOCK_DATA } from '@/lib/workbench-mock';
import { getArtistUploadStreak } from '@/lib/streaks';

// Accent palette for tracks/shows when no color is stored
const PALETTE = ['#ff5029', '#b983ff', '#22e5d4', '#ff3e9a', '#ffb84a', '#7fb3ff'];

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
      uploadStreak, weeklyHypeCounts, pastShows,
      hypedToday, listeningNowCount, trendingProfiles,
      mediaUploads, hostedShows, headlinerShows, accountsPayableEntries,
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
          id: true, title: true, status: true, startsAt: true, featured: true,
          headlinerProfile: { select: { name: true } },
        },
      }).catch(() => [] as { id: string; title: string; status: string; startsAt: Date; featured: boolean; headlinerProfile: { name: string } | null }[]),
      // Upload streak (skip for listener-only profiles)
      isCreatorProfile ? getArtistUploadStreak(primaryProfile!.id).catch(() => 0) : Promise.resolve(0),
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
            select: { id: true, hexId: true, title: true, storageUrl: true, notes: true, freeUseEnabled: true, profileId: true },
          }).catch(() => [] as { id: string; hexId: string; title: string; storageUrl: string | null; notes: string | null; freeUseEnabled: boolean; profileId: string }[])
        : Promise.resolve([] as { id: string; hexId: string; title: string; storageUrl: string | null; notes: string | null; freeUseEnabled: boolean; profileId: string }[]),
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
        duration: '3:00',
        durationSec: 180,
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
      profileType: (primaryProfile?.type as string) ?? 'LISTENER',
      profileId: primaryProfile?.id,
      profileHexId: primaryProfile?.hexId,
      isAdmin: user.role === 'ADMIN',
      profilePath: primaryProfile ? `/${primaryProfile.type.toLowerCase()}s/${primaryProfile.slug}` : '',
      isVerified: primaryProfile?.isVerified ?? false,
      verificationRequested: primaryProfile?.verificationRequested ?? false,
      pendingVenueRequestCount: 0,
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
      notifications: [],
      uploadStreak: uploadStreak ?? 0,
      needsGenreQuiz: needsGenreQuiz ?? false,
      stripeConnectOnboarded: primaryProfile?.stripeConnectOnboarded ?? false,
      hypeCount7d: primaryProfile ? (weeklyMap[primaryProfile.id] ?? 0) : 0,
      lifeStats: {
        totalHype,
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
