import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildArtistMediaCollection } from '@/lib/media';
import {
  DiscoverCreatorPanel,
  DiscoverEventsPanel,
  DiscoverMyPagePanel,
  DiscoverStatsPanel
} from '@/components/DiscoverModulePanels';
import { PromoterShowCreationTool } from '@/components/PromoterShowCreationTool';
import { getProfileDesignStyleVars } from '@/lib/profile-design';

export const dynamic = 'force-dynamic';

type LandingModule = 'my-page' | 'stats' | 'events' | 'show-creator';

function resolveModule(value: string | string[] | undefined): LandingModule {
  if (value === 'stats' || value === 'events' || value === 'show-creator') return value;
  return 'my-page';
}

export default async function PromoterLandingPage({
  searchParams
}: {
  searchParams?: Promise<{ module?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeModule = resolveModule(resolvedSearchParams.module);

  const myPromoterProfile = await db.profile.findFirst({
    where: { ownerId: session.user.id, type: 'DJ' },
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
  });

  if (!myPromoterProfile) redirect('/dashboard');

  const myPromoterShows = await db.show.findMany({
    where: { promoterProfileId: myPromoterProfile.id, status: { not: 'CANCELED' } },
    include: { venueProfile: true, headlinerProfile: true, promoterProfile: true },
    orderBy: [{ startsAt: 'asc' }, { hypeCount: 'desc' }],
    take: 16
  });

  const now = new Date();
  const liveOrUpcomingShows = myPromoterShows.filter(
    (show) => show.status === 'LIVE' || show.startsAt >= now
  );
  const ticketsSold = myPromoterShows.reduce((sum, show) => sum + show.ticketsSoldCount, 0);
  const venueCount = new Set(
    myPromoterShows
      .map((show) => show.venueProfileId)
      .filter((id): id is string => Boolean(id))
  ).size;
  const pageStyle = getProfileDesignStyleVars(myPromoterProfile.themePreset, {
    accentTone: myPromoterProfile.themeAccentTone,
    backdropTone: myPromoterProfile.themeBackdropTone,
    fontPreset: myPromoterProfile.themeFontPreset
  });

  let modulePanel;

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
          { label: 'Live + upcoming', value: liveOrUpcomingShows.length },
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
  } else {
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
          select: { hexId: true, title: true, notes: true, mimeType: true, fileSizeBytes: true, createdAt: true },
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
      .filter((a) => a.entries.length > 0);

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

  return (
    <>
      <div className="site-subnav-shell">
        <nav aria-label="Promoter lane modules" className="container site-subnav">
          <span className="site-subnav-label">Promoter Lane</span>
          <Link
            className={activeModule === 'my-page' ? 'site-subnav-link active' : 'site-subnav-link'}
            href="/my/promoter?module=my-page"
          >
            My Page
          </Link>
          <Link
            className={activeModule === 'stats' ? 'site-subnav-link active' : 'site-subnav-link'}
            href="/my/promoter?module=stats"
          >
            Stats
          </Link>
          <Link
            className={activeModule === 'show-creator' ? 'site-subnav-link active' : 'site-subnav-link'}
            href="/my/promoter?module=show-creator"
          >
            Show Creator
          </Link>
          <Link
            className={activeModule === 'events' ? 'site-subnav-link active' : 'site-subnav-link'}
            href="/my/promoter?module=events"
          >
            Events
          </Link>
          <div className="site-subnav-divider" aria-hidden="true" />
          <Link className="site-subnav-link site-subnav-link-utility" href="/promoters">
            Promoter Discover
          </Link>
        </nav>
      </div>
      <main className="container section">{modulePanel}</main>
    </>
  );
}
