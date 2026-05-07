import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
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

export default async function FanLandingPage({
  searchParams
}: {
  searchParams?: Promise<{ module?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeModule = resolveModule(resolvedSearchParams.module);

  const myFanProfile = await db.profile.findFirst({
    where: { ownerId: session.user.id, type: 'LISTENER' },
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
  });

  if (!myFanProfile) redirect('/dashboard');

  const [profileHypes, myShowHypes, fullSongListenCount, fullShowListenCount] = await Promise.all([
    db.profileHypeEvent.findMany({
      where: { userId: session.user.id },
      include: { profile: { select: { id: true, type: true } } }
    }),
    db.hypeEvent.findMany({
      where: { userId: session.user.id },
      include: {
        show: {
          include: { venueProfile: true, headlinerProfile: true, promoterProfile: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    db.mediaListen.count({ where: { userId: session.user.id, completedAt: { not: null } } }),
    db.showListen.count({ where: { userId: session.user.id } })
  ]);

  const now = new Date();
  const myShows = myShowHypes.map((entry) => entry.show);
  const myUpcomingShows = myShows.filter((show) => show.status === 'LIVE' || show.startsAt >= now);
  const myPastShows = myShows.filter(
    (show) => show.status === 'ENDED' || (show.startsAt < now && show.status !== 'LIVE')
  );
  const myEvents = [...myUpcomingShows, ...myPastShows];
  const hypePoints = myShows.length + profileHypes.length;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentFanHypeCount = await db.hypeEvent.count({
    where: { userId: session.user.id, createdAt: { gte: thirtyDaysAgo } }
  });

  const topGenres = Array.from(
    new Set(myFanProfile.genres.slice(0, 5))
  );
  const pageStyle = getProfileDesignStyleVars(myFanProfile.themePreset, {
    accentTone: myFanProfile.themeAccentTone,
    backdropTone: myFanProfile.themeBackdropTone,
    fontPreset: myFanProfile.themeFontPreset
  });

  const modulePanel =
    activeModule === 'my-page' ? (
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
        highlights={topGenres.length ? topGenres : undefined}
        stats={[
          { label: 'Hype points', value: hypePoints },
          { label: 'New hypes (30 days)', value: recentFanHypeCount },
          { label: 'Full songs listened', value: fullSongListenCount },
          { label: 'Full shows listened', value: fullShowListenCount },
          { label: 'Events attended', value: myPastShows.length },
          { label: 'Upcoming events', value: myUpcomingShows.length }
        ]}
        title="My fan stats"
      />
    ) : (
      <DiscoverEventsPanel
        badge="Events"
        description="Review the shows you have already backed and the ones still ahead."
        emptyLabel="No saved events are on your fan page yet."
        shows={myEvents}
        title="My fan events"
      />
    );

  return (
    <>
      <div className="site-subnav-shell">
        <nav aria-label="Fan lane modules" className="container site-subnav">
          <span className="site-subnav-label">Fan Lane</span>
          <Link
            className={activeModule === 'my-page' ? 'site-subnav-link active' : 'site-subnav-link'}
            href="/my/fan?module=my-page"
          >
            My Page
          </Link>
          <Link
            className={activeModule === 'stats' ? 'site-subnav-link active' : 'site-subnav-link'}
            href="/my/fan?module=stats"
          >
            Stats
          </Link>
          <Link
            className={activeModule === 'events' ? 'site-subnav-link active' : 'site-subnav-link'}
            href="/my/fan?module=events"
          >
            Events
          </Link>
          <div className="site-subnav-divider" aria-hidden="true" />
          <Link className="site-subnav-link site-subnav-link-utility" href="/fans">
            Fan Discover
          </Link>
        </nav>
      </div>
      <main className="container section">{modulePanel}</main>
    </>
  );
}
