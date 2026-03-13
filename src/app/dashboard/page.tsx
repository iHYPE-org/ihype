import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ProfileType } from '@prisma/client';
import { PromoterShowCreationTool } from '@/components/PromoterShowCreationTool';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { shortenHexId } from '@/lib/hex-id';
import { parseArtistMediaContent } from '@/lib/media';
import { formatCurrencyFromCents } from '@/lib/ticketing';

function formatRequesterType(value: 'LISTENER' | 'PROMOTER') {
  return value === 'LISTENER' ? 'Listener' : 'Promoter';
}

function formatRequestStatus(value: 'PENDING' | 'BOOKED' | 'DISMISSED') {
  if (value === 'BOOKED') return 'Booked';
  if (value === 'DISMISSED') return 'Dismissed';
  return 'Pending';
}

function getProfilePath(type: ProfileType, slug: string) {
  if (type === 'DJ') return `/promoters/${slug}`;
  if (type === 'VENUE') return `/venues/${slug}`;
  if (type === 'LISTENER') return `/listeners/${slug}`;
  return `/artists/${slug}`;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getMemberYear(date: Date) {
  return new Intl.DateTimeFormat('en-US', { year: 'numeric' }).format(date);
}

function parseTopFiveItems(value: string | null, fallbackArtists: string[]) {
  const savedItems = (value ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\d+[\).\s-]*/, '').trim())
    .filter(Boolean);

  if (savedItems.length) {
    return savedItems.slice(0, 5);
  }

  return fallbackArtists.slice(0, 5);
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const sessionEmail = session.user.email?.toLowerCase() ?? '';

  const [
    profiles,
    shows,
    venueConnectionRequests,
    sentRecommendations,
    songsListenedCount,
    showHypePointsGiven,
    profileHypePointsGiven,
    ticketOrders,
    recentMediaListens
  ] = await Promise.all([
    db.profile.findMany({ where: { ownerId: session.user.id }, orderBy: { createdAt: 'desc' } }),
    db.show.findMany({ where: { creatorId: session.user.id }, orderBy: { createdAt: 'desc' } }),
    db.venueConnectionRequest.findMany({
      where: { venueProfile: { ownerId: session.user.id } },
      include: { venueProfile: true, requester: true, artistProfile: true },
      orderBy: { createdAt: 'desc' }
    }),
    db.venueConnectionRequest.findMany({
      where: { requesterId: session.user.id },
      include: { venueProfile: true, artistProfile: true },
      orderBy: { createdAt: 'desc' }
    }),
    db.mediaListen.count({ where: { userId: session.user.id } }),
    db.hypeEvent.count({ where: { userId: session.user.id } }),
    db.profileHypeEvent.count({ where: { userId: session.user.id } }),
    sessionEmail
      ? db.ticketOrder.findMany({
          where: { buyerEmail: sessionEmail },
          select: {
            showId: true,
            show: {
              select: {
                venueProfileId: true
              }
            }
          }
        })
      : Promise.resolve([]),
    db.mediaListen.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 8
    })
  ]);

  const attendedShowIds = new Set(ticketOrders.map((order) => order.showId));
  const visitedVenueIds = new Set(
    ticketOrders.map((order) => order.show.venueProfileId).filter((venueProfileId): venueProfileId is string => Boolean(venueProfileId))
  );
  const listenerProfile = profiles.find((profile) => profile.type === 'LISTENER') ?? null;
  const hasAdvancedDashboard = profiles.some((profile) => profile.type !== 'LISTENER');
  const isListenerOnlyDashboard = Boolean(listenerProfile) && !hasAdvancedDashboard;
  const promoterProfiles = profiles.filter((profile) => profile.type === 'DJ');
  const artistProfiles = promoterProfiles.length
    ? await db.profile.findMany({
        where: {
          type: 'ARTIST',
          mediaContent: { not: null }
        },
        select: {
          id: true,
          slug: true,
          name: true,
          heroImage: true,
          mediaContent: true
        },
        orderBy: { name: 'asc' }
      })
    : [];
  const artistLibraries = artistProfiles
    .map((artistProfile) => ({
      profileId: artistProfile.id,
      slug: artistProfile.slug,
      name: artistProfile.name,
      heroImage: artistProfile.heroImage,
      entries: parseArtistMediaContent(artistProfile.mediaContent).entries
    }))
    .filter((artistProfile) => artistProfile.entries.length > 0);
  const dashboardStats = [
    { label: 'Songs listened to', value: songsListenedCount },
    { label: 'Hype points given', value: showHypePointsGiven + profileHypePointsGiven },
    { label: 'Shows attended', value: attendedShowIds.size },
    { label: 'Venues visited', value: visitedVenueIds.size },
    { label: 'Recommendations made', value: sentRecommendations.length }
  ];
  const recentPlaylist = recentMediaListens.map((listen, index) => ({
    ...listen,
    order: index + 1
  }));
  const fallbackTopFiveArtists = Array.from(
    new Set(recentMediaListens.map((listen) => listen.artistName).filter(Boolean))
  );
  const listenerTopFive = listenerProfile
    ? parseTopFiveItems(listenerProfile.topFiveContent, fallbackTopFiveArtists)
    : [];

  if (isListenerOnlyDashboard && listenerProfile) {
    return (
      <main className="container section listener-dashboard-page">
        <section className="listener-dashboard-shell">
          <div className="listener-dashboard-layout">
            <div className="listener-dashboard-column listener-dashboard-column-left">
              <article className="panel listener-dashboard-profile-panel">
                <div className="listener-dashboard-module-head">
                  <h3>Profile</h3>
                  <Link className="button small secondary" href={`/listeners/${listenerProfile.slug}`}>
                    Edit profile
                  </Link>
                </div>

                <div className="listener-dashboard-profile-body">
                  {listenerProfile.avatarImage ? (
                    <img
                      alt={`${listenerProfile.name} avatar`}
                      className="profile-avatar profile-avatar-large"
                      src={listenerProfile.avatarImage}
                    />
                  ) : (
                    <div className="profile-avatar profile-avatar-large profile-avatar-fallback">
                      {getInitials(listenerProfile.name)}
                    </div>
                  )}

                  <div className="listener-dashboard-profile-copy">
                    <h2>{listenerProfile.name}</h2>
                    <p className="listener-dashboard-hero-meta">Member since {getMemberYear(listenerProfile.createdAt)}</p>
                    <p className="listener-dashboard-hero-meta">
                      Share ID:{' '}
                      <Link href={`/profiles/${listenerProfile.hexId}`}>
                        {shortenHexId(listenerProfile.hexId)}
                      </Link>
                    </p>
                    <p className="subtitle">
                      {listenerProfile.headline || listenerProfile.bio || 'Shape your listener page, save your soundtrack, and keep your favorite rooms close.'}
                    </p>
                  </div>
                </div>
              </article>

              <section className="panel listener-dashboard-playlist">
                <div className="listener-dashboard-module-head">
                  <h3>Playlist</h3>
                  <span className="meta">{recentPlaylist.length ? `${recentPlaylist.length} recent` : 'Nothing queued yet'}</span>
                </div>

                {recentPlaylist.length ? (
                  <div className="listener-dashboard-playlist-list">
                    {recentPlaylist.map((listen) => (
                      <article className="listener-dashboard-track" key={listen.id}>
                        <span className="listener-dashboard-track-order">{listen.order.toString().padStart(2, '0')}</span>
                        <div>
                          <strong>{listen.title}</strong>
                          <p className="meta">
                            {listen.artistProfileSlug ? (
                              <Link href={`/artists/${listen.artistProfileSlug}`}>{listen.artistName}</Link>
                            ) : (
                              listen.artistName
                            )}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty">Your recent listens will start building a dashboard playlist here.</div>
                )}
              </section>
            </div>

            <div className="listener-dashboard-column listener-dashboard-column-right">
              <section className="panel listener-dashboard-topfive-panel">
                <div className="listener-dashboard-module-head">
                  <h3>Top 5</h3>
                </div>

                {listenerTopFive.length ? (
                  <div className="listener-dashboard-topfive-grid">
                    {listenerTopFive.map((item, index) => (
                      <div
                        className={index === 0 ? 'listener-dashboard-topfive-pill featured' : 'listener-dashboard-topfive-pill'}
                        key={item}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty">Add a top five list on your listener page to pin favorites here.</div>
                )}
              </section>

              <section className="panel listener-dashboard-stats-panel">
                <div className="listener-dashboard-module-head">
                  <h3>Stats</h3>
                </div>

                <div className="listener-dashboard-stat-lines">
                  {dashboardStats.map((stat) => (
                    <div className="listener-dashboard-stat-line" key={stat.label}>
                      <span>{stat.label}</span>
                      <strong>{stat.value}</strong>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="container section">
      <div className="panel" style={{ padding: '1.5rem' }}>
        <h1>{listenerProfile ? 'Listener dashboard' : 'Dashboard'}</h1>
        <p className="kicker">
          {listenerProfile
            ? 'Keep your profile, playlist, stats, and top five in one fast listener workspace.'
            : 'Manage accounts, shows, hype, and venue connection requests without pretending spreadsheets are a product strategy.'}
        </p>
      </div>

      {listenerProfile ? (
        <section className="section listener-dashboard-shell">
          <article className="panel listener-dashboard-hero">
            <div className="listener-dashboard-hero-main">
              {listenerProfile.avatarImage ? (
                <img
                  alt={`${listenerProfile.name} avatar`}
                  className="profile-avatar profile-avatar-large"
                  src={listenerProfile.avatarImage}
                />
              ) : (
                <div className="profile-avatar profile-avatar-large profile-avatar-fallback">
                  {getInitials(listenerProfile.name)}
                </div>
              )}

              <div className="listener-dashboard-hero-copy">
                <div className="badge">LISTENER</div>
                <h2>{listenerProfile.name}</h2>
                <p className="listener-dashboard-hero-meta">Member since {getMemberYear(listenerProfile.createdAt)}</p>
                <p className="listener-dashboard-hero-meta">
                  Share ID:{' '}
                  <Link href={`/profiles/${listenerProfile.hexId}`}>
                    {shortenHexId(listenerProfile.hexId)}
                  </Link>
                </p>
                <p className="subtitle">
                  {listenerProfile.headline || listenerProfile.bio || 'Shape your listener page, save your soundtrack, and keep your favorite rooms close.'}
                </p>
              </div>
            </div>

            <Link className="button small secondary listener-dashboard-edit" href={`/listeners/${listenerProfile.slug}`}>
              Edit profile
            </Link>
          </article>

          <div className="listener-dashboard-grid">
            <section className="panel listener-dashboard-playlist">
              <div className="listener-dashboard-module-head">
                <h3>Playlist</h3>
                <span className="meta">{recentPlaylist.length ? `${recentPlaylist.length} recent` : 'Nothing queued yet'}</span>
              </div>

              {recentPlaylist.length ? (
                <div className="listener-dashboard-playlist-list">
                  {recentPlaylist.map((listen) => (
                    <article className="listener-dashboard-track" key={listen.id}>
                      <span className="listener-dashboard-track-order">{listen.order.toString().padStart(2, '0')}</span>
                      <div>
                        <strong>{listen.title}</strong>
                        <p className="meta">
                          {listen.artistProfileSlug ? (
                            <Link href={`/artists/${listen.artistProfileSlug}`}>{listen.artistName}</Link>
                          ) : (
                            listen.artistName
                          )}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">Your recent listens will start building a dashboard playlist here.</div>
              )}
            </section>

            <div className="listener-dashboard-side">
              <section className="panel listener-dashboard-stats-panel">
                <div className="listener-dashboard-module-head">
                  <h3>Stats</h3>
                </div>

                <div className="listener-dashboard-stat-lines">
                  <div className="listener-dashboard-stat-line">
                    <span># of hype given</span>
                    <strong>{showHypePointsGiven + profileHypePointsGiven}</strong>
                  </div>
                  <div className="listener-dashboard-stat-line">
                    <span># songs listened to</span>
                    <strong>{songsListenedCount}</strong>
                  </div>
                  <div className="listener-dashboard-stat-line">
                    <span># shows attended</span>
                    <strong>{attendedShowIds.size}</strong>
                  </div>
                </div>

                <div className="listener-dashboard-stat-foot">
                  <span>Venues visited {visitedVenueIds.size}</span>
                  <span>Recommendations {sentRecommendations.length}</span>
                </div>
              </section>

              <section className="panel listener-dashboard-topfive-panel">
                <div className="listener-dashboard-module-head">
                  <h3>Top 5</h3>
                </div>

                {listenerTopFive.length ? (
                  <div className="listener-dashboard-topfive-grid">
                    {listenerTopFive.map((item, index) => (
                      <div
                        className={index === 0 ? 'listener-dashboard-topfive-pill featured' : 'listener-dashboard-topfive-pill'}
                        key={item}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty">Add a top five list on your listener page to pin favorites here.</div>
                )}
              </section>
            </div>
          </div>
        </section>
      ) : (
        <section className="section">
          <div className="dashboard-stat-grid">
            {dashboardStats.map((stat) => (
              <article className="panel dashboard-stat-card" key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </article>
            ))}
          </div>
        </section>
      )}

      {promoterProfiles.length ? (
        <section className="section">
          <PromoterShowCreationTool
            artists={artistLibraries}
            initialPromoterProfileId={promoterProfiles[0]?.id}
            promoters={promoterProfiles.map((profile) => ({
              profileId: profile.id,
              name: profile.name,
              slug: profile.slug
            }))}
            surface="dashboard"
          />
        </section>
      ) : null}

      <section className={hasAdvancedDashboard || shows.length ? 'section grid grid-2' : 'section'}>
        <div className="panel" style={{ padding: '1.5rem' }}>
          <h2>Your profiles</h2>
          {profiles.length ? (
            <table className="table">
              <thead><tr><th>Name</th><th>Type</th><th>Hex ID</th><th>Slug</th><th>Hype</th><th>Page</th></tr></thead>
              <tbody>{profiles.map((profile) => <tr key={profile.id}><td>{profile.name}</td><td>{profile.type}</td><td><Link href={`/profiles/${profile.hexId}`}>{profile.hexId}</Link></td><td>{profile.slug}</td><td>{profile.hypeCount}</td><td><Link href={getProfilePath(profile.type, profile.slug)}>Open page</Link></td></tr>)}</tbody>
            </table>
          ) : <div className="empty">Create creator and venue profiles with Prisma or extend the dashboard form.</div>}
        </div>

        {hasAdvancedDashboard || shows.length ? (
          <div className="panel" style={{ padding: '1.5rem' }}>
            <h2>Your shows</h2>
            {shows.length ? (
              <table className="table">
                <thead><tr><th>Title</th><th>Status</th><th>Ticketing</th><th>Sold</th><th>Gross</th><th>Hype</th></tr></thead>
                <tbody>{shows.map((show) => <tr key={show.id}><td>{show.title}</td><td>{show.status}</td><td>{show.isTicketed ? formatCurrencyFromCents(show.ticketPriceCents) : 'Off'}</td><td>{show.ticketsSoldCount}</td><td>{show.isTicketed ? formatCurrencyFromCents(show.ticketPriceCents * show.ticketsSoldCount) : 'n/a'}</td><td>{show.hypeCount}</td></tr>)}</tbody>
              </table>
            ) : <div className="empty">No shows yet. Use the API route or build out this form to create them.</div>}
          </div>
        ) : null}
      </section>

      {venueConnectionRequests.length || hasAdvancedDashboard ? (
        <section className="section">
          <div className="panel" style={{ padding: '1.5rem' }}>
            <h2>Venue connection requests</h2>
            {venueConnectionRequests.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Venue</th>
                    <th>Recommended act</th>
                    <th>From</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Notify</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {venueConnectionRequests.map((request) => (
                    <tr key={request.id}>
                      <td>{request.venueProfile.name}</td>
                      <td>{request.artistProfile?.name ?? request.artistName}</td>
                      <td>{request.requester.email}</td>
                      <td>{formatRequesterType(request.requesterType)}</td>
                      <td>{formatRequestStatus(request.status)}</td>
                      <td>{request.notifyOnBooking ? 'Yes' : 'No'}</td>
                      <td>{request.note ?? 'No note provided'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">No one has sent venue connection requests yet.</div>
            )}
          </div>
        </section>
      ) : null}

      {sentRecommendations.length || hasAdvancedDashboard ? (
        <section className="section">
          <div className="panel" style={{ padding: '1.5rem' }}>
            <h2>Recommendations you sent</h2>
            {sentRecommendations.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Venue</th>
                    <th>Recommended act</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Notify</th>
                  </tr>
                </thead>
                <tbody>
                  {sentRecommendations.map((request) => (
                    <tr key={request.id}>
                      <td>{request.venueProfile.name}</td>
                      <td>{request.artistProfile?.name ?? request.artistName}</td>
                      <td>{formatRequesterType(request.requesterType)}</td>
                      <td>{formatRequestStatus(request.status)}</td>
                      <td>{request.notifyOnBooking ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">You have not sent any venue recommendations yet.</div>
            )}
          </div>
        </section>
      ) : null}

      {hasAdvancedDashboard ? (
        <section className="section grid grid-2">
          <div className="panel" style={{ padding: '1.5rem' }}>
            <h2>Create a show</h2>
            <p className="kicker">Venue owners can now schedule ticketed shows from their venue page request section. The API also accepts ticketing fields and fixed promoter-pool splits.</p>
          </div>
          <div className="panel" style={{ padding: '1.5rem' }}>
            <h2>Create live stream infrastructure</h2>
            <p className="kicker">POST to <code>/api/live</code> with a showId to create a Mux live stream and store the playback ID.</p>
          </div>
        </section>
      ) : null}
    </main>
  );
}
