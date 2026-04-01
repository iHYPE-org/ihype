import Link from 'next/link';
import type { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  DiscoverCreatorPanel,
  DiscoverStatsPanel,
  VenueBookingRecommendationEngine
} from '@/components/DiscoverModulePanels';
import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';
import { RoleModuleSubheader } from '@/components/RoleModuleSubheader';
import { VenueEventScheduler } from '@/components/VenueEventScheduler';
import {
  getTopMarketLabels,
  resolveDiscoverModule
} from '@/lib/discover-modules';
import { getDirectoryProfiles } from '@/lib/public-data';
import { ShowCard } from '@/components/ShowCard';
import {
  buildVenueBookingRecommendations,
  buildVenueCalendarEvents
} from '@/lib/venue-booking';

export const dynamic = 'force-dynamic';

type VenueSchedulerAct = {
  id: string;
  name: string;
  type: 'ARTIST' | 'DJ';
  requestCount?: number;
  availabilitySummary?: string;
  nextShowAtLabel?: string | null;
  rationale?: string;
  suggestedSlots?: Array<{
    value: string;
    label: string;
  }>;
};

export default async function VenuesIndexPage({
  searchParams
}: {
  searchParams?: Promise<{ module?: string | string[]; artist?: string | string[] }>;
}) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeModule = resolveDiscoverModule('venues', resolvedSearchParams.module);
  const preferredArtistId =
    typeof resolvedSearchParams.artist === 'string' ? resolvedSearchParams.artist : undefined;
  const venues = await getDirectoryProfiles('VENUE');

  const [venueShows, totalRequestCount] = await Promise.all([
    db.show.findMany({
      where: {
        status: { not: 'CANCELED' },
        venueProfileId: { not: null }
      },
      include: {
        venueProfile: true,
        headlinerProfile: true
      },
      orderBy: [{ startsAt: 'asc' }, { hypeCount: 'desc' }],
      take: 18
    }),
    db.venueConnectionRequest.count()
  ]);

  const totalVenueHype = venues.reduce((sum, venue) => sum + venue.hypeCount, 0);
  const totalTicketsSold = venueShows.reduce((sum, show) => sum + show.ticketsSoldCount, 0);
  const topMarkets = getTopMarketLabels(venues);

  let modulePanel: ReactNode;

  if (activeModule === 'stats') {
    modulePanel = (
      <DiscoverStatsPanel
        badge="Stats"
        description="See how many rooms are active, how tickets are moving, and where the strongest venue clusters are building."
        highlights={topMarkets}
        stats={[
          { label: 'Venues', value: venues.length },
          { label: 'Verified', value: venues.filter((venue) => venue.verified).length },
          { label: 'Live + upcoming shows', value: venueShows.filter((show) => show.status === 'LIVE' || show.status === 'SCHEDULED').length },
          { label: 'Venue hype', value: totalVenueHype },
          { label: 'Booking requests', value: totalRequestCount },
          { label: 'Tickets sold', value: totalTicketsSold }
        ]}
        title="Venue network stats"
      />
    );
  } else if (activeModule === 'recommendation-engine') {
    const fanRequests = await db.venueConnectionRequest.findMany({
      where: {
        requesterType: 'LISTENER',
        artistProfileId: { not: null }
      },
      include: {
        artistProfile: {
          select: {
            id: true,
            slug: true,
            name: true,
            type: true,
            city: true,
            stateRegion: true,
            country: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const requestedArtistIds = Array.from(
      new Set(
        fanRequests
          .map((request) => request.artistProfileId)
          .filter((artistProfileId): artistProfileId is string => Boolean(artistProfileId))
      )
    );

    const artistShows = requestedArtistIds.length
      ? await db.show.findMany({
          where: {
            headlinerProfileId: { in: requestedArtistIds },
            status: { in: ['SCHEDULED', 'LIVE'] }
          },
          select: {
            id: true,
            title: true,
            startsAt: true,
            status: true,
            headlinerProfileId: true
          },
          orderBy: { startsAt: 'asc' }
        })
      : [];

    const bookingRecommendations = buildVenueBookingRecommendations({
      requests: fanRequests,
      artistShows,
      venueShows: []
    });

    modulePanel = (
      <VenueBookingRecommendationEngine currentHref="/venues" scopes={bookingRecommendations.scopeGroups} />
    );
  } else {
    const ownedVenue =
      session?.user?.id
        ? await db.profile.findFirst({
            where: {
              ownerId: session.user.id,
              type: 'VENUE'
            },
            select: {
              id: true,
              name: true
            }
          })
        : null;

    if (ownedVenue) {
      const [bookableProfiles, connectionRequests, fanRequests, ownedVenueShows] = await Promise.all([
        db.profile.findMany({
          where: { type: { in: ['ARTIST', 'DJ'] } },
          orderBy: [{ verified: 'desc' }, { name: 'asc' }],
          select: { id: true, name: true, type: true }
        }),
        db.venueConnectionRequest.findMany({
          where: {
            venueProfileId: ownedVenue.id,
            status: 'BOOKED',
            artistProfileId: { not: null }
          },
          include: {
            artistProfile: {
              select: {
                id: true,
                name: true,
                type: true
              }
            }
          }
        }),
        db.venueConnectionRequest.findMany({
          where: {
            requesterType: 'LISTENER',
            artistProfileId: { not: null }
          },
          include: {
            artistProfile: {
              select: {
                id: true,
                slug: true,
                name: true,
                type: true,
                city: true,
                stateRegion: true,
                country: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        db.show.findMany({
          where: {
            venueProfileId: ownedVenue.id,
            status: { in: ['SCHEDULED', 'LIVE'] }
          },
          select: {
            id: true,
            title: true,
            startsAt: true,
            status: true,
            headlinerProfile: {
              select: {
                name: true
              }
            }
          },
          orderBy: { startsAt: 'asc' }
        })
      ]);

      const requestedArtistIds = Array.from(
        new Set(
          fanRequests
            .map((request) => request.artistProfileId)
            .filter((artistProfileId): artistProfileId is string => Boolean(artistProfileId))
        )
      );

      const artistShows = requestedArtistIds.length
        ? await db.show.findMany({
            where: {
              headlinerProfileId: { in: requestedArtistIds },
              status: { in: ['SCHEDULED', 'LIVE'] }
            },
            select: {
              id: true,
              title: true,
              startsAt: true,
              status: true,
              headlinerProfileId: true
            },
            orderBy: { startsAt: 'asc' }
          })
        : [];

      const bookingRecommendations = buildVenueBookingRecommendations({
        requests: fanRequests,
        artistShows,
        venueShows: ownedVenueShows
      });

      const bookedActs: VenueSchedulerAct[] = Array.from(
        new Map(
          connectionRequests
            .filter((request) => request.artistProfile)
            .map((request) => [
              request.artistProfile!.id,
              {
                id: request.artistProfile!.id,
                name: request.artistProfile!.name,
                type: request.artistProfile!.type as 'ARTIST' | 'DJ'
              }
            ])
        ).values()
      );

      const selectableActMap = new Map<string, VenueSchedulerAct>();

      for (const artist of bookingRecommendations.actOptions) {
        selectableActMap.set(artist.id, {
          id: artist.id,
          name: artist.name,
          type: artist.type,
          requestCount: artist.requestCount,
          availabilitySummary: artist.availabilitySummary,
          nextShowAtLabel: artist.nextShowAtLabel,
          rationale: artist.rationale,
          suggestedSlots: artist.suggestedSlots
        });
      }

      for (const artist of bookedActs) {
        selectableActMap.set(artist.id, artist);
      }

      const selectableActs = Array.from(selectableActMap.values());

      const promoterOptions = bookableProfiles
        .filter((bookableProfile) => bookableProfile.type === 'DJ')
        .map((bookableProfile) => ({ id: bookableProfile.id, name: bookableProfile.name }));

      modulePanel = (
        <DiscoverCreatorPanel
          badge="Event ticketing engine"
          description="Connect fan-requested artists, artist tour availability, and your venue calendar into the next ticketed event."
          title="Venue event ticketing engine"
        >
          <VenueEventScheduler
            bookedActs={selectableActs}
            promoterOptions={promoterOptions}
            preferredActId={preferredArtistId}
            recommendedActs={bookingRecommendations.actOptions}
            scheduledEvents={buildVenueCalendarEvents(ownedVenueShows)}
            venueProfileId={ownedVenue.id}
          />
        </DiscoverCreatorPanel>
      );
    } else {
      modulePanel = (
        <DiscoverCreatorPanel
          actionHref={session?.user ? '/dashboard' : '/login'}
          actionLabel={session?.user ? 'Open dashboard' : 'Sign in as venue'}
          badge="Event ticketing engine"
          description="Venue event creation opens once you are signed into a venue-owned profile, and it uses fan-requested artists plus calendar availability."
          title="Venue event ticketing engine"
        >
          <div className="discover-creator-grid">
            <div className="discover-creator-column">
              <h3>Upcoming room nights</h3>
              {venueShows.length ? (
                <div className="grid grid-2">
                  {venueShows.slice(0, 4).map((show) => (
                    <ShowCard key={show.id} show={show} />
                  ))}
                </div>
              ) : (
                <div className="empty">No venue events are listed yet.</div>
              )}
            </div>

            <div className="discover-creator-column">
              <h3>Venue leaders</h3>
              <div className="discover-simple-list">
                {venues.slice(0, 5).map((venue) => (
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
    }
  }

  return (
    <ProfileDirectoryPage
      activeModule={activeModule}
      badge="VENUES"
      currentHref="/venues"
      description="Venue discover keeps the focus on room performance, booking demand, and the nights that deserve a bigger push."
      modulePanel={modulePanel}
      moduleSubheader={<RoleModuleSubheader activeModule={activeModule} currentHref="/venues" role="venues" />}
      profiles={venues}
      title="Venue discover"
    />
  );
}
