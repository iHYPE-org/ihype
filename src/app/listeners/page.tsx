import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  DiscoverCreatorPanel,
  DiscoverExplorerPanel,
  DiscoverEventsPanel,
  DiscoverMyPagePanel,
  DiscoverStatsPanel
} from '@/components/DiscoverModulePanels';
import { NetworkEarthGlobe } from '@/components/NetworkEarthGlobe';
import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';
import { RoleModuleSubheader } from '@/components/RoleModuleSubheader';
import { resolveDiscoverModule } from '@/lib/discover-modules';
import { getSharedDiscoverFeed } from '@/lib/discover-feed';
import { getProfileDesignStyleVars } from '@/lib/profile-design';
import { detectRequestLocation } from '@/lib/request-location';
import { getDirectoryProfiles } from '@/lib/public-data';

export const dynamic = 'force-dynamic';

function formatShowDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(value);
}

export default async function ListenersIndexPage({
  searchParams
}: {
  searchParams?: Promise<{ module?: string | string[] }>;
}) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeModule = resolveDiscoverModule('fans', resolvedSearchParams.module);
  const [artists, promoters, venuesForBrowse] = await Promise.all([
    getDirectoryProfiles('ARTIST'),
    getDirectoryProfiles('DJ'),
    getDirectoryProfiles('VENUE')
  ]);
  const discoverProfiles = [...artists, ...promoters, ...venuesForBrowse];

  const [
    viewerLocation,
    venues,
    activeShows,
    profileHypes,
    myFanProfile,
    myShowHypes,
    fullSongListenCount,
    fullShowListenCount
  ] = await Promise.all([
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
        status: { in: ['SCHEDULED', 'LIVE'] }
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
      ? db.profileHypeEvent.findMany({
          where: { userId: session.user.id },
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
    session?.user?.id
      ? db.profile.findFirst({
          where: {
            ownerId: session.user.id,
            type: 'LISTENER'
          },
          select: {
            id: true,
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
    session?.user?.id
      ? db.hypeEvent.findMany({
          where: { userId: session.user.id },
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
    session?.user?.id
      ? db.mediaListen.count({
          where: {
            userId: session.user.id,
            completedAt: { not: null }
          }
        })
      : Promise.resolve(0),
    session?.user?.id
      ? db.showListen.count({
          where: {
            userId: session.user.id
          }
        })
      : Promise.resolve(0)
  ]);

  const now = new Date();
  const globeRouteStops = activeShows
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
      timing: show.status === 'LIVE' ? ('live' as const) : ('upcoming' as const)
    }));

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
  const discoverModuleContent = (
    <DiscoverExplorerPanel
      currentHref="/fans"
      globePanel={discoverPanel}
      hypedNearMe={discoverFeed.hypedNearMe}
      mediaEntries={discoverFeed.mediaEntries}
      newArtists={discoverFeed.newArtists}
      newPromoters={discoverFeed.newPromoters}
      profiles={discoverProfiles}
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
  ) : activeModule === 'my-page' ? (
    <DiscoverMyPagePanel
      description="Preview the public fan page other people see when they open your profile."
      editHref={`/dashboard?profile=${myFanProfile.id}&edit=menu`}
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
  ) : activeModule === 'stats' ? (
    <DiscoverStatsPanel
      badge="Stats"
      description="Track the listening and event signals that make up your fan footprint across iHYPE."
      stats={[
        { label: 'Hype points', value: hypePoints },
        { label: 'Full songs listened', value: fullSongListenCount },
        { label: 'Full shows listened', value: fullShowListenCount },
        { label: 'Events attended', value: myPastShows.length },
        { label: 'Upcoming events', value: myUpcomingShows.length }
      ]}
      title="My fan stats"
    />
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
      description="Fan discover keeps the focus on nearby rooms, the next events worth watching, and the signals that turn hype into action."
      discoverModuleContent={discoverModuleContent}
      modulePanel={modulePanel}
      moduleSubheader={<RoleModuleSubheader activeModule={activeModule} currentHref="/fans" role="fans" />}
      profiles={discoverProfiles}
      title="Fan discover"
    />
  );
}
