import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';
import { FanRecommendationsPanel } from '@/components/FanRecommendationsPanel';
import { NetworkEarthGlobe } from '@/components/NetworkEarthGlobe';
import { DiscoverTicketHubPanel } from '@/components/DiscoverModulePanels';
import { RoleModuleSubheader } from '@/components/RoleModuleSubheader';
import { resolveDiscoverModule } from '@/lib/discover-modules';
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
  const listeners = await getDirectoryProfiles('LISTENER');

  const [viewerLocation, venues, activeShows, profileHypes] = await Promise.all([
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
      : Promise.resolve([])
  ]);

  const likedArtistIds = new Set(
    profileHypes
      .filter((entry) => entry.profile.type === 'ARTIST')
      .map((entry) => entry.profile.id)
  );

  const nearbyShows = activeShows
    .filter((show) => {
      const venueProfile = show.venueProfile;
      if (!venueProfile) {
        return false;
      }

      if (viewerLocation?.postalCode && venueProfile.postalCode === viewerLocation.postalCode) {
        return true;
      }

      if (viewerLocation?.city && venueProfile.city === viewerLocation.city) {
        return true;
      }

      if (viewerLocation?.stateRegion && venueProfile.stateRegion === viewerLocation.stateRegion) {
        return true;
      }

      return false;
    })
    .slice(0, 4);

  const trendingShows = [...activeShows]
    .sort((left, right) => right.hypeCount * 3 + right.ticketsSoldCount - (left.hypeCount * 3 + left.ticketsSoldCount))
    .slice(0, 4);

  const promoterMatches = Array.from(
    activeShows.reduce(
      (map, show) => {
        if (!show.promoterProfile || !show.headlinerProfile || !likedArtistIds.has(show.headlinerProfile.id)) {
          return map;
        }

        const current = map.get(show.promoterProfile.id) ?? {
          id: show.promoterProfile.id,
          slug: show.promoterProfile.slug,
          name: show.promoterProfile.name,
          city: show.promoterProfile.city,
          stateRegion: show.promoterProfile.stateRegion,
          matchedArtistNames: new Set<string>(),
          sharedShowCount: 0
        };

        current.matchedArtistNames.add(show.headlinerProfile.name);
        current.sharedShowCount += 1;
        map.set(show.promoterProfile.id, current);
        return map;
      },
      new Map<
        string,
        {
          id: string;
          slug: string;
          name: string;
          city: string | null;
          stateRegion: string | null;
          matchedArtistNames: Set<string>;
          sharedShowCount: number;
        }
      >()
    ).values()
  )
    .map((entry) => ({
      ...entry,
      matchedArtistNames: [...entry.matchedArtistNames]
    }))
    .sort((left, right) => right.sharedShowCount - left.sharedShowCount)
    .slice(0, 5);

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

  const ticketHubShows = [...activeShows]
    .filter((show) => show.isTicketed)
    .sort((left, right) => right.ticketsSoldCount + right.hypeCount * 2 - (left.ticketsSoldCount + left.hypeCount * 2))
    .slice(0, 6);

  const modulePanel =
    activeModule === 'globe-search' ? (
      <NetworkEarthGlobe
        description="Start at the detected ZIP for this request, highlight nearby venues, then zoom out to browse active shows farther from home."
        emptyRouteLabel="No live or upcoming show routes are mapped yet."
        routeLabel="Event route"
        routeStops={globeRouteStops}
        title="Earth globe for nearby venues and active show routes"
        venues={venues}
        viewerLocation={viewerLocation}
      />
    ) : activeModule === 'recommendation-engine' ? (
      <FanRecommendationsPanel
        nearbyShows={nearbyShows}
        promoterMatches={promoterMatches}
        trendingShows={trendingShows}
        zipLabel={viewerLocation?.postalCode ?? null}
      />
    ) : (
      <DiscoverTicketHubPanel shows={ticketHubShows} />
    );

  return (
    <ProfileDirectoryPage
      activeModule={activeModule}
      badge="FANS"
      currentHref="/fans"
      description="Fan discover keeps the focus on nearby rooms, the next events worth watching, and the signals that turn hype into action."
      modulePanel={modulePanel}
      moduleSubheader={<RoleModuleSubheader activeModule={activeModule} currentHref="/fans" role="fans" />}
      profiles={listeners}
      title="Fan discover"
    />
  );
}
