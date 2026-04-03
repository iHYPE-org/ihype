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

export default async function ArtistsIndexPage({
  searchParams
}: {
  searchParams?: Promise<{ module?: string | string[] }>;
}) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeModule = resolveDiscoverModule('artists', resolvedSearchParams.module);
  const artists = await getDirectoryProfiles('ARTIST');

  const [viewerLocation, venues, artistShows, myArtistProfile] = await Promise.all([
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
          where: {
            ownerId: session.user.id,
            type: 'ARTIST'
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

  const globeRouteStops = artistShows
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
  ) : activeModule === 'my-page' ? (
    <DiscoverMyPagePanel
      description="Preview the public artist page listeners and bookers see when they open your profile."
      editHref={`/dashboard?profile=${myArtistProfile.id}&edit=menu`}
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
  ) : activeModule === 'stats' ? (
    <DiscoverStatsPanel
      badge="Stats"
      description="A quick read on the artist page signals attached to your profile."
      stats={[
        { label: 'Fan hype', value: myArtistProfile.hypeCount },
        { label: 'Total events', value: myArtistShows.length },
        { label: 'Live + upcoming', value: liveOrUpcomingArtistShows.length },
        { label: 'Verified', value: myArtistProfile.verified ? 'Yes' : 'No' },
        { label: 'Artists in network', value: artists.length }
      ]}
      title="My artist stats"
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
    <ProfileDirectoryPage
      activeModule={activeModule}
      badge="ARTISTS"
      currentHref="/artists"
      description="Artist discover is where artists read the shape of the scene, follow where attention is building, and line up their next route."
      discoverPanel={discoverPanel}
      modulePanel={modulePanel}
      moduleSubheader={<RoleModuleSubheader activeModule={activeModule} currentHref="/artists" role="artists" />}
      profiles={artists}
      title="Artist discover"
    />
  );
}
