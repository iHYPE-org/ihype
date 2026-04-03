import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  DiscoverCreatorPanel,
  DiscoverMyPagePanel,
  DiscoverStatsPanel
} from '@/components/DiscoverModulePanels';
import { NetworkEarthGlobe } from '@/components/NetworkEarthGlobe';
import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';
import { VenueEventScheduler, type BookedAct } from '@/components/VenueEventScheduler';
import { RoleModuleSubheader } from '@/components/RoleModuleSubheader';
import { resolveDiscoverModule } from '@/lib/discover-modules';
import { getProfileDesignStyleVars } from '@/lib/profile-design';
import { detectRequestLocation } from '@/lib/request-location';
import { getDirectoryProfiles } from '@/lib/public-data';
import { buildVenueBookingRecommendations } from '@/lib/venue-booking';

export const dynamic = 'force-dynamic';

function formatShowDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(value);
}

export default async function VenuesIndexPage({
  searchParams
}: {
  searchParams?: Promise<{ module?: string | string[]; artist?: string | string[] }>;
}) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeModule = resolveDiscoverModule('venues', resolvedSearchParams.module);
  const preferredArtistId =
    typeof resolvedSearchParams.artist === 'string' ? resolvedSearchParams.artist : undefined;
  const venues = await getDirectoryProfiles('VENUE');

  const [viewerLocation, mappedVenues, venueShows, myVenueProfile] = await Promise.all([
    detectRequestLocation(),
    db.profile.findMany({
      where: {
        type: 'VENUE',
        latitude: { not: null },
        longitude: { not: null }
      },
      orderBy: [{ verified: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        addressLine1: true,
        hoursText: true,
        city: true,
        stateRegion: true,
        country: true,
        postalCode: true,
        latitude: true,
        longitude: true
      }
    }),
    db.show.findMany({
      where: {
        status: { not: 'CANCELED' },
        venueProfileId: { not: null }
      },
      include: {
        venueProfile: true,
        headlinerProfile: true,
        promoterProfile: true
      },
      orderBy: [{ startsAt: 'asc' }, { hypeCount: 'desc' }],
      take: 18
    }),
    session?.user?.id
      ? db.profile.findFirst({
          where: {
            ownerId: session.user.id,
            type: 'VENUE'
          },
          select: {
            id: true,
            slug: true,
            name: true,
            headline: true,
            bio: true,
            city: true,
            stateRegion: true,
            country: true,
            postalCode: true,
            hexId: true,
            hypeCount: true,
            verified: true,
            genres: true,
            themePreset: true,
            themeAccentTone: true,
            themeBackdropTone: true,
            themeFontPreset: true
          }
        })
      : Promise.resolve(null)
  ]);

  const [myVenueShows, myVenueRequestCount, venueRequests, promoterOptions, bookableActs] =
    myVenueProfile
      ? await Promise.all([
          db.show.findMany({
            where: {
              venueProfileId: myVenueProfile.id,
              status: { not: 'CANCELED' }
            },
            include: {
              venueProfile: true,
              headlinerProfile: true,
              promoterProfile: true
            },
            orderBy: [{ startsAt: 'asc' }, { hypeCount: 'desc' }],
            take: 16
          }),
          db.venueConnectionRequest.count({
            where: {
              venueProfileId: myVenueProfile.id
            }
          }),
          db.venueConnectionRequest.findMany({
            where: {
              venueProfileId: myVenueProfile.id,
              status: { in: ['PENDING', 'BOOKED'] }
            },
            include: {
              artistProfile: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                  type: true,
                  contactInfo: true,
                  hometown: true,
                  city: true,
                  stateRegion: true,
                  country: true,
                  verified: true
                }
              }
            },
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            take: 60
          }),
          db.profile.findMany({
            where: {
              type: 'DJ'
            },
            orderBy: [{ verified: 'desc' }, { hypeCount: 'desc' }, { name: 'asc' }],
            select: {
              id: true,
              name: true
            },
            take: 40
          }),
          db.profile.findMany({
            where: {
              type: { in: ['ARTIST', 'DJ'] }
            },
            orderBy: [{ verified: 'desc' }, { hypeCount: 'desc' }, { name: 'asc' }],
            select: {
              id: true,
              slug: true,
              name: true,
              type: true,
              contactInfo: true,
              hometown: true,
              city: true,
              stateRegion: true,
              country: true,
              verified: true
            },
            take: 60
          })
        ])
      : [[], 0, [], [], []];

  const bookableActIds = Array.from(
    new Set([
      ...venueRequests
        .map((request) => request.artistProfile?.id)
        .filter((profileId): profileId is string => Boolean(profileId)),
      ...bookableActs.map((profile) => profile.id)
    ])
  );

  const actShows = bookableActIds.length
    ? await db.show.findMany({
        where: {
          headlinerProfileId: { in: bookableActIds },
          status: { notIn: ['CANCELED', 'ENDED'] }
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          status: true,
          headlinerProfileId: true
        },
        orderBy: [{ startsAt: 'asc' }]
      })
    : [];

  const now = new Date();
  const liveOrUpcomingVenueShows = myVenueShows.filter((show) => show.status === 'LIVE' || show.startsAt >= now);
  const ticketsSold = myVenueShows.reduce((sum, show) => sum + show.ticketsSoldCount, 0);
  const recommendationData = buildVenueBookingRecommendations({
    requests: venueRequests.map((request) => ({
      status: request.status,
      artistProfile: request.artistProfile
        ? {
            id: request.artistProfile.id,
            slug: request.artistProfile.slug,
            name: request.artistProfile.name,
            type: request.artistProfile.type,
            city: request.artistProfile.city,
            stateRegion: request.artistProfile.stateRegion,
            country: request.artistProfile.country
          }
        : null
    })),
    artistShows: actShows,
    venueShows: myVenueShows.map((show) => ({
      id: show.id,
      title: show.title,
      startsAt: show.startsAt,
      status: show.status,
      headlinerProfile: show.headlinerProfile
        ? {
            name: show.headlinerProfile.name
          }
        : null
    }))
  });
  const bookableActMap = new Map(bookableActs.map((profile) => [profile.id, profile]));
  const recommendedActs: BookedAct[] = recommendationData.actOptions.map((artist) => {
    const profile = bookableActMap.get(artist.id);
    return {
      ...artist,
      contactInfo: profile?.contactInfo ?? null,
      hometown: profile?.hometown ?? null,
      verified: profile?.verified ?? false
    };
  });
  const manualActs: BookedAct[] = bookableActs.map((profile) => ({
    id: profile.id,
    name: profile.name,
    type: (profile.type === 'DJ' ? 'DJ' : 'ARTIST') as 'ARTIST' | 'DJ',
    contactInfo: profile.contactInfo,
    hometown: profile.hometown,
    city: profile.city,
    stateRegion: profile.stateRegion,
    country: profile.country,
    verified: profile.verified,
    requestCount: 0,
    availabilitySummary: 'Manual booking pool',
    suggestedSlots: [],
    rationale: 'Manual venue booking selection'
  }));
  const schedulerActs: BookedAct[] = Array.from(
    new Map(
      [
        ...recommendedActs,
        ...manualActs
      ].map((act) => [act.id, act])
    ).values()
  );
  const scheduledVenueEvents = myVenueShows.map((show) => ({
    id: show.id,
    title: show.title,
    slug: show.slug,
    startsAtLabel: formatShowDate(show.startsAt),
    status: show.status,
    headlinerName: show.headlinerProfile?.name ?? null,
    isTicketed: show.isTicketed,
    ticketingOpenedAtLabel: show.ticketingOpensAt ? `Opened ${formatShowDate(show.ticketingOpensAt)}` : null,
    ticketPriceCents: show.ticketPriceCents,
    ticketCapacity: show.ticketCapacity,
    ticketsSoldCount: show.ticketsSoldCount
  }));
  const pageStyle = myVenueProfile
    ? getProfileDesignStyleVars(myVenueProfile.themePreset, {
        accentTone: myVenueProfile.themeAccentTone,
        backdropTone: myVenueProfile.themeBackdropTone,
        fontPreset: myVenueProfile.themeFontPreset
      })
    : undefined;

  const globeRouteStops = venueShows
    .filter((show) => show.venueProfile?.latitude != null && show.venueProfile.longitude != null)
    .map((show) => ({
      id: show.id,
      title: show.title,
      href: `/shows/${show.slug}`,
      venueName: show.venueProfile?.name ?? 'Venue',
      venueSlug: show.venueProfile?.slug ?? null,
      city: show.venueProfile?.city ?? null,
      stateRegion: show.venueProfile?.stateRegion ?? null,
      country: show.venueProfile?.country ?? null,
      postalCode: show.venueProfile?.postalCode ?? null,
      latitude: show.venueProfile?.latitude ?? null,
      longitude: show.venueProfile?.longitude ?? null,
      startsAtLabel: formatShowDate(show.startsAt),
      timing:
        show.status === 'LIVE'
          ? ('live' as const)
          : show.startsAt >= now
            ? ('upcoming' as const)
            : ('past' as const)
    }));

  const discoverPanel = (
    <NetworkEarthGlobe
      description="Browse venue activity near the detected request ZIP, then zoom outward to follow event lanes across the network."
      emptyRouteLabel="No venue event routes are mapped yet."
      routeLabel="Venue route"
      routeStops={globeRouteStops}
      title="Earth globe for venue event routes"
      venues={mappedVenues}
      viewerLocation={viewerLocation}
    />
  );

  const lockedPanel = (
    <DiscoverCreatorPanel
      actionHref={session?.user ? '/register/venue' : '/login'}
      actionLabel={session?.user ? 'Create venue profile' : 'Sign in as venue'}
      badge="Venue access"
      description="Sign in with a venue account to preview your page, open stats, and build ticketed events."
      title="Venue tools"
    >
      <div className="empty">Your venue modules unlock once you are signed into a venue-owned account.</div>
    </DiscoverCreatorPanel>
  );

  const modulePanel = !myVenueProfile ? (
    lockedPanel
  ) : activeModule === 'my-page' ? (
    <DiscoverMyPagePanel
      description="Preview the public venue page artists and fans see when they open your room."
      editHref={`/dashboard?profile=${myVenueProfile.id}&edit=menu`}
      headline={myVenueProfile.headline || 'Shape the room identity, event look, and venue story that carries your page.'}
      metaLine={
        [myVenueProfile.city, myVenueProfile.stateRegion ?? myVenueProfile.country].filter(Boolean).join(', ') ||
        `My ID ${myVenueProfile.hexId}`
      }
      name={myVenueProfile.name}
      previewStyle={pageStyle}
      previewTabs={['About', 'Upcoming Shows', 'Request Artist']}
      publicHref={`/venues/${myVenueProfile.slug}`}
      roleLabel="Venue"
      summary={myVenueProfile.bio || `My ID ${myVenueProfile.hexId}`}
      tags={myVenueProfile.genres}
      title="My venue page"
    />
  ) : activeModule === 'stats' ? (
    <DiscoverStatsPanel
      badge="Stats"
      description="A quick read on the live signals tied to your venue page."
      stats={[
        { label: 'Fan hype', value: myVenueProfile.hypeCount },
        { label: 'Total events', value: myVenueShows.length },
        { label: 'Live + upcoming', value: liveOrUpcomingVenueShows.length },
        { label: 'Tickets sold', value: ticketsSold },
        { label: 'Requests received', value: myVenueRequestCount }
      ]}
      title="My venue stats"
    />
  ) : activeModule === 'events' ? (
    <DiscoverCreatorPanel
      badge="Events"
      description="Create new ticketed events, pull in requested artists, and open reserved ticket orders once the night is ready to go live."
      title="Venue event creator"
    >
      <VenueEventScheduler
        bookedActs={schedulerActs}
        preferredActId={preferredArtistId}
        promoterOptions={promoterOptions}
        recommendedActs={recommendedActs}
        scheduledEvents={scheduledVenueEvents}
        venueLocation={{
          postalCode: myVenueProfile.postalCode,
          stateRegion: myVenueProfile.stateRegion,
          country: myVenueProfile.country
        }}
        venueProfileId={myVenueProfile.id}
      />
    </DiscoverCreatorPanel>
  ) : (
    lockedPanel
  );

  return (
    <ProfileDirectoryPage
      activeModule={activeModule}
      badge="VENUES"
      currentHref="/venues"
      description="Venue discover keeps the focus on room performance, booking demand, and the nights that deserve a bigger push."
      discoverPanel={discoverPanel}
      modulePanel={modulePanel}
      moduleSubheader={<RoleModuleSubheader activeModule={activeModule} currentHref="/venues" role="venues" />}
      profiles={venues}
      title="Venue discover"
    />
  );
}
