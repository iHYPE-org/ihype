import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildArtistMediaCollection } from '@/lib/media';
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
import { PromoterShowCreationTool } from '@/components/PromoterShowCreationTool';
import { RoleModuleSubheader } from '@/components/RoleModuleSubheader';
import { resolveDiscoverModule } from '@/lib/discover-modules';
import { getSharedDiscoverFeed } from '@/lib/discover-feed';
import { buildHypeQueue } from '@/lib/hype-queue';
import { getProfileDesignStyleVars } from '@/lib/profile-design';
import { detectRequestLocation } from '@/lib/request-location';
import { getDirectoryProfiles } from '@/lib/public-data';
import { buildGlobeRouteStops } from '@/lib/globe-route-stops';
import { getDemoCreatorExclusion, getDemoOwnerExclusion } from '@/lib/runtime-flags';
import { isAdminSession } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function PromotersIndexPage({
  searchParams
}: {
  searchParams?: Promise<{ module?: string | string[] }>;
}) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeModule = resolveDiscoverModule('promoters', resolvedSearchParams.module);
  const isAdminQa = isAdminSession(session);
  const [promoters, artistsForDiscover, venuesForDiscover] = await Promise.all([
    getDirectoryProfiles('DJ'),
    getDirectoryProfiles('ARTIST'),
    getDirectoryProfiles('VENUE')
  ]);
  const discoverProfiles = [...artistsForDiscover, ...promoters, ...venuesForDiscover];

  const [viewerLocation, venues, promoterShows, myPromoterProfile] = await Promise.all([
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
        promoterProfileId: { not: null },
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
                type: 'DJ' as const,
                ...getDemoOwnerExclusion()
              }
            : {
                ownerId: session.user.id,
                type: 'DJ' as const
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

  const myPromoterShows = myPromoterProfile
    ? await db.show.findMany({
        where: {
          promoterProfileId: myPromoterProfile.id,
          status: { not: 'CANCELED' }
        },
        include: {
          venueProfile: true,
          headlinerProfile: true,
          promoterProfile: true
        },
        orderBy: [{ startsAt: 'asc' }, { hypeCount: 'desc' }],
        take: 16
      })
    : [];

  const now = new Date();
  const liveOrUpcomingPromoterShows = myPromoterShows.filter(
    (show) => show.status === 'LIVE' || show.startsAt >= now
  );
  const ticketsSold = myPromoterShows.reduce((sum, show) => sum + show.ticketsSoldCount, 0);
  const ticketedPromoterShows = myPromoterShows.filter((show) => show.isTicketed);
  const venueCount = new Set(
    myPromoterShows
      .map((show) => show.venueProfileId)
      .filter((venueProfileId): venueProfileId is string => Boolean(venueProfileId))
  ).size;
  const pageStyle = myPromoterProfile
    ? getProfileDesignStyleVars(myPromoterProfile.themePreset, {
        accentTone: myPromoterProfile.themeAccentTone,
        backdropTone: myPromoterProfile.themeBackdropTone,
        fontPreset: myPromoterProfile.themeFontPreset
      })
    : undefined;
  const discoverFeed = await getSharedDiscoverFeed(viewerLocation);
  const viewerLocationLabel =
    [viewerLocation?.city, viewerLocation?.stateRegion ?? viewerLocation?.country].filter(Boolean).join(', ') ||
    'your area';
  const promoterStats = myPromoterProfile
    ? [
        { label: 'Fan hype', value: myPromoterProfile.hypeCount },
        { label: 'Total shows', value: myPromoterShows.length },
        { label: 'Live + upcoming', value: liveOrUpcomingPromoterShows.length },
        { label: 'Tickets sold', value: ticketsSold },
        { label: 'Venues worked', value: venueCount }
      ]
    : [];
  const hypeQueueItems = buildHypeQueue({
    role: 'promoter',
    viewerLocationLabel,
    mediaEntries: discoverFeed.mediaEntries,
    hypedNearMe: discoverFeed.hypedNearMe,
    newArtists: discoverFeed.newArtists,
    newPromoters: discoverFeed.newPromoters,
    shows: promoterShows.map((show) => ({
      title: show.title,
      headlinerSlug: show.headlinerProfile?.slug,
      headlinerName: show.headlinerProfile?.name,
      venueName: show.venueProfile?.name
    }))
  });
  const promoterRecommendationOpportunities = [
    {
      title: 'Artists to program',
      summary: discoverFeed.hypedNearMe.length
        ? `${discoverFeed.hypedNearMe[0].name} is leading nearby artist momentum around ${viewerLocationLabel}.`
        : 'Nearby artist momentum is still building.',
      detail: `${artistsForDiscover.length} artist profile${artistsForDiscover.length === 1 ? '' : 's'} available`
    },
    {
      title: 'Venue routing',
      summary: venueCount
        ? `Your shows already touch ${venueCount} venue${venueCount === 1 ? '' : 's'}. Use the globe lane to find the next room.`
        : `${venues.length} mapped venue point${venues.length === 1 ? '' : 's'} can help shape the next show.`,
      detail: 'Globe search signal'
    },
    {
      title: 'Ticket referrals',
      summary: ticketedPromoterShows.length
        ? `${ticketedPromoterShows.length} ticketed promoter show${ticketedPromoterShows.length === 1 ? '' : 's'} can support tracked referrals.`
        : 'No ticketed promoter shows are open yet.',
      detail: `${ticketsSold} total ticket${ticketsSold === 1 ? '' : 's'} sold`
    },
    {
      title: 'Show builder focus',
      summary: 'Use artist page media, session sound effects, and microphone overdubs to publish prerecorded radio-style shows.',
      detail: 'Show Creator engine'
    }
  ];
  const promoterToolHubItems = [
    {
      badge: 'Page',
      title: 'My Page',
      summary: 'Preview and tune the public promoter page artists, fans, and venues see.',
      detail: 'Profile + identity',
      href: '/promoters?module=my-page'
    },
    {
      badge: 'Signal',
      title: 'Recommendation Engine',
      summary: 'Use artist momentum, venue routing, ticket signals, and HYPE to plan smarter shows.',
      detail: 'Stats + demand',
      href: '/promoters?module=recommendation-engine'
    },
    {
      badge: 'Tickets',
      title: 'Ticket Hub',
      summary: 'Track ticketed promoter shows and the referral-ready events tied to your page.',
      detail: `${ticketedPromoterShows.length} ticketed show${ticketedPromoterShows.length === 1 ? '' : 's'}`,
      href: '/promoters?module=ticket-hub'
    },
    {
      badge: 'Calendar',
      title: 'Events',
      summary: 'Review the nights already attached to your promoter page.',
      detail: `${myPromoterShows.length} promoter event${myPromoterShows.length === 1 ? '' : 's'}`,
      href: '/promoters?module=events'
    }
  ];

  const globeRouteStops = buildGlobeRouteStops(promoterShows, { includePastTiming: true, now });

  const discoverPanel = (
    <NetworkEarthGlobe
      description="Browse promoter-led nights near the detected request ZIP, then zoom back out to follow bigger event lanes."
      emptyRouteLabel="No promoter-led routes are mapped yet."
      routeLabel="Promoted history"
      routeStops={globeRouteStops}
      title="Earth globe for promoter routes"
      venues={venues}
      viewerLocation={viewerLocation}
    />
  );
  const recommendationDiscoveryContent = (
    <DiscoverExplorerPanel
      currentHref="/promoters"
      description="Search songs, artists, promoters, venues, and show momentum from the same place the promoter recommendations are built."
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
      actionHref={session?.user ? '/register/promoter' : '/login'}
      actionLabel={session?.user ? 'Create promoter profile' : 'Sign in as promoter'}
      badge="Promoter access"
      description="Sign in with a promoter account to preview your page, open stats, and build shows."
      title="Promoter tools"
    >
      <div className="empty">Your promoter modules unlock once you are signed into a promoter-owned account.</div>
    </DiscoverCreatorPanel>
  );

  let modulePanel = lockedPanel;

  if (myPromoterProfile) {
    if (activeModule === 'tool-hub') {
      modulePanel = (
        <DiscoverToolHubPanel
          badge="Tool Hub"
          description="One promoter landing page for page control, recommendations, ticketing, and event history. Show Creator stays separate for focused production."
          stats={promoterStats}
          title="All promoter tools"
          tools={promoterToolHubItems}
        />
      );
    } else if (activeModule === 'my-page') {
      modulePanel = (
        <DiscoverMyPagePanel
          description="Preview the public promoter page artists, fans, and venues see when they open your profile."
          editHref={`/home?profile=${myPromoterProfile.id}&edit=menu`}
          headline={myPromoterProfile.headline || 'Shape the public identity, event look, and show language for your promoter page.'}
          metaLine={
            [myPromoterProfile.city, myPromoterProfile.stateRegion ?? myPromoterProfile.country]
              .filter(Boolean)
              .join(', ') || `My ID ${myPromoterProfile.hexId}`
          }
          name={myPromoterProfile.name}
          previewStyle={pageStyle}
          previewTabs={['About', 'Shows', 'Events']}
          publicHref={`/promoters/${myPromoterProfile.slug}`}
          roleLabel="Promoter"
          summary={myPromoterProfile.bio || `My ID ${myPromoterProfile.hexId}`}
          tags={myPromoterProfile.genres}
          title="My promoter page"
        />
      );
    } else if (activeModule === 'recommendation-engine') {
      modulePanel = (
        <DiscoverRecommendationPanel
          badge="Recommendation Engine"
          description="Promoter recommendations combine your stats, artist momentum, venue routing, ticket opportunity, and show-building focus."
          hypeQueueItems={hypeQueueItems}
          opportunities={promoterRecommendationOpportunities}
          stats={promoterStats}
          title="Promoter recommendations"
        >
          {recommendationDiscoveryContent}
        </DiscoverRecommendationPanel>
      );
    } else if (activeModule === 'ticket-hub') {
      modulePanel = <DiscoverTicketHubPanel shows={ticketedPromoterShows} />;
    } else if (activeModule === 'events') {
      modulePanel = (
        <DiscoverEventsPanel
          badge="Events"
          description="Review the nights already attached to your promoter page."
          emptyLabel="No promoter events are attached to your page yet."
          shows={myPromoterShows}
          title="My promoter events"
        />
      );
    } else if (activeModule === 'show-creator') {
      const artistProfiles = await db.profile.findMany({
        where: {
          type: 'ARTIST',
          ...getDemoOwnerExclusion(),
          OR: [{ mediaContent: { not: null } }, { mediaUploads: { some: {} } }, { featureVideoUrl: { not: null } }]
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
      });

      const artists = artistProfiles
        .map((artistProfile) => {
          const builtEntries = buildArtistMediaCollection(artistProfile.mediaContent, artistProfile.mediaUploads).entries;
          const featureVideoEntry = artistProfile.featureVideoUrl
            ? [
                {
                  id: `${artistProfile.hexId.slice(0, -2)}fe`,
                  hexId: `${artistProfile.hexId.slice(0, -2)}fe`,
                  title: `${artistProfile.name} feature video`,
                  url: artistProfile.featureVideoUrl,
                  notes: 'Feature video from the artist page builder.',
                  mimeType: 'video/mp4',
                  mediaType: 'video' as const,
                  previewImageUrl: artistProfile.galleryImage ?? artistProfile.heroImage ?? null
                }
              ]
            : [];

          return {
            profileId: artistProfile.id,
            slug: artistProfile.slug,
            name: artistProfile.name,
            heroImage: artistProfile.heroImage,
            entries: [...featureVideoEntry, ...builtEntries]
          };
        })
        .filter((artistProfile) => artistProfile.entries.length > 0);

      modulePanel = (
        <DiscoverCreatorPanel
          badge="Show Creator"
          description="Build the next promoter-led show without leaving your promoter lane."
          title="Promoter show creator"
        >
          <PromoterShowCreationTool
            artists={artists}
            initialPromoterProfileId={myPromoterProfile.id}
            promoters={[{ profileId: myPromoterProfile.id, name: myPromoterProfile.name, slug: myPromoterProfile.slug }]}
            venues={venues.map((venue) => ({
              profileId: venue.id,
              slug: venue.slug,
              name: venue.name,
              addressLine1: venue.addressLine1,
              city: venue.city,
              stateRegion: venue.stateRegion,
              country: venue.country,
              postalCode: venue.postalCode
            }))}
          />
        </DiscoverCreatorPanel>
      );
    }
  }

  return (
    <ProfileDirectoryPage
      activeModule={activeModule}
      badge="PROMOTERS"
      currentHref="/promoters"
      description="Promoter engines keep show momentum, room pressure, recommendations, and show-building tools in one streamlined lane."
      modulePanel={modulePanel}
      moduleSubheader={<RoleModuleSubheader activeModule={activeModule} currentHref="/promoters" role="promoters" />}
      profiles={discoverProfiles}
      title="Promoter lane"
    />
  );
}
