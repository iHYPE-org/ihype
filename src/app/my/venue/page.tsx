import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  DiscoverCreatorPanel,
  DiscoverMyPagePanel,
  DiscoverRecommendationPanel
} from '@/components/DiscoverModulePanels';
import { VenueEventScheduler, type BookedAct } from '@/components/VenueEventScheduler';
import { getProfileDesignStyleVars } from '@/lib/profile-design';
import { buildVenueBookingRecommendations } from '@/lib/venue-booking';

export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
export const metadata: Metadata = { robots: { index: false, follow: false } };

type LandingModule = 'my-page' | 'recommendation-engine' | 'events';

function resolveModule(value: string | string[] | undefined): LandingModule {
  if (value === 'stats' || value === 'recommendation-engine') return 'recommendation-engine';
  if (value === 'events') return 'events';
  return 'my-page';
}

function formatShowDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(value);
}

export default async function VenueLandingPage({
  searchParams
}: {
  searchParams?: Promise<{ module?: string | string[]; artist?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeModule = resolveModule(resolvedSearchParams.module);
  const preferredArtistId =
    typeof resolvedSearchParams.artist === 'string' ? resolvedSearchParams.artist : undefined;

  const myVenueProfile = await db.profile.findFirst({
    where: { ownerId: session.user.id, type: 'VENUE' },
    select: {
      id: true,
      slug: true,
      name: true,
      headline: true,
      bio: true,
      city: true,
      stateRegion: true,
      country: true,
      postalCode: true,
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

  if (!myVenueProfile) redirect('/dashboard');

  const [myVenueShows, myVenueRequestCount, venueRequests, promoterOptions, bookableActs] = await Promise.all([
    db.show.findMany({
      where: { venueProfileId: myVenueProfile.id, status: { not: 'CANCELED' } },
      include: { venueProfile: true, headlinerProfile: true, promoterProfile: true },
      orderBy: [{ startsAt: 'asc' }, { hypeCount: 'desc' }],
      take: 16
    }),
    db.venueConnectionRequest.count({ where: { venueProfileId: myVenueProfile.id } }),
    db.venueConnectionRequest.findMany({
      where: { venueProfileId: myVenueProfile.id, status: { in: ['PENDING', 'BOOKED'] } },
      include: {
        artistProfile: {
          select: {
            id: true, slug: true, name: true, type: true,
            contactInfo: true, hometown: true, city: true,
            stateRegion: true, country: true, verified: true
          }
        }
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 60
    }),
    db.profile.findMany({
      where: { type: 'DJ' },
      orderBy: [{ verified: 'desc' }, { hypeCount: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true },
      take: 40
    }),
    db.profile.findMany({
      where: { type: { in: ['ARTIST', 'DJ'] } },
      orderBy: [{ verified: 'desc' }, { hypeCount: 'desc' }, { name: 'asc' }],
      select: {
        id: true, slug: true, name: true, type: true,
        contactInfo: true, hometown: true, city: true,
        stateRegion: true, country: true, verified: true
      },
      take: 60
    })
  ]);

  const bookableActIds = Array.from(
    new Set([
      ...venueRequests
        .map((r) => r.artistProfile?.id)
        .filter((id): id is string => Boolean(id)),
      ...bookableActs.map((p) => p.id)
    ])
  );

  const actShows = bookableActIds.length
    ? await db.show.findMany({
        where: {
          headlinerProfileId: { in: bookableActIds },
          status: { notIn: ['CANCELED', 'ENDED'] }
        },
        select: { id: true, title: true, startsAt: true, status: true, headlinerProfileId: true },
        orderBy: [{ startsAt: 'asc' }]
      })
    : [];

  const now = new Date();
  const liveOrUpcomingShows = myVenueShows.filter((s) => s.status === 'LIVE' || s.startsAt >= now);
  const ticketsSold = myVenueShows.reduce((sum, s) => sum + s.ticketsSoldCount, 0);

  const showIds = myVenueShows.map((s) => s.id);
  const [grossRevenueCents, recentVenueHypeCount] = await Promise.all([
    showIds.length
      ? db.ticketOrder.aggregate({
          _sum: { subtotalCents: true },
          where: { showId: { in: showIds }, status: { not: 'VOID' } }
        }).then((r) => r._sum.subtotalCents ?? 0)
      : Promise.resolve(0),
    db.profileHypeEvent.count({
      where: {
        profileId: myVenueProfile.id,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    })
  ]);

  const uniqueArtistsHosted = new Set(
    myVenueShows
      .map((s) => s.headlinerProfileId)
      .filter((id): id is string => Boolean(id))
  ).size;
  const topHeadliners = Array.from(
    new Set(
      myVenueShows
        .map((s) => s.headlinerProfile?.name)
        .filter((n): n is string => Boolean(n))
    )
  ).slice(0, 5);
  const grossRevenueDisplay = (grossRevenueCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });
  const venueStats = [
    { label: 'Fan hype (total)', value: myVenueProfile.hypeCount },
    { label: 'New hypes (30 days)', value: recentVenueHypeCount },
    { label: 'Gross ticket revenue', value: grossRevenueDisplay },
    { label: 'Tickets sold', value: ticketsSold },
    { label: 'Unique artists hosted', value: uniqueArtistsHosted },
    { label: 'Total events', value: myVenueShows.length },
    { label: 'Live + upcoming', value: liveOrUpcomingShows.length },
    { label: 'Requests received', value: myVenueRequestCount }
  ];
  const venueRecommendationOpportunities = [
    {
      title: 'Book around proven demand',
      summary: `${myVenueRequestCount} artist requests and ${myVenueShows.length} events can guide the next room decision.`,
      detail: 'The strongest recommendations blend fan requests, event history, and ticket movement.'
    },
    {
      title: 'Use ticket velocity as a signal',
      summary: `${ticketsSold} tickets sold gives the engine a better read on what fills your room.`,
      detail: 'Open events only when the booking, split, and capacity are ready.'
    },
    {
      title: 'Bring back high-fit artists',
      summary: topHeadliners.length
        ? `Recent headliner signal: ${topHeadliners.join(', ')}.`
        : 'Headliner signals will sharpen once more events are tied to this venue.',
      detail: 'Repeat-fit artists are easier to recommend when fan HYPE clusters nearby.'
    }
  ];
  const recommendationData = buildVenueBookingRecommendations({
    requests: venueRequests.map((r) => ({
      status: r.status,
      artistProfile: r.artistProfile
        ? {
            id: r.artistProfile.id,
            slug: r.artistProfile.slug,
            name: r.artistProfile.name,
            type: r.artistProfile.type,
            city: r.artistProfile.city,
            stateRegion: r.artistProfile.stateRegion,
            country: r.artistProfile.country
          }
        : null
    })),
    artistShows: actShows,
    venueShows: myVenueShows.map((s) => ({
      id: s.id,
      title: s.title,
      startsAt: s.startsAt,
      status: s.status,
      headlinerProfile: s.headlinerProfile ? { name: s.headlinerProfile.name } : null
    }))
  });
  const bookableActMap = new Map(bookableActs.map((p) => [p.id, p]));
  const recommendedActs: BookedAct[] = recommendationData.actOptions.map((artist) => {
    const profile = bookableActMap.get(artist.id);
    return { ...artist, contactInfo: profile?.contactInfo ?? null, hometown: profile?.hometown ?? null, verified: profile?.verified ?? false };
  });
  const manualActs: BookedAct[] = bookableActs.map((p) => ({
    id: p.id,
    name: p.name,
    type: (p.type === 'DJ' ? 'DJ' : 'ARTIST') as 'ARTIST' | 'DJ',
    contactInfo: p.contactInfo,
    hometown: p.hometown,
    city: p.city,
    stateRegion: p.stateRegion,
    country: p.country,
    verified: p.verified,
    requestCount: 0,
    availabilitySummary: 'Manual booking pool',
    suggestedSlots: [],
    rationale: 'Manual venue booking selection'
  }));
  const schedulerActs: BookedAct[] = Array.from(
    new Map([...recommendedActs, ...manualActs].map((a) => [a.id, a])).values()
  );
  const scheduledEvents = myVenueShows.map((s) => ({
    id: s.id,
    title: s.title,
    slug: s.slug,
    startsAtLabel: formatShowDate(s.startsAt),
    status: s.status,
    headlinerName: s.headlinerProfile?.name ?? null,
    isTicketed: s.isTicketed,
    ticketingOpenedAtLabel: s.ticketingOpensAt ? `Opened ${formatShowDate(s.ticketingOpensAt)}` : null,
    ticketPriceCents: s.ticketPriceCents,
    ticketCapacity: s.ticketCapacity,
    ticketsSoldCount: s.ticketsSoldCount
  }));
  const pageStyle = getProfileDesignStyleVars(myVenueProfile.themePreset, {
    accentTone: myVenueProfile.themeAccentTone,
    backdropTone: myVenueProfile.themeBackdropTone,
    fontPreset: myVenueProfile.themeFontPreset
  });

  const modulePanel =
    activeModule === 'my-page' ? (
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
    ) : activeModule === 'recommendation-engine' ? (
      <DiscoverRecommendationPanel
        badge="Recommendation Engine"
        description="Your venue stats now sit beside the booking recommendations they influence."
        opportunities={venueRecommendationOpportunities}
        stats={venueStats}
        title="My venue recommendations"
      />
    ) : (
      <DiscoverCreatorPanel
        badge="Events"
        description="Create new ticketed events, pull in requested artists, and open reserved ticket orders once the night is ready to go live."
        title="Venue event creator"
      >
        <VenueEventScheduler
          bookedActs={schedulerActs}
          preferredActId={preferredArtistId}
          promoterOptions={promoterOptions}
          recommendedActs={recommendedActs}
          scheduledEvents={scheduledEvents}
          venueLocation={{
            postalCode: myVenueProfile.postalCode,
            stateRegion: myVenueProfile.stateRegion,
            country: myVenueProfile.country
          }}
          venueProfileId={myVenueProfile.id}
        />
      </DiscoverCreatorPanel>
    );

  return (
    <>
      <div className="site-subnav-shell">
        <nav aria-label="Venue lane modules" className="container site-subnav">
          <span className="site-subnav-label">Venue Lane</span>
          <Link
            className={activeModule === 'my-page' ? 'site-subnav-link active' : 'site-subnav-link'}
            href="/my/venue?module=my-page"
          >
            My Page
          </Link>
          <Link
            className={activeModule === 'recommendation-engine' ? 'site-subnav-link active' : 'site-subnav-link'}
            href="/my/venue?module=recommendation-engine"
          >
            Recommendation Engine
          </Link>
          <Link
            className={activeModule === 'events' ? 'site-subnav-link active' : 'site-subnav-link'}
            href="/my/venue?module=events"
          >
            Events
          </Link>
          <div className="site-subnav-divider" aria-hidden="true" />
          <Link className="site-subnav-link site-subnav-link-utility" href="/venues">
            Venue Discover
          </Link>
        </nav>
      </div>
      <main className="container section">{modulePanel}</main>
    </>
  );
}
