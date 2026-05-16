import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { DEFAULT_PROFILE_DESIGN_PRESET, getProfileDesignStyleVars } from '@/lib/profile-design';
import { ContentReportControl } from '@/components/ContentReportControl';
import { ShowCard } from '@/components/ShowCard';
import { HypeButton } from '@/components/HypeButton';
import { VenueEventScheduler } from '@/components/VenueEventScheduler';
import { VenueConnectionRequestActions } from '@/components/VenueConnectionRequestActions';
import { VenueConnectionRequestForm } from '@/components/VenueConnectionRequestForm';
import { ShareButton } from '@/components/ShareButton';
import { getSafeBackgroundImageStyle, getSafeImageUrl, getSafeVideoUrl } from '@/lib/asset-safety';
import { canManageOwnedResource } from '@/lib/permissions';
import { getDemoCreatorExclusion, getDemoOwnerExclusion, isDemoUser, shouldHideDemoContent } from '@/lib/runtime-flags';

const venueSections = ['about', 'upcoming', 'request'] as const;

type VenueSection = (typeof venueSections)[number];

function getActiveSection(section: string | string[] | undefined): VenueSection {
  if (section === 'previous') {
    return 'upcoming';
  }

  if (section === 'stats') {
    return 'about';
  }

  if (typeof section === 'string' && venueSections.includes(section as VenueSection)) {
    return section as VenueSection;
  }

  return 'about';
}

function getSectionLabel(section: VenueSection) {
  if (section === 'upcoming') return 'Upcoming Shows';
  if (section === 'request') return 'Request Artist';
  return section.charAt(0).toUpperCase() + section.slice(1);
}

function formatRequesterType(value: 'LISTENER' | 'PROMOTER') {
  return value === 'LISTENER' ? 'Fan' : 'Promoter';
}

function formatRequestStatus(value: 'PENDING' | 'BOOKED' | 'DISMISSED') {
  if (value === 'BOOKED') return 'Booked';
  if (value === 'DISMISSED') return 'Dismissed';
  return 'Pending';
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const profile = await db.profile.findUnique({
    where: { slug },
    select: { name: true, headline: true, bio: true, city: true, stateRegion: true, country: true, hypeCount: true, avatarImage: true }
  });

  if (!profile) return { title: 'Venue · iHYPE' };

  const loc    = [profile.city, profile.stateRegion, profile.country].filter(Boolean).join(', ');
  const title  = `${profile.name} · iHYPE`;
  const description = [
    'Venue',
    loc || null,
    profile.hypeCount ? `${profile.hypeCount} HYPE` : null,
    profile.headline || null,
  ].filter(Boolean).join(' · ');
  const image = profile.avatarImage ?? undefined;

  return {
    title,
    description,
    openGraph: {
      type:        'website',
      siteName:    'iHYPE',
      title,
      description,
      url:         `/venues/${slug}`,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card:        'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
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

  const profile = await db.profile.findUnique({
    where: { slug },
    include: {
      owner: {
        select: {
          email: true,
          username: true
        }
      }
    }
  });
  if (!profile || profile.type !== 'VENUE') return notFound();
  if (shouldHideDemoContent() && isDemoUser(profile.owner)) return notFound();
  const profileSlug = profile.slug;
  const isOwner = canManageOwnedResource(session, profile.ownerId);

  const [shows, bookableProfiles, connectionRequests, myRequests, totalRequestCount, fanHypeCount] = await Promise.all([
    db.show.findMany({
      where: {
        venueProfileId: profile.id,
        ...getDemoCreatorExclusion()
      },
      include: { venueProfile: true, headlinerProfile: true },
      orderBy: { startsAt: 'asc' }
    }),
    db.profile.findMany({
      where: {
        type: { in: ['ARTIST', 'DJ'] },
        ...getDemoOwnerExclusion()
      },
      orderBy: [{ verified: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, type: true }
    }),
    isOwner
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
    db.profileHypeEvent.count({
      where: {
        profileId: profile.id,
        user: {
          role: 'FAN'
        }
      }
    })
  ]);

  const now = new Date();
  const upcomingShows = shows.filter((show) => show.status === 'LIVE' || show.startsAt >= now);
  const previousShows = shows.filter((show) => show.status === 'ENDED' || (show.startsAt < now && show.status !== 'LIVE'));
  const totalTicketsSold = shows.reduce((sum, show) => sum + show.ticketsSoldCount, 0);
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
  const canViewCustomPage = isOwner || profile.fanShareEnabled;
  const sharedThemePreset = canViewCustomPage ? profile.themePreset : DEFAULT_PROFILE_DESIGN_PRESET;
  const pageDesignStyle = getProfileDesignStyleVars(sharedThemePreset, {
    accentTone: canViewCustomPage ? profile.themeAccentTone : undefined,
    backdropTone: canViewCustomPage ? profile.themeBackdropTone : undefined,
    fontPreset: canViewCustomPage ? profile.themeFontPreset : undefined
  });
  const bannerStyle = canViewCustomPage ? getSafeBackgroundImageStyle(profile.heroImage) : undefined;
  const logoUrl = canViewCustomPage ? getSafeImageUrl(profile.logoImage || profile.avatarImage) : null;
  const featureImageUrl = canViewCustomPage ? getSafeImageUrl(profile.galleryImage || profile.heroImage) : null;
  const featureVideoUrl = canViewCustomPage ? getSafeVideoUrl(profile.featureVideoUrl) : null;

  return (
    <main className="container section profile-design-shell" style={pageDesignStyle}>
      <header className="artist-banner panel" style={bannerStyle}>
        <div className="profile-banner-row">
          <div className="artist-banner-copy">
            {logoUrl ? <img alt={`${profile.name} logo`} className="artist-logo-mark" src={logoUrl} /> : null}
            <div className="badge">VENUE</div>
            <h1 className="title" style={{ fontSize: '2.9rem' }}>
              {profile.name}
              {profile.verificationStatus === 'VERIFIED' ? (
                <span
                  title="Verified venue"
                  aria-label="Verified"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '1.6rem',
                    height: '1.6rem',
                    borderRadius: '50%',
                    marginLeft: '0.5rem',
                    background: '#1d9bf0',
                    color: '#fff',
                    fontSize: '1rem',
                    verticalAlign: 'middle'
                  }}
                >
                  ✓
                </span>
              ) : null}
            </h1>
            <p className="artist-headline">{profile.headline || 'Set the tone for the room and what kind of nights belong here.'}</p>
            <p className="subtitle">{profile.bio}</p>
            <p className="meta">{[profile.city, profile.country].filter(Boolean).join(', ')}</p>
            <p className="meta">Share ID: <Link href={`/profiles/${profile.hexId}`}>{profile.hexId}</Link></p>
            <p className="meta">Fan hype: {fanHypeCount}</p>
            {profile.addressLine1 ? <p className="meta">{[profile.addressLine1, profile.postalCode].filter(Boolean).join(', ')}</p> : null}
            {profile.contactInfo ? <p className="meta">{profile.contactInfo}</p> : null}
            {profile.hoursText ? <p className="meta">{profile.hoursText}</p> : null}
            <div className="tag-row">{profile.genres.map((genre) => <span key={genre} className="tag">{genre}</span>)}</div>
            <HypeButton targetType="profile" targetId={profile.id} initialCount={profile.hypeCount} entityLabel="venue" />
            <div className="cta-row" style={{ marginTop: 12 }}>
              {profile.contactInfo && profile.contactInfo.includes('@') ? (
                <a className="button" href={`mailto:${profile.contactInfo}?subject=${encodeURIComponent(`Booking inquiry for ${profile.name}`)}`}>
                  Send booking inquiry
                </a>
              ) : (
                <Link className="button" href={`/venues/${profile.slug}?section=request`}>
                  Send booking inquiry
                </Link>
              )}
            </div>
            <div className="profile-public-actions">
              <Link className="button small secondary" href={`/venues/${profile.slug}?section=upcoming`}>See shows</Link>
              <Link className="button small secondary" href={`/venues/${profile.slug}?section=request`}>Request artist</Link>
              <Link className="button small secondary" href="/register?role=VENUE">List a venue</Link>
              <ShareButton path={`/venues/${profile.slug}`} title={profile.name} label="Copy profile link" />
            </div>
          </div>
          {isOwner ? (
            <div className="profile-banner-actions">
              <Link className="button small secondary" href={`/home?profile=${profile.id}`}>
                Edit Page
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      <section className="section">
        <nav className="section-tabs" aria-label="Venue page sections">
          {venueSections.map((section) => (
            <Link
              key={section}
              className={section === activeSection ? 'section-tab active' : 'section-tab'}
              href={`/venues/${profileSlug}?section=${section}`}
            >
              {getSectionLabel(section)}
            </Link>
          ))}
        </nav>

        <div className="panel artist-section-panel">
          {activeSection === 'about' ? (
            <>
              <h2>About</h2>
              {featureImageUrl ? (
                <div className="artist-media-visuals">
                  <img alt={`${profile.name} featured visual`} className="artist-media-visual-image" src={featureImageUrl} />
                </div>
              ) : null}
              {featureVideoUrl ? (
                <div className="artist-media-visuals">
                  <video className="artist-media-visual-video" controls preload="metadata" src={featureVideoUrl} />
                </div>
              ) : null}
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
              <h2>Upcoming Shows</h2>
              {profile.upcomingContent ? <div className="artist-copy">{profile.upcomingContent}</div> : null}
              <div className="grid grid-2">
                {upcomingShows.length ? upcomingShows.map((show) => <ShowCard key={show.id} show={show} />) : <div className="empty">No upcoming shows yet.</div>}
              </div>
            </>
          ) : null}

          {activeSection === 'request' ? (
            <>
              <h2>Request Artist</h2>
              <div className="artist-copy">{profile.requestContent || 'Fans and promoters can recommend artists here and ask to be notified if the booking lands.'}</div>

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
        </div>
      </section>

      <ContentReportControl targetId={profile.id} targetType="profile" />
    </main>
  );
}
