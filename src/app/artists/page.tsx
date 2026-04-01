import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  DiscoverCreatorPanel,
  DiscoverRecommendationPanel,
  DiscoverStatsPanel
} from '@/components/DiscoverModulePanels';
import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';
import { RoleModuleSubheader } from '@/components/RoleModuleSubheader';
import {
  getTopMarketLabels,
  resolveDiscoverModule
} from '@/lib/discover-modules';
import { getDirectoryProfiles } from '@/lib/public-data';
import { getTransparencySnapshot } from '@/lib/transparency';
import { ShowCard } from '@/components/ShowCard';

export const dynamic = 'force-dynamic';

export default async function ArtistsIndexPage({
  searchParams
}: {
  searchParams?: Promise<{ module?: string | string[] }>;
}) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeModule = resolveDiscoverModule('artists', resolvedSearchParams.module);
  const artists = await getDirectoryProfiles('ARTIST');

  const [transparencySnapshot, artistShows, topVenues] = await Promise.all([
    getTransparencySnapshot(),
    db.show.findMany({
      where: {
        status: { not: 'CANCELED' },
        headlinerProfile: {
          is: { type: 'ARTIST' }
        }
      },
      include: {
        venueProfile: true,
        headlinerProfile: true
      },
      orderBy: [{ startsAt: 'asc' }, { hypeCount: 'desc' }],
      take: 16
    }),
    db.profile.findMany({
      where: { type: 'VENUE' },
      orderBy: [{ verified: 'desc' }, { hypeCount: 'desc' }, { name: 'asc' }],
      take: 5,
      select: {
        id: true,
        slug: true,
        name: true,
        city: true,
        stateRegion: true,
        country: true,
        hypeCount: true
      }
    })
  ]);

  const upcomingArtistShows = artistShows.filter((show) => show.status === 'LIVE' || show.startsAt >= new Date()).slice(0, 4);
  const topMarkets = getTopMarketLabels(artists);
  const totalArtistHype = artists.reduce((sum, artist) => sum + artist.hypeCount, 0);

  const modulePanel =
    activeModule === 'stats' ? (
      <DiscoverStatsPanel
        badge="Stats"
        description="A snapshot of what the artist network looks like right now across profiles, shows, and uploaded media."
        highlights={topMarkets}
        stats={[
          { label: 'Artists', value: artists.length },
          { label: 'Verified', value: artists.filter((artist) => artist.verified).length },
          { label: 'Live + upcoming shows', value: artistShows.filter((show) => show.status === 'LIVE' || show.status === 'SCHEDULED').length },
          { label: 'Artist hype', value: totalArtistHype },
          { label: 'Songs uploaded', value: transparencySnapshot.counters.totalSongsUploaded }
        ]}
        title="Artist network stats"
      />
    ) : activeModule === 'recommendation-engine' ? (
      <DiscoverRecommendationPanel
        badge="Recommendation engine"
        description="Use the strongest artist markets and current show pressure to decide where to advertise, book, and grow next."
        opportunities={[
          {
            title: 'Lead with the hottest market',
            summary: `${topMarkets[0] ?? 'Your hometown cluster'} is carrying the strongest current artist density.`,
            detail: 'Run your next awareness push where artist supply and fan attention are already compounding.'
          },
          {
            title: 'Turn uploads into booking proof',
            summary: `${transparencySnapshot.counters.totalSongsUploaded} artist and promoter uploads are already feeding discovery across the network.`,
            detail: 'Use your strongest playable track and updated banner look as the opening creative for new rooms.'
          },
          {
            title: 'Tie growth to live dates',
            summary: `${artistShows.filter((show) => show.status === 'LIVE' || show.status === 'SCHEDULED').length} artist-led shows are visible in the current queue.`,
            detail: 'When you have a date, point promotion at that market first and let the tour narrative do the rest.'
          }
        ]}
        title="Artist recommendation engine"
      />
    ) : (
      <DiscoverCreatorPanel
        actionHref={session?.user ? '/dashboard' : '/login'}
        actionLabel={session?.user ? 'Open artist dashboard' : 'Sign in as artist'}
        badge="Tour creator"
        description="Shape your next route by watching where shows are already landing and which venues are pulling the most heat."
        title="Build the next artist route"
      >
        <div className="discover-creator-grid">
          <div className="discover-creator-column">
            <h3>Upcoming artist pressure</h3>
            {upcomingArtistShows.length ? (
              <div className="grid grid-2">
                {upcomingArtistShows.map((show) => (
                  <ShowCard key={show.id} show={show} />
                ))}
              </div>
            ) : (
              <div className="empty">No artist-led dates are queued yet.</div>
            )}
          </div>

          <div className="discover-creator-column">
            <h3>Venues to watch</h3>
            <div className="discover-simple-list">
              {topVenues.map((venue) => (
                <Link className="discover-simple-link" href={`/venues/${venue.slug}`} key={venue.id}>
                  <strong>{venue.name}</strong>
                  <span>{[venue.city, venue.stateRegion ?? venue.country].filter(Boolean).join(', ') || 'Location building'}</span>
                  <span>{venue.hypeCount} hype</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </DiscoverCreatorPanel>
    );

  return (
    <ProfileDirectoryPage
      activeModule={activeModule}
      badge="ARTISTS"
      currentHref="/artists"
      description="Artist discover is where artists read the shape of the scene, follow where attention is building, and line up their next route."
      modulePanel={modulePanel}
      moduleSubheader={<RoleModuleSubheader activeModule={activeModule} currentHref="/artists" role="artists" />}
      profiles={artists}
      title="Artist discover"
    />
  );
}
