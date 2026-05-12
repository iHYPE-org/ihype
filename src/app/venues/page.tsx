import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  DiscoverCreatorPanel,
  DiscoverExplorerPanel,
  DiscoverEventsPanel,
  DiscoverMyPagePanel,
  DiscoverTicketHubPanel,
  DiscoverToolHubPanel,
  VenueBookingRecommendationEngine
} from '@/components/DiscoverModulePanels';
import { NetworkEarthGlobe } from '@/components/NetworkEarthGlobe';
import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';
import { VenueEventScheduler, type BookedAct } from '@/components/VenueEventScheduler';
import { RoleModuleSubheader } from '@/components/RoleModuleSubheader';
import { resolveDiscoverModule } from '@/lib/discover-modules';
import { getSharedDiscoverFeed } from '@/lib/discover-feed';
import { buildHypeQueue } from '@/lib/hype-queue';
import { getProfileDesignStyleVars } from '@/lib/profile-design';
import { detectRequestLocation } from '@/lib/request-location';
import { getDirectoryProfiles } from '@/lib/public-data';
import { buildVenueBookingRecommendations } from '@/lib/venue-booking';
import { buildGlobeRouteStops, formatShowDate } from '@/lib/globe-route-stops';
import { getDemoCreatorExclusion, getDemoOwnerExclusion } from '@/lib/runtime-flags';
import { isAdminSession } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function VenuesIndexPage({
  searchParams
}: {
  searchParams?: Promise<{ module?: string | string[]; artist?: string | string[] }>;
}) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeModule = resolveDiscoverModule('venues', resolvedSearchParams.module);
  const isAdminQa = isAdminSession(session);
  const preferredArtistId =
    typeof resolvedSearchParams.artist === 'string' ? resolvedSearchParams.artist : undefined;
  const [venues, artistsForDiscover, promotersForDiscover] = await Promise.all([
    getDirectoryProfiles('VENUE'),
    getDirectoryProfiles('ARTIST'),
    getDirectoryProfiles('DJ')
  ]);
  const discoverProfiles = [...artistsForDiscover, ...promotersForDiscover, ...venues];

  const [viewerLocation, mappedVenues, venueShows, myVenueProfile] = await Promise.all([
    detectRequestLocation(),
    db.profile.findMany({
      where: {
        type: 'VENUE',
        latitude: { not: null },
        longitude: { not: null },
        ...getDemoOwnerExclusion()
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
        venueProfileId: { not: null },
        ...getDemoCreatorExclusion()
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
          where: isAdminQa
            ? {
                type: 'VENUE' as const,
                ...getDemoOwnerExclusion()
              }
            : {
                ownerId: session.user.id,
                type: 'VENUE' as const
              },
          orderBy: isAdminQa
            ? [{ verified: 'desc' as const }, { hypeCount: 'desc' as const }, { createdAt: 'asc' as const }]
            : { createdAt: 'asc' as const },
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
              type: 'DJ',
              ...getDemoOwnerExclusion()
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
              type: { in: ['ARTIST', 'DJ'] },
              ...getDemoOwnerExclusion()
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
          status: { notIn: ['CANCELED', 'ENDED'] },
          ...getDemoCreatorExclusion()
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
  const ticketedVenueShows = myVenueShows.filter((show) => show.isTicketed);
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
  const discoverFeed = await getSharedDiscoverFeed(viewerLocation);
  const viewerLocationLabel =
    [viewerLocation?.city, viewerLocation?.stateRegion ?? viewerLocation?.country].filter(Boolean).join(', ') ||
    'your area';
  const venueStats = myVenueProfile
    ? [
        { label: 'Fan hype', value: myVenueProfile.hypeCount },
        { label: 'Total events', value: myVenueShows.length },
        { label: 'Live + upcoming', value: liveOrUpcomingVenueShows.length },
        { label: 'Tickets sold', value: ticketsSold },
        { label: 'Requests received', value: myVenueRequestCount }
      ]
    : [];
  const hypeQueueItems = buildHypeQueue({
    role: 'venue',
    viewerLocationLabel,
    mediaEntries: discoverFeed.mediaEntries,
    hypedNearMe: discoverFeed.hypedNearMe,
    newArtists: discoverFeed.newArtists,
    newPromoters: discoverFeed.newPromoters,
    shows: venueShows.map((show) => ({
      title: show.title,
      headlinerSlug: show.headlinerProfile?.slug,
      headlinerName: show.headlinerProfile?.name,
      venueName: show.venueProfile?.name
    }))
  });
  const venueToolHubItems = [
    {
      badge: 'Page',
      title: 'My Page',
      summary: 'Preview and tune the public venue page artists and fans open before booking or attending.',
      detail: 'Room identity',
      href: '/venues?module=my-page'
    },
    {
      badge: 'Signal',
      title: 'Recommendation Engine',
      summary: 'Use requests, HYPE, ticket movement, and nearby artist signals to shape better bookings.',
      detail: 'Stats + booking',
      href: '/venues?module=recommendation-engine'
    },
    {
      badge: 'Tickets',
      title: 'Ticket Hub',
      summary: 'Track ticketed venue shows and verified ticket activity tied to your room.',
      detail: `${ticketedVenueShows.length} ticketed event${ticketedVenueShows.length === 1 ? '' : 's'}`,
      href: '/venues?module=ticket-hub'
    },
    {
      badge: 'Create',
      title: 'Event Creator',
      summary: 'Create events, select artists, set ticket terms, and prepare the booking package.',
      detail: `${recommendedActs.length} recommended act${recommendedActs.length === 1 ? '' : 's'}`,
      href: '/venues?module=event-creator'
    },
    {
      badge: 'Calendar',
      title: 'Events',
      summary: 'Review ticketed and non-ticketed events attached to your venue page.',
      detail: `${myVenueShows.length} venue event${myVenueShows.length === 1 ? '' : 's'}`,
      href: '/venues?module=events'
    }
  ];

  const globeRouteStops = buildGlobeRouteStops(venueShows, { includePastTiming: true, now });

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
  const recommendationDiscoveryContent = (
    <DiscoverExplorerPanel
      currentHref="/venues"
      description="Search songs, artists, promoters, venues, and room momentum from the same place the venue recommendations are built."
      embedded
      globePanel={discoverPanel}
      hypedNearMe={discoverFeed.hypedNearMe}
      mediaEntries={discoverFeed.mediaEntries}
      newArtists={discoverFeed.newArtists}
      newPromoters={discoverFeed.newPromoters}
      profiles={discoverProfiles}
      title="Recommendation signal map"
      viewerLocationLabel={viewerLocationLabel}
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
  ) : activeModule === 'tool-hub' ? (
    <DiscoverToolHubPanel
      badge="Tool Hub"
      description="One venue landing page for page control, recommendations, ticketing, event creation, and event history."
      stats={venueStats}
      title="All venue tools"
      tools={venueToolHubItems}
    />
  ) : activeModule === 'my-page' ? (
    <DiscoverMyPagePanel
      description="Preview the public venue page artists and fans see when they open your room."
      editHref={`/home?profile=${myVenueProfile.id}&edit=menu`}
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
  ) : activeModule === 'recommendation-engine' ? (
    <VenueBookingRecommendationEngine
      currentHref="/venues"
      hypeQueueItems={hypeQueueItems}
      scopes={recommendationData.scopeGroups}
      stats={venueStats}
    >
      {recommendationDiscoveryContent}
    </VenueBookingRecommendationEngine>
  ) : activeModule === 'ticket-hub' ? (
    <DiscoverTicketHubPanel shows={ticketedVenueShows} />
  ) : activeModule === 'event-creator' ? (
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
  ) : activeModule === 'events' ? (
    <DiscoverEventsPanel
      badge="Events"
      description="Review the ticketed and non-ticketed events attached to your venue page."
      emptyLabel="No venue events are attached to your page yet."
      shows={myVenueShows}
      title="My venue events"
    />
  ) : (
    lockedPanel
  );

  return (
    <ProfileDirectoryPage
      activeModule={activeModule}
      badge="VENUES"
      currentHref="/venues"
      description="Venue engines keep room performance, booking demand, recommendations, and event creation in one streamlined lane."
      modulePanel={modulePanel}
      moduleSubheader={<RoleModuleSubheader activeModule={activeModule} currentHref="/venues" role="venues" />}
      profiles={discoverProfiles}
      title="Venue lane"
    />
  );
}
