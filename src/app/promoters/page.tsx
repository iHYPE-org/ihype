import Link from 'next/link';
import type { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildArtistMediaCollection } from '@/lib/media';
import {
  DiscoverCreatorPanel,
  DiscoverRecommendationPanel,
  DiscoverStatsPanel
} from '@/components/DiscoverModulePanels';
import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';
import { PromoterShowCreationTool } from '@/components/PromoterShowCreationTool';
import { RoleModuleSubheader } from '@/components/RoleModuleSubheader';
import {
  getTopMarketLabels,
  resolveDiscoverModule
} from '@/lib/discover-modules';
import { getDirectoryProfiles } from '@/lib/public-data';
import { ShowCard } from '@/components/ShowCard';

export const dynamic = 'force-dynamic';

export default async function PromotersIndexPage({
  searchParams
}: {
  searchParams?: Promise<{ module?: string | string[] }>;
}) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeModule = resolveDiscoverModule('promoters', resolvedSearchParams.module);
  const promoters = await getDirectoryProfiles('DJ');

  const promoterShows = await db.show.findMany({
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
  });

  const totalPromoterHype = promoters.reduce((sum, promoter) => sum + promoter.hypeCount, 0);
  const totalTicketsSold = promoterShows.reduce((sum, show) => sum + show.ticketsSoldCount, 0);
  const topMarkets = getTopMarketLabels(promoters);

  let modulePanel: ReactNode;

  if (activeModule === 'stats') {
    modulePanel = (
      <DiscoverStatsPanel
        badge="Stats"
        description="A quick read on promoter reach, promoted shows, and the amount of ticket movement already happening through the network."
        highlights={topMarkets}
        stats={[
          { label: 'Promoters', value: promoters.length },
          { label: 'Verified', value: promoters.filter((promoter) => promoter.verified).length },
          { label: 'Live + upcoming shows', value: promoterShows.filter((show) => show.status === 'LIVE' || show.status === 'SCHEDULED').length },
          { label: 'Promoter hype', value: totalPromoterHype },
          { label: 'Tickets sold', value: totalTicketsSold }
        ]}
        title="Promoter network stats"
      />
    );
  } else if (activeModule === 'recommendation-engine') {
    modulePanel = (
      <DiscoverRecommendationPanel
        badge="Recommendation engine"
        description="Use current promoter signals to decide which cities, artists, and rooms deserve the next push."
        opportunities={[
          {
            title: 'Own the strongest room cluster',
            summary: `${topMarkets[0] ?? 'The leading city cluster'} is carrying the most promoter momentum right now.`,
            detail: 'Lead with your tightest room concept and strongest recent show result in that market.'
          },
          {
            title: 'Package outcome, not just concept',
            summary: `${totalTicketsSold} tickets have moved through promoter-led shows already in the current data snapshot.`,
            detail: 'Use sold-through nights and repeat artist partnerships as the ad proof point.'
          },
          {
            title: 'Keep the artist pipeline active',
            summary: `${promoterShows.length} promoted shows are visible across the current network queue.`,
            detail: 'When a style lane starts moving, turn it into a repeatable show format before attention cools off.'
          }
        ]}
        title="Promoter recommendation engine"
      />
    );
  } else {
    const ownedPromoter =
      session?.user?.id
        ? await db.profile.findFirst({
            where: {
              ownerId: session.user.id,
              type: 'DJ'
            },
            select: {
              id: true,
              slug: true,
              name: true
            }
          })
        : null;

    if (ownedPromoter) {
      const artistProfiles = await db.profile.findMany({
        where: {
          type: 'ARTIST',
          OR: [{ mediaContent: { not: null } }, { mediaUploads: { some: {} } }]
        },
        select: {
          id: true,
          slug: true,
          name: true,
          heroImage: true,
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
        .map((artistProfile) => ({
          profileId: artistProfile.id,
          slug: artistProfile.slug,
          name: artistProfile.name,
          heroImage: artistProfile.heroImage,
          entries: buildArtistMediaCollection(artistProfile.mediaContent, artistProfile.mediaUploads).entries
        }))
        .filter((artistProfile) => artistProfile.entries.length > 0);

      modulePanel = (
        <DiscoverCreatorPanel
          badge="Show creator"
          description="Build the next promoter-led show without leaving your discover lane."
          title="Promoter show creator"
        >
          <PromoterShowCreationTool
            artists={artists}
            initialPromoterProfileId={ownedPromoter.id}
            promoters={[{ profileId: ownedPromoter.id, name: ownedPromoter.name, slug: ownedPromoter.slug }]}
          />
        </DiscoverCreatorPanel>
      );
    } else {
      modulePanel = (
        <DiscoverCreatorPanel
          actionHref={session?.user ? '/dashboard' : '/login'}
          actionLabel={session?.user ? 'Open dashboard' : 'Sign in as promoter'}
          badge="Show creator"
          description="Promoter show creation unlocks once you are signed into a promoter-owned profile."
          title="Promoter show creator"
        >
          <div className="discover-creator-grid">
            <div className="discover-creator-column">
              <h3>Recent promoted nights</h3>
              {promoterShows.length ? (
                <div className="grid grid-2">
                  {promoterShows.slice(0, 4).map((show) => (
                    <ShowCard key={show.id} show={show} />
                  ))}
                </div>
              ) : (
                <div className="empty">No promoter-led nights are listed yet.</div>
              )}
            </div>

            <div className="discover-creator-column">
              <h3>Promoters to watch</h3>
              <div className="discover-simple-list">
                {promoters.slice(0, 5).map((promoter) => (
                  <Link className="discover-simple-link" href={`/promoters/${promoter.slug}`} key={promoter.id}>
                    <strong>{promoter.name}</strong>
                    <span>{[promoter.city, promoter.stateRegion ?? promoter.country].filter(Boolean).join(', ') || 'Location building'}</span>
                    <span>{promoter.hypeCount} hype</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
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
      modulePanel={modulePanel}
      moduleSubheader={<RoleModuleSubheader activeModule={activeModule} currentHref="/promoters" role="promoters" />}
      profiles={promoters}
      title="Promoter discover"
    />
  );
}
