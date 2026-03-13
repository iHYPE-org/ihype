import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getProfileDesignStyleVars } from '@/lib/profile-design';
import { ShowCard } from '@/components/ShowCard';
import { HypeButton } from '@/components/HypeButton';
import { VenuePageWizard } from '@/components/VenuePageWizard';
import { VenueEventScheduler } from '@/components/VenueEventScheduler';
import { VenueConnectionRequestActions } from '@/components/VenueConnectionRequestActions';
import { VenueConnectionRequestForm } from '@/components/VenueConnectionRequestForm';

const venueSections = ['about', 'upcoming', 'previous', 'request', 'stats'] as const;

type VenueSection = (typeof venueSections)[number];

function getActiveSection(section: string | string[] | undefined): VenueSection {
  if (typeof section === 'string' && venueSections.includes(section as VenueSection)) {
    return section as VenueSection;
  }

  return 'about';
}

function getSectionLabel(section: VenueSection) {
  return section.charAt(0).toUpperCase() + section.slice(1);
}

function formatRequesterType(value: 'LISTENER' | 'PROMOTER') {
  return value === 'LISTENER' ? 'Listener' : 'Promoter';
}

function formatRequestStatus(value: 'PENDING' | 'BOOKED' | 'DISMISSED') {
  if (value === 'BOOKED') return 'Booked';
  if (value === 'DISMISSED') return 'Dismissed';
  return 'Pending';
}

export default async function VenuePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ section?: string | string[] }>;
}) {
  const session = await auth();
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeSection = getActiveSection(resolvedSearchParams.section);

  const profile = await db.profile.findUnique({ where: { slug } });
  if (!profile || profile.type !== 'VENUE') return notFound();

  const [shows, bookableProfiles, connectionRequests, myRequests, totalRequestCount, pendingRequestCount] = await Promise.all([
    db.show.findMany({
      where: { venueProfileId: profile.id },
      include: { venueProfile: true, headlinerProfile: true },
      orderBy: { startsAt: 'asc' }
    }),
    db.profile.findMany({
      where: { type: { in: ['ARTIST', 'DJ'] } },
      orderBy: [{ verified: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, type: true }
    }),
    session?.user?.id === profile.ownerId
      ? db.venueConnectionRequest.findMany({
          where: { venueProfileId: profile.id },
          include: { requester: true, artistProfile: true },
          orderBy: { createdAt: 'desc' }
        })
      : Promise.resolve([]),
    session?.user?.id
      ? db.venueConnectionRequest.findMany({
          where: {
            venueProfileId: profile.id,
            requesterId: session.user.id
          },
          include: { artistProfile: true },
          orderBy: { createdAt: 'desc' }
        })
      : Promise.resolve([]),
    db.venueConnectionRequest.count({
      where: { venueProfileId: profile.id }
    }),
    db.venueConnectionRequest.count({
      where: {
        venueProfileId: profile.id,
        status: 'PENDING'
      }
    })
  ]);

  const now = new Date();
  const upcomingShows = shows.filter((show) => show.status === 'LIVE' || show.startsAt >= now);
  const previousShows = shows.filter((show) => show.status === 'ENDED' || (show.startsAt < now && show.status !== 'LIVE'));
  const ticketedShows = shows.filter((show) => show.isTicketed);
  const totalTicketsSold = shows.reduce((sum, show) => sum + show.ticketsSoldCount, 0);
  const isOwner = session?.user?.id === profile.ownerId;
  const bookedActs = Array.from(
    new Map(
      connectionRequests
        .filter((request) => request.status === 'BOOKED' && request.artistProfile)
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
  const promoterOptions = bookableProfiles
    .filter((bookableProfile) => bookableProfile.type === 'DJ')
    .map((bookableProfile) => ({ id: bookableProfile.id, name: bookableProfile.name }));
  const pageDesignStyle = getProfileDesignStyleVars(profile.themePreset, {
    accentTone: profile.themeAccentTone,
    backdropTone: profile.themeBackdropTone
  });
  const bannerStyle = profile.heroImage
    ? {
        backgroundImage: `linear-gradient(rgba(7, 11, 20, 0.45), rgba(7, 11, 20, 0.88)), url(${profile.heroImage})`
      }
    : undefined;

  return (
    <main className="container section profile-design-shell" style={pageDesignStyle}>
      <header className="artist-banner panel" style={bannerStyle}>
        <div className="artist-banner-copy">
          <div className="badge">VENUE</div>
          <h1 className="title" style={{ fontSize: '2.9rem' }}>{profile.name}</h1>
          <p className="artist-headline">{profile.headline || 'Set the tone for the room and what kind of nights belong here.'}</p>
          <p className="subtitle">{profile.bio}</p>
          <p className="meta">{[profile.city, profile.country].filter(Boolean).join(', ')}</p>
          <p className="meta">Share ID: <Link href={`/profiles/${profile.hexId}`}>{profile.hexId}</Link></p>
          {profile.addressLine1 ? <p className="meta">{[profile.addressLine1, profile.postalCode].filter(Boolean).join(', ')}</p> : null}
          {profile.hoursText ? <p className="meta">{profile.hoursText}</p> : null}
          <div className="tag-row">{profile.genres.map((genre) => <span key={genre} className="tag">{genre}</span>)}</div>
          <HypeButton targetType="profile" targetId={profile.id} initialCount={profile.hypeCount} entityLabel="venue" />
        </div>
      </header>

      {isOwner ? (
        <>
          <VenuePageWizard
            initialValues={{
              headline: profile.headline ?? '',
              bio: profile.bio ?? '',
              heroImage: profile.heroImage ?? '',
              aboutContent: profile.aboutContent ?? '',
              requestContent: profile.requestContent ?? '',
              addressLine1: profile.addressLine1 ?? '',
              hoursText: profile.hoursText ?? '',
              city: profile.city ?? '',
              stateRegion: profile.stateRegion ?? '',
              postalCode: profile.postalCode ?? '',
              country: profile.country ?? '',
              parkingDetails: profile.parkingDetails ?? '',
              stayRecommendations: profile.stayRecommendations ?? '',
              upcomingContent: profile.upcomingContent ?? '',
              previousShowHighlights: profile.previousShowHighlights ?? '',
              themePreset: profile.themePreset,
              themeAccentTone: profile.themeAccentTone ?? '',
              themeBackdropTone: profile.themeBackdropTone ?? ''
            }}
            previousShows={previousShows.map((show) => ({
              id: show.id,
              title: show.title,
              startsAt: show.startsAt.toISOString()
            }))}
            profileId={profile.id}
            profileName={profile.name}
            upcomingShows={upcomingShows.map((show) => ({
              id: show.id,
              title: show.title,
              startsAt: show.startsAt.toISOString()
            }))}
          />

          <div className="request-history">
            <VenueEventScheduler
              venueProfileId={profile.id}
              bookedActs={bookedActs}
              promoterOptions={promoterOptions}
            />
          </div>
        </>
      ) : null}

      <section className="section">
        <nav className="section-tabs" aria-label="Venue page sections">
          {venueSections.map((section) => (
            <Link
              key={section}
              className={section === activeSection ? 'section-tab active' : 'section-tab'}
              href={`/venues/${profile.slug}?section=${section}`}
            >
              {getSectionLabel(section)}
            </Link>
          ))}
        </nav>

        <div className="panel artist-section-panel">
          {activeSection === 'about' ? (
            <>
              <h2>About</h2>
              {(profile.addressLine1 || profile.hoursText || profile.parkingDetails || profile.stayRecommendations) ? (
                <div className="grid grid-2">
                  {profile.addressLine1 ? (
                    <div className="stat">
                      <strong>Address</strong>
                      {[
                        profile.addressLine1,
                        profile.city,
                        profile.stateRegion,
                        profile.postalCode
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  ) : null}
                  {profile.hoursText ? (
                    <div className="stat">
                      <strong>Hours</strong>
                      {profile.hoursText}
                    </div>
                  ) : null}
                  {profile.parkingDetails ? (
                    <div className="stat">
                      <strong>Parking</strong>
                      {profile.parkingDetails}
                    </div>
                  ) : null}
                  {profile.stayRecommendations ? (
                    <div className="stat">
                      <strong>Stay nearby</strong>
                      {profile.stayRecommendations}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="artist-copy">{profile.aboutContent || profile.bio || 'This venue has not filled out the About section yet.'}</div>
            </>
          ) : null}

          {activeSection === 'upcoming' ? (
            <>
              <h2>Upcoming</h2>
              {profile.upcomingContent ? <div className="artist-copy">{profile.upcomingContent}</div> : null}
              <div className="grid grid-2">
                {upcomingShows.length ? upcomingShows.map((show) => <ShowCard key={show.id} show={show} />) : <div className="empty">No upcoming shows yet.</div>}
              </div>
            </>
          ) : null}

          {activeSection === 'previous' ? (
            <>
              <h2>Previous</h2>
              {profile.previousShowHighlights ? <div className="artist-copy">{profile.previousShowHighlights}</div> : null}
              <div className="grid grid-2">
                {previousShows.length ? previousShows.map((show) => <ShowCard key={show.id} show={show} />) : <div className="empty">No previous shows yet.</div>}
              </div>
            </>
          ) : null}

          {activeSection === 'request' ? (
            <>
              <h2>Request</h2>
              <div className="artist-copy">{profile.requestContent || 'Listeners and promoters can recommend artists here and ask to be notified if the booking lands.'}</div>

              <div className="request-history">
                {session?.user ? (
                  <>
                    <VenueConnectionRequestForm venueProfileId={profile.id} bookableProfiles={bookableProfiles} />
                    <div className="request-history">
                      <h3>Your requests</h3>
                      {myRequests.length ? (
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Artist</th>
                              <th>Status</th>
                              <th>Notify</th>
                            </tr>
                          </thead>
                          <tbody>
                            {myRequests.map((request) => (
                              <tr key={request.id}>
                                <td>{request.artistProfile?.name ?? request.artistName}</td>
                                <td>{formatRequestStatus(request.status)}</td>
                                <td>{request.notifyOnBooking ? 'Yes' : 'No'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="empty">You have not sent any requests to this venue yet.</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="empty">Log in to recommend booking an artist for this venue.</div>
                )}
              </div>

              {isOwner ? (
                <div className="request-history">
                  <h3>Incoming requests</h3>
                  {connectionRequests.length ? (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Recommended act</th>
                          <th>From</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th>Notify</th>
                          <th>Note</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {connectionRequests.map((request) => (
                          <tr key={request.id}>
                            <td>{request.artistProfile?.name ?? request.artistName}</td>
                            <td>{request.requester.email}</td>
                            <td>{formatRequesterType(request.requesterType)}</td>
                            <td>{formatRequestStatus(request.status)}</td>
                            <td>{request.notifyOnBooking ? 'Yes' : 'No'}</td>
                            <td>{request.note ?? 'No note provided'}</td>
                            <td><VenueConnectionRequestActions requestId={request.id} currentStatus={request.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty">No one has sent a request yet.</div>
                  )}
                </div>
              ) : null}

            </>
          ) : null}

          {activeSection === 'stats' ? (
            <>
              <h2>Stats</h2>
              <div className="grid grid-3">
                <div className="stat"><strong>{profile.hypeCount}</strong>Page hype</div>
                <div className="stat"><strong>{upcomingShows.length}</strong>Upcoming shows</div>
                <div className="stat"><strong>{previousShows.length}</strong>Previous shows</div>
                <div className="stat"><strong>{ticketedShows.length}</strong>Ticketed shows</div>
                <div className="stat"><strong>{totalTicketsSold}</strong>Tickets sold</div>
                <div className="stat"><strong>{totalRequestCount}</strong>Incoming requests</div>
                <div className="stat"><strong>{pendingRequestCount}</strong>Pending requests</div>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
