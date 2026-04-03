import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildArtistMediaCollection } from '@/lib/media';
import {
  DiscoverCreatorPanel,
  DiscoverExplorerPanel,
  DiscoverEventsPanel,
  DiscoverMyPagePanel,
  DiscoverStatsPanel
} from '@/components/DiscoverModulePanels';
import { NetworkEarthGlobe } from '@/components/NetworkEarthGlobe';
import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';
import { PromoterShowCreationTool } from '@/components/PromoterShowCreationTool';
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

export default async function PromotersIndexPage({
  searchParams
}: {
  searchParams?: Promise<{ module?: string | string[] }>;
}) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeModule = resolveDiscoverModule('promoters', resolvedSearchParams.module);
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
        promoterProfileId: { not: null }
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
            type: 'DJ'
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

  const globeRouteStops = promoterShows
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
      description="Browse promoter-led nights near the detected request ZIP, then zoom back out to follow bigger event lanes."
      emptyRouteLabel="No promoter-led routes are mapped yet."
      routeLabel="Promoted history"
      routeStops={globeRouteStops}
      title="Earth globe for promoter routes"
      venues={venues}
      viewerLocation={viewerLocation}
    />
  );
  const discoverModuleContent = (
    <DiscoverExplorerPanel
      currentHref="/promoters"
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
    if (activeModule === 'my-page') {
      modulePanel = (
        <DiscoverMyPagePanel
          description="Preview the public promoter page artists, fans, and venues see when they open your profile."
          editHref={`/dashboard?profile=${myPromoterProfile.id}&edit=menu`}
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
    } else if (activeModule === 'stats') {
      modulePanel = (
        <DiscoverStatsPanel
          badge="Stats"
          description="A quick read on the event momentum tied to your promoter profile."
          stats={[
            { label: 'Fan hype', value: myPromoterProfile.hypeCount },
            { label: 'Total shows', value: myPromoterShows.length },
            { label: 'Live + upcoming', value: liveOrUpcomingPromoterShows.length },
            { label: 'Tickets sold', value: ticketsSold },
            { label: 'Venues worked', value: venueCount }
          ]}
          title="My promoter stats"
        />
      );
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
      description="Promoter discover keeps the focus on show momentum, room pressure, and the tools that move concepts into booked nights."
      discoverModuleContent={discoverModuleContent}
      modulePanel={modulePanel}
      moduleSubheader={<RoleModuleSubheader activeModule={activeModule} currentHref="/promoters" role="promoters" />}
      profiles={discoverProfiles}
      title="Promoter discover"
    />
  );
}
