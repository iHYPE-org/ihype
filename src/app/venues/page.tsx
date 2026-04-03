import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  DiscoverCreatorPanel,
  DiscoverEventsPanel,
  DiscoverMyPagePanel,
  DiscoverStatsPanel
} from '@/components/DiscoverModulePanels';
import { NetworkEarthGlobe } from '@/components/NetworkEarthGlobe';
import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';
import { RoleModuleSubheader } from '@/components/RoleModuleSubheader';
import { resolveDiscoverModule } from '@/lib/discover-modules';
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

export default async function VenuesIndexPage({
  searchParams
}: {
  searchParams?: Promise<{ module?: string | string[] }>;
}) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeModule = resolveDiscoverModule('venues', resolvedSearchParams.module);
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

  const myVenueShows = myVenueProfile
    ? await db.show.findMany({
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
      })
    : [];

  const myVenueRequestCount = myVenueProfile
    ? await db.venueConnectionRequest.count({
        where: {
          venueProfileId: myVenueProfile.id
        }
      })
    : 0;

  const now = new Date();
  const liveOrUpcomingVenueShows = myVenueShows.filter((show) => show.status === 'LIVE' || show.startsAt >= now);
  const ticketsSold = myVenueShows.reduce((sum, show) => sum + show.ticketsSoldCount, 0);
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
      description="Sign in with a venue account to preview your page, open stats, and track your event lane."
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
    <DiscoverEventsPanel
      badge="Events"
      description="Review the shows already attached to your venue page."
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
      description="Venue discover keeps the focus on room performance, booking demand, and the nights that deserve a bigger push."
      discoverPanel={discoverPanel}
      modulePanel={modulePanel}
      moduleSubheader={<RoleModuleSubheader activeModule={activeModule} currentHref="/venues" role="venues" />}
      profiles={venues}
      title="Venue discover"
    />
  );
}
