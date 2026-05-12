import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  DiscoverCreatorPanel,
  DiscoverExplorerPanel,
  DiscoverEventsPanel,
  DiscoverMyPagePanel,
  DiscoverRecommendationPanel,
  DiscoverTicketHubPanel,
  DiscoverToolHubPanel
} from '@/components/DiscoverModulePanels';
import { NetworkEarthGlobe } from '@/components/NetworkEarthGlobe';
import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';
import { RoleModuleSubheader } from '@/components/RoleModuleSubheader';
import { resolveDiscoverModule } from '@/lib/discover-modules';
import { getSharedDiscoverFeed } from '@/lib/discover-feed';
import { buildHypeQueue } from '@/lib/hype-queue';
import { getProfileDesignStyleVars } from '@/lib/profile-design';
import { detectRequestLocation } from '@/lib/request-location';
import { getDirectoryProfiles } from '@/lib/public-data';
import { buildGlobeRouteStops } from '@/lib/globe-route-stops';
import { isAdminSession } from '@/lib/permissions';
import {
  getDemoCreatorExclusion,
  getDemoOwnerExclusion,
  getDemoProfileRelationExclusion,
  getDemoShowRelationExclusion
} from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

export default async function ListenersIndexPage({
  searchParams
}: {
  searchParams?: Promise<{ module?: string | string[] }>;
}) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeModule = resolveDiscoverModule('fans', resolvedSearchParams.module);
  const isAdminQa = isAdminSession(session);
  const [artists, promoters, venuesForBrowse] = await Promise.all([
    getDirectoryProfiles('ARTIST'),
    getDirectoryProfiles('DJ'),
    getDirectoryProfiles('VENUE')
  ]);
  const discoverProfiles = [...artists, ...promoters, ...venuesForBrowse];

  const [viewerLocation, venues, activeShows, myFanProfile] = await Promise.all([
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
        status: { in: ['SCHEDULED', 'LIVE'] },
        ...getDemoCreatorExclusion()
      },
      include: {
        venueProfile: true,
        headlinerProfile: true,
        promoterProfile: true
      },
      orderBy: [{ startsAt: 'asc' }, { hypeCount: 'desc' }],
      take: 24
    }),
    session?.user?.id
      ? db.profile.findFirst({
          where: isAdminQa
            ? {
                type: 'LISTENER' as const,
                ...getDemoOwnerExclusion()
              }
            : {
                ownerId: session.user.id,
                type: 'LISTENER' as const
              },
          orderBy: isAdminQa
            ? [{ verified: 'desc' as const }, { hypeCount: 'desc' as const }, { createdAt: 'asc' as const }]
            : { createdAt: 'asc' as const },
          select: {
            id: true,
            ownerId: true,
            slug: true,
            name: true,
            headline: true,
            bio: true,
            city: true,
            country: true,
            hexId: true,
            hypeCount: true,
            genres: true,
            themePreset: true,
            themeAccentTone: true,
            themeBackdropTone: true,
            themeFontPreset: true
          }
        })
      : Promise.resolve(null),
  ]);

  const fanSubjectUserId = isAdminQa ? myFanProfile?.ownerId : session?.user?.id;
  const [profileHypes, myShowHypes, fullSongListenCount, fullShowListenCount] = await Promise.all([
    fanSubjectUserId
      ? db.profileHypeEvent.findMany({
          where: {
            userId: fanSubjectUserId,
            ...getDemoProfileRelationExclusion()
          },
          include: {
            profile: {
              select: {
                id: true,
                type: true
              }
            }
          }
        })
      : Promise.resolve([]),
    fanSubjectUserId
      ? db.hypeEvent.findMany({
          where: {
            userId: fanSubjectUserId,
            ...getDemoShowRelationExclusion()
          },
          include: {
            show: {
              include: {
                venueProfile: true,
                headlinerProfile: true,
                promoterProfile: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        })
      : Promise.resolve([]),
    fanSubjectUserId
      ? db.mediaListen.count({
          where: {
            userId: fanSubjectUserId,
            completedAt: { not: null }
          }
        })
      : Promise.resolve(0),
    fanSubjectUserId
      ? db.showListen.count({
          where: {
            userId: fanSubjectUserId
          }
        })
      : Promise.resolve(0)
  ]);

  const now = new Date();
  const globeRouteStops = buildGlobeRouteStops(activeShows);

  const myShows = myShowHypes.map((entry) => entry.show);
  const myUpcomingShows = myShows.filter((show) => show.status === 'LIVE' || show.startsAt >= now);
  const myPastShows = myShows.filter((show) => show.status === 'ENDED' || (show.startsAt < now && show.status !== 'LIVE'));
  const myEvents = [...myUpcomingShows, ...myPastShows];
  const hypePoints = myShows.length + profileHypes.length;
  const pageStyle = myFanProfile
    ? getProfileDesignStyleVars(myFanProfile.themePreset, {
        accentTone: myFanProfile.themeAccentTone,
        backdropTone: myFanProfile.themeBackdropTone,
        fontPreset: myFanProfile.themeFontPreset
      })
    : undefined;
  const discoverFeed = await getSharedDiscoverFeed(viewerLocation);
  const viewerLocationLabel =
    [viewerLocation?.city, viewerLocation?.stateRegion ?? viewerLocation?.country].filter(Boolean).join(', ') ||
    'your area';
  const ticketedFanShows = activeShows.filter((show) => show.isTicketed);
  const fanStats = [
    { label: 'Hype points', value: hypePoints },
    { label: 'Full songs listened', value: fullSongListenCount },
    { label: 'Full shows listened', value: fullShowListenCount },
    { label: 'Events attended', value: myPastShows.length },
    { label: 'Upcoming events', value: myUpcomingShows.length }
  ];
  const hypeQueueItems = buildHypeQueue({
    role: 'fan',
    viewerLocationLabel,
    mediaEntries: discoverFeed.mediaEntries,
    hypedNearMe: discoverFeed.hypedNearMe,
    newArtists: discoverFeed.newArtists,
    newPromoters: discoverFeed.newPromoters,
    shows: activeShows.map((show) => ({
      title: show.title,
      headlinerSlug: show.headlinerProfile?.slug,
      headlinerName: show.headlinerProfile?.name,
      venueName: show.venueProfile?.name
    }))
  });
  const fanRecommendationOpportunities = [
    {
      title: 'Local and regional trending artists',
      summary: discoverFeed.hypedNearMe.length
        ? `${discoverFeed.hypedNearMe[0].name} is leading nearby HYPE signals around ${viewerLocationLabel}.`
        : `No local artist trend has separated around ${viewerLocationLabel} yet.`,
      detail: `${discoverFeed.hypedNearMe.length} nearby artist signal${discoverFeed.hypedNearMe.length === 1 ? '' : 's'}`
    },
    {
      title: 'New artists and promoters',
      summary: `${discoverFeed.newArtists.length} new artist profile${discoverFeed.newArtists.length === 1 ? '' : 's'} and ${discoverFeed.newPromoters.length} promoter profile${discoverFeed.newPromoters.length === 1 ? '' : 's'} are ready to browse.`,
      detail: 'Fresh local and regional discovery'
    },
    {
      title: 'Venues nearby',
      summary: venues.length
        ? `${venues.slice(0, 3).map((venue) => venue.name).join(', ')} are mapped in the venue globe lane.`
        : 'No mapped venue points are available yet.',
      detail: `${venues.length} venue map point${venues.length === 1 ? '' : 's'}`
    },
    {
      title: 'Ticket opportunities',
      summary: ticketedFanShows.length
        ? `${ticketedFanShows.length} ticketed show${ticketedFanShows.length === 1 ? '' : 's'} are open or upcoming.`
        : 'No ticketed shows are open in this lane yet.',
      detail: 'Ticket Hub signal'
    }
  ];
  const fanToolHubItems = [
    {
      badge: 'Page',
      title: 'My Page',
      summary: 'Preview and edit the fan identity other people see across iHYPE.',
      detail: 'Profile + presets',
      href: '/fans?module=my-page'
    },
    {
      badge: 'Signal',
      title: 'Recommendation Engine',
      summary: 'See local artists, promoters, venues, tickets, and HYPE queues shaped by your activity.',
      detail: 'Stats + discovery',
      href: '/fans?module=recommendation-engine'
    },
    {
      badge: 'Tickets',
      title: 'Ticket Hub',
      summary: 'Track verified ticketed shows that are open now or moving into your lane.',
      detail: `${ticketedFanShows.length} open signal${ticketedFanShows.length === 1 ? '' : 's'}`,
      href: '/fans?module=ticket-hub'
    },
    {
      badge: 'History',
      title: 'Events',
      summary: 'Review the shows you have backed, attended, or saved for later.',
      detail: `${myEvents.length} fan event${myEvents.length === 1 ? '' : 's'}`,
      href: '/fans?module=events'
    }
  ];

  const discoverPanel = (
    <NetworkEarthGlobe
      description="Start at the detected ZIP for this request, highlight nearby venues, then zoom out to browse active shows farther from home."
      emptyRouteLabel="No live or upcoming show routes are mapped yet."
      routeLabel="Event route"
      routeStops={globeRouteStops}
      title="Earth globe for nearby venues and active show routes"
      venues={venues}
      viewerLocation={viewerLocation}
    />
  );
  const recommendationDiscoveryContent = (
    <DiscoverExplorerPanel
      currentHref="/fans"
      description="Search songs, artists, promoters, venues, and local momentum from the same place the fan recommendations are built."
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
      actionHref={session?.user ? '/register/fan' : '/login'}
      actionLabel={session?.user ? 'Create fan profile' : 'Sign in as fan'}
      badge="Fan access"
      description="Sign in with a fan account to open your page preview, stats, and event history."
      title="Fan tools"
    >
      <div className="empty">Your fan modules unlock once you are signed into a fan-owned account.</div>
    </DiscoverCreatorPanel>
  );

  const modulePanel = !myFanProfile ? (
    lockedPanel
  ) : activeModule === 'tool-hub' ? (
    <DiscoverToolHubPanel
      badge="Tool Hub"
      description="One fan landing page for profile control, recommendations, ticketing, and event history."
      stats={fanStats}
      title="All fan tools"
      tools={fanToolHubItems}
    />
  ) : activeModule === 'my-page' ? (
    <DiscoverMyPagePanel
      description="Preview the public fan page other people see when they open your profile."
      editHref={`/home?profile=${myFanProfile.id}&edit=menu`}
      headline={myFanProfile.headline || 'Capture the artists, venues, and moments you keep coming back to.'}
      metaLine={[myFanProfile.city, myFanProfile.country].filter(Boolean).join(', ') || `My ID ${myFanProfile.hexId}`}
      name={myFanProfile.name}
      previewStyle={pageStyle}
      previewTabs={['About', 'Recommend', 'Upcoming', 'Top 5', 'Stats']}
      publicHref={`/fans/${myFanProfile.slug}`}
      roleLabel="Fan"
      summary={myFanProfile.bio || `My ID ${myFanProfile.hexId}`}
      tags={myFanProfile.genres}
      title="My fan page"
    />
  ) : activeModule === 'recommendation-engine' ? (
    <DiscoverRecommendationPanel
      badge="Recommendation Engine"
      description="Fan recommendations combine your stats, nearby HYPE, new artists, venue proximity, promoter activity, and ticket openings."
      hypeQueueItems={hypeQueueItems}
      opportunities={fanRecommendationOpportunities}
      stats={fanStats}
      title="Recommended next moves"
    >
      {recommendationDiscoveryContent}
    </DiscoverRecommendationPanel>
  ) : activeModule === 'ticket-hub' ? (
    <DiscoverTicketHubPanel shows={ticketedFanShows} />
  ) : activeModule === 'events' ? (
    <DiscoverEventsPanel
      badge="Events"
      description="Review the shows you have already backed and the ones still ahead."
      emptyLabel="No saved events are on your fan page yet."
      shows={myEvents}
      title="My fan events"
    />
  ) : (
    lockedPanel
  );

  return (
    <ProfileDirectoryPage
      activeModule={activeModule}
      badge="FANS"
      currentHref="/fans"
      description="Fan engines keep nearby rooms, next events, and recommendation signals in one streamlined lane."
      modulePanel={modulePanel}
      moduleSubheader={<RoleModuleSubheader activeModule={activeModule} currentHref="/fans" role="fans" />}
      profiles={discoverProfiles}
      title="Fan lane"
    />
  );
}
