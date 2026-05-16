import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Artists',
  description: 'Discover independent artists on iHYPE. Browse by city, genre, and hype count — no algorithms, no pay-to-play.',
  openGraph: { title: 'Artists · iHYPE', description: 'Discover independent artists — no algorithms, no pay-to-play.' },
  twitter: { card: 'summary_large_image', title: 'Artists · iHYPE', description: 'Discover independent artists — no algorithms, no pay-to-play.' },
};
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
import { getDemoCreatorExclusion, getDemoOwnerExclusion } from '@/lib/runtime-flags';
import { isAdminSession } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const DIRECTORY_PAGE_SIZE = 20;

export default async function ArtistsIndexPage({
  searchParams
}: {
  searchParams?: Promise<{ module?: string | string[]; cursor?: string | string[] }>;
}) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeModule = resolveDiscoverModule('artists', resolvedSearchParams.module);
  const isAdminQa = isAdminSession(session);
  const [allArtists, promotersForDiscover, venuesForDiscover] = await Promise.all([
    getDirectoryProfiles('ARTIST'),
    getDirectoryProfiles('DJ'),
    getDirectoryProfiles('VENUE')
  ]);

  // Cursor-based pagination: include every artist up to and including the cursor id, then page size more.
  const cursorRaw = Array.isArray(resolvedSearchParams.cursor) ? resolvedSearchParams.cursor[0] : resolvedSearchParams.cursor;
  const cursorIndex = cursorRaw ? allArtists.findIndex((profile) => profile.id === cursorRaw) : -1;
  const visibleEnd = cursorIndex >= 0
    ? Math.min(allArtists.length, cursorIndex + 1 + DIRECTORY_PAGE_SIZE)
    : Math.min(allArtists.length, DIRECTORY_PAGE_SIZE);
  const artists = allArtists.slice(0, visibleEnd);
  const hasMoreArtists = visibleEnd < allArtists.length;
  const nextArtistCursor = hasMoreArtists ? allArtists[visibleEnd - 1]?.id : null;
  const discoverProfiles = [...artists, ...promotersForDiscover, ...venuesForDiscover];

  const [viewerLocation, venues, artistShows, myArtistProfile] = await Promise.all([
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
        ...getDemoCreatorExclusion(),
        headlinerProfile: {
          is: { type: 'ARTIST' }
        }
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
                type: 'ARTIST' as const,
                ...getDemoOwnerExclusion()
              }
            : {
                ownerId: session.user.id,
                type: 'ARTIST' as const
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

  const myArtistShows = myArtistProfile
    ? await db.show.findMany({
        where: {
          headlinerProfileId: myArtistProfile.id,
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
  const liveOrUpcomingArtistShows = myArtistShows.filter((show) => show.status === 'LIVE' || show.startsAt >= now);
  const pageStyle = myArtistProfile
    ? getProfileDesignStyleVars(myArtistProfile.themePreset, {
        accentTone: myArtistProfile.themeAccentTone,
        backdropTone: myArtistProfile.themeBackdropTone,
        fontPreset: myArtistProfile.themeFontPreset
      })
    : undefined;
  const discoverFeed = await getSharedDiscoverFeed(viewerLocation);
  const viewerLocationLabel =
    [viewerLocation?.city, viewerLocation?.stateRegion ?? viewerLocation?.country].filter(Boolean).join(', ') ||
    'your area';
  const ticketedArtistShows = myArtistShows.filter((show) => show.isTicketed);
  const artistStats = myArtistProfile
    ? [
        { label: 'Fan hype', value: myArtistProfile.hypeCount },
        { label: 'Total events', value: myArtistShows.length },
        { label: 'Live + upcoming', value: liveOrUpcomingArtistShows.length },
        { label: 'Verified', value: myArtistProfile.verified ? 'Yes' : 'No' },
        { label: 'Artists in network', value: artists.length }
      ]
    : [];
  const hypeQueueItems = buildHypeQueue({
    role: 'artist',
    viewerLocationLabel,
    mediaEntries: discoverFeed.mediaEntries,
    hypedNearMe: discoverFeed.hypedNearMe,
    newArtists: discoverFeed.newArtists,
    newPromoters: discoverFeed.newPromoters,
    shows: artistShows.map((show) => ({
      title: show.title,
      headlinerSlug: show.headlinerProfile?.slug,
      headlinerName: show.headlinerProfile?.name,
      venueName: show.venueProfile?.name
    }))
  });
  const artistRecommendationOpportunities = [
    {
      title: 'Tour markets to watch',
      summary: liveOrUpcomingArtistShows.length
        ? `${liveOrUpcomingArtistShows.length} live or upcoming artist date${liveOrUpcomingArtistShows.length === 1 ? '' : 's'} can guide the next route.`
        : `Start with the globe signal around ${viewerLocationLabel} and compare venue density before adding dates.`,
      detail: 'Tour Creator signal'
    },
    {
      title: 'Venue booking lane',
      summary: venues.length
        ? `${venues.slice(0, 3).map((venue) => venue.name).join(', ')} are mapped as bookable room signals.`
        : 'No mapped venue points are available yet.',
      detail: `${venues.length} venue map point${venues.length === 1 ? '' : 's'}`
    },
    {
      title: 'Promoter discovery',
      summary: promotersForDiscover.length
        ? `${promotersForDiscover.slice(0, 3).map((profile) => profile.name).join(', ')} are available in the promoter lane.`
        : 'No promoter profiles are available yet.',
      detail: `${promotersForDiscover.length} promoter profile${promotersForDiscover.length === 1 ? '' : 's'}`
    },
    {
      title: 'Nearby artist momentum',
      summary: discoverFeed.hypedNearMe.length
        ? `${discoverFeed.hypedNearMe[0].name} is the current nearby HYPE reference point.`
        : 'Nearby HYPE is still building.',
      detail: `${discoverFeed.hypedNearMe.length} nearby HYPE signal${discoverFeed.hypedNearMe.length === 1 ? '' : 's'}`
    }
  ];
  const artistToolHubItems = [
    {
      badge: 'Page',
      title: 'My Page',
      summary: 'Preview and tune the public artist page fans, venues, and promoters open first.',
      detail: 'Profile + media look',
      href: '/artists?module=my-page'
    },
    {
      badge: 'Signal',
      title: 'Recommendation Engine',
      summary: 'Use HYPE, venue density, promoter activity, and route signals to decide the next move.',
      detail: 'Stats + growth',
      href: '/artists?module=recommendation-engine'
    },
    {
      badge: 'Tickets',
      title: 'Ticket Hub',
      summary: 'Follow ticketed artist dates tied to your page and current event lane.',
      detail: `${ticketedArtistShows.length} ticketed date${ticketedArtistShows.length === 1 ? '' : 's'}`,
      href: '/artists?module=ticket-hub'
    },
    {
      badge: 'Route',
      title: 'Tour Creator',
      summary: 'Shape your artist dates into a clearer route plan for booking and promotion.',
      detail: `${myArtistShows.length} total date${myArtistShows.length === 1 ? '' : 's'}`,
      href: '/artists?module=tour-creator'
    },
    {
      badge: 'Calendar',
      title: 'Events',
      summary: 'Review every date already attached to your artist page.',
      detail: `${liveOrUpcomingArtistShows.length} upcoming`,
      href: '/artists?module=events'
    }
  ];

  const globeRouteStops = buildGlobeRouteStops(artistShows);

  const discoverPanel = (
    <NetworkEarthGlobe
      description="Browse artist-led dates on the map, starting near the detected request ZIP and then zooming back out into larger tour lanes."
      emptyRouteLabel="No artist tour routes are mapped yet."
      routeLabel="Tour path"
      routeStops={globeRouteStops}
      title="Earth globe for artist tour routes"
      venues={venues}
      viewerLocation={viewerLocation}
    />
  );
  const recommendationDiscoveryContent = (
    <DiscoverExplorerPanel
      currentHref="/artists"
      description="Search songs, artists, promoters, venues, and route momentum from the same place the artist recommendations are built."
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
      actionHref={session?.user ? '/register/artist' : '/login'}
      actionLabel={session?.user ? 'Create artist profile' : 'Sign in as artist'}
      badge="Artist access"
      description="Sign in with an artist account to preview your page, open stats, and manage your event lane."
      title="Artist tools"
    >
      <div className="empty">Your artist modules unlock once you are signed into an artist-owned account.</div>
    </DiscoverCreatorPanel>
  );

  const modulePanel = !myArtistProfile ? (
    lockedPanel
  ) : activeModule === 'tool-hub' ? (
    <DiscoverToolHubPanel
      badge="Tool Hub"
      description="One artist landing page for page setup, growth recommendations, ticketing, tour planning, and events."
      stats={artistStats}
      title="All artist tools"
      tools={artistToolHubItems}
    />
  ) : activeModule === 'my-page' ? (
    <DiscoverMyPagePanel
      description="Preview the public artist page listeners and bookers see when they open your profile."
      editHref={`/home?profile=${myArtistProfile.id}&edit=menu`}
      headline={myArtistProfile.headline || 'Shape the live look, media, and event presence for your artist page.'}
      metaLine={
        [myArtistProfile.city, myArtistProfile.stateRegion ?? myArtistProfile.country].filter(Boolean).join(', ') ||
        `My ID ${myArtistProfile.hexId}`
      }
      name={myArtistProfile.name}
      previewStyle={pageStyle}
      previewTabs={['About', 'Media', 'Tour', 'Merch']}
      publicHref={`/artists/${myArtistProfile.slug}`}
      roleLabel="Artist"
      summary={myArtistProfile.bio || `My ID ${myArtistProfile.hexId}`}
      tags={myArtistProfile.genres}
      title="My artist page"
    />
  ) : activeModule === 'recommendation-engine' ? (
    <DiscoverRecommendationPanel
      badge="Recommendation Engine"
      description="Artist recommendations combine your stats, tour routing, venue density, promoter discovery, and nearby HYPE."
      hypeQueueItems={hypeQueueItems}
      opportunities={artistRecommendationOpportunities}
      stats={artistStats}
      title="Artist growth recommendations"
    >
      {recommendationDiscoveryContent}
    </DiscoverRecommendationPanel>
  ) : activeModule === 'ticket-hub' ? (
    <DiscoverTicketHubPanel shows={ticketedArtistShows} />
  ) : activeModule === 'tour-creator' ? (
    <DiscoverEventsPanel
      badge="Tour Creator"
      description="Use your current event lane as the first pass for tour planning, then refine page details from the dashboard."
      emptyLabel="No artist dates are attached yet. Add dates from the dashboard or through venue booking."
      shows={myArtistShows}
      title="My artist tour planner"
    />
  ) : activeModule === 'events' ? (
    <DiscoverEventsPanel
      badge="Events"
      description="Review the dates already tied to your artist page."
      emptyLabel="No artist events are attached to your page yet."
      shows={myArtistShows}
      title="My artist events"
    />
  ) : (
    lockedPanel
  );

  return (
    <>
      <ProfileDirectoryPage
        activeModule={activeModule}
        badge="ARTISTS"
        currentHref="/artists"
        description="Artist engines keep scene shape, attention signals, route planning, and recommendations in one streamlined lane."
        modulePanel={modulePanel}
        moduleSubheader={<RoleModuleSubheader activeModule={activeModule} currentHref="/artists" role="artists" />}
        profiles={discoverProfiles}
        title="Artist lane"
      />
      {hasMoreArtists && nextArtistCursor ? (
        <div className="container section" style={{ textAlign: 'center', padding: '1.5rem 0 3rem' }}>
          <a className="button" href={`/artists?cursor=${nextArtistCursor}${activeModule ? `&module=${activeModule}` : ''}`}>
            Load more artists ({allArtists.length - visibleEnd} more)
          </a>
        </div>
      ) : null}
    </>
  );
}
