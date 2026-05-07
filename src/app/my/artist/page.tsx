import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  DiscoverCreatorPanel,
  DiscoverEventsPanel,
  DiscoverMyPagePanel,
  DiscoverStatsPanel
} from '@/components/DiscoverModulePanels';
import { getProfileDesignStyleVars } from '@/lib/profile-design';

export const dynamic = 'force-dynamic';

type LandingModule = 'my-page' | 'stats' | 'events';

function resolveModule(value: string | string[] | undefined): LandingModule {
  if (value === 'stats' || value === 'events') return value;
  return 'my-page';
}

export default async function ArtistLandingPage({
  searchParams
}: {
  searchParams?: Promise<{ module?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeModule = resolveModule(resolvedSearchParams.module);

  const myArtistProfile = await db.profile.findFirst({
    where: { ownerId: session.user.id, type: 'ARTIST' },
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

  if (!myArtistProfile) redirect('/dashboard');

  const myArtistShows = await db.show.findMany({
    where: { headlinerProfileId: myArtistProfile.id, status: { not: 'CANCELED' } },
    include: { venueProfile: true, headlinerProfile: true, promoterProfile: true },
    orderBy: [{ startsAt: 'asc' }, { hypeCount: 'desc' }],
    take: 16
  });

  const now = new Date();
  const liveOrUpcomingShows = myArtistShows.filter(
    (show) => show.status === 'LIVE' || show.startsAt >= now
  );
  const pageStyle = getProfileDesignStyleVars(myArtistProfile.themePreset, {
    accentTone: myArtistProfile.themeAccentTone,
    backdropTone: myArtistProfile.themeBackdropTone,
    fontPreset: myArtistProfile.themeFontPreset
  });

  const artistCount = await db.profile.count({ where: { type: 'ARTIST' } });

  const ticketsSold = myArtistShows.reduce((sum, s) => sum + s.ticketsSoldCount, 0);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [mediaListenCount, showListenCount, recentHypeCount, topVenueNames] = await Promise.all([
    db.mediaListen.count({
      where: { artistProfileSlug: myArtistProfile.slug, completedAt: { not: null } }
    }),
    db.showListen.count({
      where: { show: { headlinerProfileId: myArtistProfile.id } }
    }),
    db.profileHypeEvent.count({
      where: { profileId: myArtistProfile.id, createdAt: { gte: thirtyDaysAgo } }
    }),
    Promise.resolve(
      Array.from(
        new Set(
          myArtistShows
            .map((s) => s.venueProfile?.name)
            .filter((n): n is string => Boolean(n))
        )
      ).slice(0, 5)
    )
  ]);

  const modulePanel =
    activeModule === 'my-page' ? (
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
        highlights={topVenueNames.length ? topVenueNames : undefined}
        stats={[
          { label: 'Fan hype (total)', value: myArtistProfile.hypeCount },
          { label: 'New hypes (30 days)', value: recentHypeCount },
          { label: 'Full song listens', value: mediaListenCount },
          { label: 'Full show listens', value: showListenCount },
          { label: 'Tickets sold', value: ticketsSold },
          { label: 'Total events', value: myArtistShows.length },
          { label: 'Live + upcoming', value: liveOrUpcomingShows.length },
          { label: 'Verified', value: myArtistProfile.verified ? 'Yes' : 'No' }
        ]}
        title="My artist stats"
      />
    ) : (
      <DiscoverEventsPanel
        badge="Events"
        description="Review the dates already tied to your artist page."
        emptyLabel="No artist events are attached to your page yet."
        shows={myArtistShows}
        title="My artist events"
      />
    );

  return (
    <>
      <div className="site-subnav-shell">
        <nav aria-label="Artist lane modules" className="container site-subnav">
          <span className="site-subnav-label">Artist Lane</span>
          <Link
            className={activeModule === 'my-page' ? 'site-subnav-link active' : 'site-subnav-link'}
            href="/my/artist?module=my-page"
          >
            My Page
          </Link>
          <Link
            className={activeModule === 'stats' ? 'site-subnav-link active' : 'site-subnav-link'}
            href="/my/artist?module=stats"
          >
            Stats
          </Link>
          <Link
            className={activeModule === 'events' ? 'site-subnav-link active' : 'site-subnav-link'}
            href="/my/artist?module=events"
          >
            Events
          </Link>
          <div className="site-subnav-divider" aria-hidden="true" />
          <Link className="site-subnav-link site-subnav-link-utility" href="/artists">
            Artist Discover
          </Link>
        </nav>
      </div>
      <main className="container section">{modulePanel}</main>
    </>
  );
}
