import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getSharedDiscoverFeed } from '@/lib/discover-feed';
import { buildHypeQueue, type HypeQueueRole } from '@/lib/hype-queue';
import { detectRequestLocation } from '@/lib/request-location';
import { buildArtistMediaCollection } from '@/lib/media';
import { HypeQueue } from '@/components/HypeQueue';
import { HomeInlineSearch } from '@/components/HomeInlineSearch';
import { PromoterShowCreationTool } from '@/components/PromoterShowCreationTool';
import type { ProfileType } from '@prisma/client';

export const dynamic = 'force-dynamic';

function roleLabel(type: ProfileType): string {
  if (type === 'DJ') return 'Promoter';
  if (type === 'VENUE') return 'Venue';
  if (type === 'LISTENER') return 'Fan';
  return 'Artist';
}

function hypeQueueRole(type: ProfileType): HypeQueueRole {
  if (type === 'DJ') return 'promoter';
  if (type === 'VENUE') return 'venue';
  if (type === 'LISTENER') return 'fan';
  return 'artist';
}

function discoverHref(type: ProfileType): string {
  if (type === 'DJ') return '/promoters';
  if (type === 'VENUE') return '/venues';
  if (type === 'LISTENER') return '/fans';
  return '/artists';
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;
  const role = session.user.role as string | null | undefined;

  // Determine primary profile type from role
  const profileTypeMap: Record<string, ProfileType> = {
    ARTIST: 'ARTIST',
    DJ: 'DJ',
    VENUE: 'VENUE',
    FAN: 'LISTENER'
  };
  const preferredType = role ? (profileTypeMap[role] ?? null) : null;

  // Look up primary profile
  const profile = await db.profile.findFirst({
    where: preferredType
      ? { ownerId: userId, type: preferredType }
      : { ownerId: userId },
    select: {
      id: true,
      type: true,
      slug: true,
      name: true,
      hexId: true,
      hypeCount: true,
      genres: true,
      city: true,
      stateRegion: true,
      country: true,
      verified: true
    },
    orderBy: { createdAt: 'asc' }
  });

  if (!profile) redirect('/dashboard');

  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Fetch role-specific data in parallel
  const [discoverFeed, viewerLocation, statsResult, eventsResult] = await Promise.all([
    getSharedDiscoverFeed(null),
    detectRequestLocation(),
    fetchStats(profile, userId, thirtyDaysAgo, now),
    fetchEvents(profile, userId, now)
  ]);

  const viewerLocationLabel =
    [viewerLocation?.city, viewerLocation?.stateRegion ?? viewerLocation?.country]
      .filter(Boolean)
      .join(', ') || 'your area';

  const hypeQueueItems = buildHypeQueue({
    role: hypeQueueRole(profile.type),
    viewerLocationLabel,
    mediaEntries: discoverFeed.mediaEntries,
    hypedNearMe: discoverFeed.hypedNearMe,
    newArtists: discoverFeed.newArtists,
    newPromoters: discoverFeed.newPromoters,
    shows: eventsResult.upcoming.slice(0, 3).map((s) => ({
      title: s.title,
      headlinerSlug: (s as any).headlinerProfile?.slug ?? null,
      headlinerName: (s as any).headlinerProfile?.name ?? null,
      venueName: (s as any).venueProfile?.name ?? null
    }))
  });

  // Data for show creator (DJ/promoter + venue roles)
  let showCreatorData: {
    artists: Parameters<typeof PromoterShowCreationTool>[0]['artists'];
    promoters: Parameters<typeof PromoterShowCreationTool>[0]['promoters'];
    venues: Parameters<typeof PromoterShowCreationTool>[0]['venues'];
  } | null = null;

  if (profile.type === 'DJ') {
    const [artistProfiles, venueOptions] = await Promise.all([
      db.profile.findMany({
        where: {
          type: 'ARTIST',
          OR: [
            { mediaContent: { not: null } },
            { mediaUploads: { some: {} } },
            { featureVideoUrl: { not: null } }
          ]
        },
        select: {
          id: true,
          slug: true,
          hexId: true,
          name: true,
          heroImage: true,
          galleryImage: true,
          featureVideoUrl: true,
          mediaContent: true,
          mediaUploads: {
            select: {
              hexId: true,
              title: true,
              notes: true,
              mimeType: true,
              fileSizeBytes: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { name: 'asc' }
      }),
      db.profile.findMany({
        where: { type: 'VENUE' },
        select: {
          id: true,
          slug: true,
          name: true,
          addressLine1: true,
          city: true,
          stateRegion: true,
          country: true,
          postalCode: true
        },
        orderBy: { name: 'asc' },
        take: 50
      })
    ]);

    const artists = artistProfiles
      .map((ap) => {
        const builtEntries = buildArtistMediaCollection(ap.mediaContent, ap.mediaUploads).entries;
        const featureVideoEntry = ap.featureVideoUrl
          ? [{
              id: `${ap.hexId.slice(0, -2)}fe`,
              hexId: `${ap.hexId.slice(0, -2)}fe`,
              title: `${ap.name} feature video`,
              url: ap.featureVideoUrl,
              notes: 'Feature video from the artist page builder.',
              mimeType: 'video/mp4',
              mediaType: 'video' as const,
              previewImageUrl: ap.galleryImage ?? ap.heroImage ?? null
            }]
          : [];
        return {
          profileId: ap.id,
          slug: ap.slug,
          name: ap.name,
          heroImage: ap.heroImage,
          entries: [...featureVideoEntry, ...builtEntries]
        };
      })
      .filter((a) => a.entries.length > 0);

    showCreatorData = {
      artists,
      promoters: [{ profileId: profile.id, name: profile.name, slug: profile.slug }],
      venues: venueOptions.map((v) => ({
        profileId: v.id,
        slug: v.slug,
        name: v.name,
        addressLine1: v.addressLine1,
        city: v.city,
        stateRegion: v.stateRegion,
        country: v.country,
        postalCode: v.postalCode
      }))
    };
  }

  const profilePath = profile.type === 'DJ'
    ? `/promoters/${profile.slug}`
    : profile.type === 'VENUE'
    ? `/venues/${profile.slug}`
    : profile.type === 'LISTENER'
    ? `/fans/${profile.slug}`
    : `/artists/${profile.slug}`;

  const allEvents = [...eventsResult.upcoming, ...eventsResult.past.slice(0, 5)];

  return (
    <>
      <div className="site-subnav-shell">
        <nav aria-label="Home navigation" className="container site-subnav">
          <span className="site-subnav-label">Home</span>
          <span className="badge" style={{ marginLeft: '0.25rem' }}>{roleLabel(profile.type)}</span>
          <div className="site-subnav-divider" aria-hidden="true" />
          <Link className="site-subnav-link" href={profilePath}>My Page</Link>
          <Link className="site-subnav-link" href="/dashboard">Dashboard</Link>
          <Link className="site-subnav-link site-subnav-link-utility" href={discoverHref(profile.type)}>
            Discover
          </Link>
        </nav>
      </div>

      <main className="container section home-page">

        {/* Stats strip */}
        <section className="home-stats-strip" aria-label="My stats">
          <div className="home-stats-head">
            <strong>{profile.name}</strong>
            <span className="meta">{roleLabel(profile.type)}</span>
          </div>
          <div className="home-stats-pills">
            {statsResult.map((stat) => (
              <div className="home-stat-pill" key={stat.label}>
                <span className="home-stat-value">{stat.value}</span>
                <span className="home-stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Two-column layout: HYPE Queue + Events */}
        <div className="home-grid">
          <section className="home-queue-section" aria-labelledby="hype-queue-heading">
            <div className="home-section-head">
              <h2 id="hype-queue-heading">HYPE Queue</h2>
              <p className="meta">Music curated for your role signal — every play strengthens the feed.</p>
            </div>
            <HypeQueue items={hypeQueueItems} />
          </section>

          <aside className="home-sidebar">
            {/* Inline search */}
            <section className="home-search-section" aria-labelledby="search-heading">
              <div className="home-section-head">
                <h2 id="search-heading">Search</h2>
              </div>
              <HomeInlineSearch />
            </section>

            {/* Upcoming events */}
            <section className="home-events-section" aria-labelledby="events-heading">
              <div className="home-section-head">
                <h2 id="events-heading">Events</h2>
                <span className="meta">{eventsResult.upcoming.length} upcoming</span>
              </div>

              {allEvents.length === 0 ? (
                <p className="meta">No events attached to your page yet.</p>
              ) : (
                <ul className="home-events-list">
                  {allEvents.map((show) => {
                    const isPast = show.status === 'ENDED' ||
                      (show.startsAt < now && show.status !== 'LIVE' && show.status !== 'SCHEDULED');
                    const isLive = show.status === 'LIVE';
                    return (
                      <li
                        className={`home-event-card ${isLive ? 'home-event-live' : isPast ? 'home-event-past' : ''}`}
                        key={show.id}
                      >
                        <div className="home-event-date">
                          {isLive ? (
                            <span className="home-event-live-badge">LIVE</span>
                          ) : (
                            <>
                              <strong>{formatDate(show.startsAt)}</strong>
                              <span className="meta">{formatTime(show.startsAt)}</span>
                            </>
                          )}
                        </div>
                        <div className="home-event-info">
                          <Link className="home-event-title" href={`/shows/${show.slug}`}>
                            {show.title}
                          </Link>
                          {(show as any).venueProfile?.name && (
                            <span className="meta">{(show as any).venueProfile.name}</span>
                          )}
                          {(show as any).headlinerProfile?.name && profile.type !== 'ARTIST' && (
                            <span className="meta">{(show as any).headlinerProfile.name}</span>
                          )}
                        </div>
                        {isPast && <span className="badge">Ended</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>
        </div>

        {/* Show Creator (DJ/promoter role only) */}
        {profile.type === 'DJ' && showCreatorData && (
          <section className="home-show-creator-section" aria-labelledby="show-creator-heading">
            <div className="home-section-head">
              <h2 id="show-creator-heading">Show Creator</h2>
              <p className="meta">
                Build your next show. The <strong>Set List</strong> tab lets you search any artist&apos;s tracks and arrange the order.
              </p>
            </div>
            <PromoterShowCreationTool
              artists={showCreatorData.artists}
              initialPromoterProfileId={profile.id}
              promoters={showCreatorData.promoters}
              venues={showCreatorData.venues}
            />
          </section>
        )}
      </main>
    </>
  );
}

// ─── Data helpers ────────────────────────────────────────────────────────────

type ShowRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  startsAt: Date;
  isTicketed: boolean;
  hypeCount: number;
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
    profile.type === 'ARTIST'
      ? { headlinerProfileId: profile.id }
      : profile.type === 'DJ'
      ? { promoterProfileId: profile.id }
      : profile.type === 'VENUE'
      ? { venueProfileId: profile.id }
      : null;

  if (!showWhere) {
    // Fan: shows they've hyped
    const hyped = await db.hypeEvent.findMany({
      where: { userId },
      include: {
        show: {
          include: {
            venueProfile: { select: { name: true, slug: true } },
            headlinerProfile: { select: { name: true, slug: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const shows = hyped.map((h) => h.show).filter(Boolean) as ShowRow[];
    return {
      upcoming: shows.filter((s) => s.status === 'LIVE' || s.startsAt >= now),
      past: shows.filter((s) => s.status === 'ENDED' || (s.startsAt < now && s.status !== 'LIVE'))
    };
  }

  const shows = await db.show.findMany({
    where: { ...showWhere, status: { not: 'CANCELED' } },
    include: {
      venueProfile: { select: { name: true, slug: true } },
      headlinerProfile: { select: { name: true, slug: true } },
      promoterProfile: { select: { name: true, slug: true } }
    },
    orderBy: { startsAt: 'asc' },
    take: 20
  }) as ShowRow[];

  return {
    upcoming: shows.filter((s) => s.status === 'LIVE' || s.startsAt >= now),
    past: shows.filter((s) => s.status === 'ENDED' || (s.startsAt < now && s.status !== 'LIVE'))
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
      { label: 'Fan hype', value: profile.hypeCount },
      { label: 'New hypes (30d)', value: recentHypes },
      { label: 'Song listens', value: mediaListens },
      { label: 'Show listens', value: showListens },
      { label: 'Upcoming shows', value: upcomingCount }
    ];
  }

  if (profile.type === 'DJ') {
    const shows = await db.show.findMany({
      where: { promoterProfileId: profile.id, status: { not: 'CANCELED' } },
      select: { id: true, venueProfileId: true, ticketsSoldCount: true }
    });
    const showIds = shows.map((s) => s.id);
    const [grossCents, recentHypes] = await Promise.all([
      showIds.length
        ? db.ticketOrder.aggregate({
            _sum: { subtotalCents: true },
            where: { showId: { in: showIds }, status: { not: 'VOID' } }
          }).then((r) => r._sum.subtotalCents ?? 0)
        : 0,
      db.profileHypeEvent.count({ where: { profileId: profile.id, createdAt: { gte: thirtyDaysAgo } } })
    ]);
    const ticketsSold = shows.reduce((s, r) => s + r.ticketsSoldCount, 0);
    const venueCount = new Set(shows.map((s) => s.venueProfileId).filter(Boolean)).size;
    return [
      { label: 'Fan hype', value: profile.hypeCount },
      { label: 'New hypes (30d)', value: recentHypes },
      { label: 'Gross revenue', value: `$${(grossCents / 100).toFixed(0)}` },
      { label: 'Tickets sold', value: ticketsSold },
      { label: 'Shows', value: shows.length },
      { label: 'Venues', value: venueCount }
    ];
  }

  if (profile.type === 'VENUE') {
    const shows = await db.show.findMany({
      where: { venueProfileId: profile.id, status: { not: 'CANCELED' } },
      select: { id: true, headlinerProfileId: true, ticketsSoldCount: true }
    });
    const showIds = shows.map((s) => s.id);
    const [grossCents, recentHypes] = await Promise.all([
      showIds.length
        ? db.ticketOrder.aggregate({
            _sum: { subtotalCents: true },
            where: { showId: { in: showIds }, status: { not: 'VOID' } }
          }).then((r) => r._sum.subtotalCents ?? 0)
        : 0,
      db.profileHypeEvent.count({ where: { profileId: profile.id, createdAt: { gte: thirtyDaysAgo } } })
    ]);
    const artistCount = new Set(shows.map((s) => s.headlinerProfileId).filter(Boolean)).size;
    return [
      { label: 'Fan hype', value: profile.hypeCount },
      { label: 'New hypes (30d)', value: recentHypes },
      { label: 'Gross revenue', value: `$${(grossCents / 100).toFixed(0)}` },
      { label: 'Shows hosted', value: shows.length },
      { label: 'Artists hosted', value: artistCount }
    ];
  }

  // Fan (LISTENER)
  const [songListens, showListens, recentHypes, upcomingCount] = await Promise.all([
    db.mediaListen.count({ where: { userId, completedAt: { not: null } } }),
    db.showListen.count({ where: { userId } }),
    db.hypeEvent.count({ where: { userId, createdAt: { gte: thirtyDaysAgo } } }),
    db.hypeEvent.count({
      where: { userId, show: { startsAt: { gte: now }, status: { not: 'CANCELED' } } }
    })
  ]);
  return [
    { label: 'Hype points', value: profile.hypeCount },
    { label: 'New hypes (30d)', value: recentHypes },
    { label: 'Songs listened', value: songListens },
    { label: 'Shows listened', value: showListens },
    { label: 'Upcoming events', value: upcomingCount }
  ];
}
