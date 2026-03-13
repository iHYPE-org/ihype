import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { parseArtistMediaContent } from '@/lib/media';
import { ShowCard } from '@/components/ShowCard';
import { HypeButton } from '@/components/HypeButton';
import { ProfilePageEditor } from '@/components/ProfilePageEditor';
import { PromoterShowCreationTool } from '@/components/PromoterShowCreationTool';

const promoterSections = ['about', 'upcoming', 'previous', 'recommend', 'stats'] as const;

type PromoterSection = (typeof promoterSections)[number];

function getActiveSection(section: string | string[] | undefined): PromoterSection {
  if (typeof section === 'string' && promoterSections.includes(section as PromoterSection)) {
    return section as PromoterSection;
  }

  return 'about';
}

function getSectionLabel(section: PromoterSection) {
  return section.charAt(0).toUpperCase() + section.slice(1);
}

function formatRequestStatus(value: 'PENDING' | 'BOOKED' | 'DISMISSED') {
  if (value === 'BOOKED') return 'Booked';
  if (value === 'DISMISSED') return 'Dismissed';
  return 'Pending';
}

function formatShowDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(value);
}

export default async function PromoterPage({
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
  if (!profile || profile.type !== 'DJ') return notFound();
  const isOwner = session?.user?.id === profile.ownerId;

  const [shows, sentRecommendations, artistProfiles] = await Promise.all([
    db.show.findMany({
      where: { promoterProfileId: profile.id },
      include: { venueProfile: true, headlinerProfile: true, promoterProfile: true },
      orderBy: { startsAt: 'asc' }
    }),
    db.venueConnectionRequest.findMany({
      where: { requesterId: profile.ownerId, requesterType: 'PROMOTER' },
      include: { venueProfile: true, artistProfile: true },
      orderBy: { createdAt: 'desc' }
    }),
    isOwner
      ? db.profile.findMany({
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
      : Promise.resolve([])
  ]);

  const now = new Date();
  const upcomingShows = shows.filter((show) => show.status === 'LIVE' || show.startsAt >= now);
  const previousShows = shows.filter((show) => show.status === 'ENDED' || (show.startsAt < now && show.status !== 'LIVE'));
  const recentShows = [...shows].sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime()).slice(0, 6);
  const recentRecommendations = sentRecommendations.slice(0, 6);
  const artistLibraries = artistProfiles
    .map((artistProfile) => ({
      profileId: artistProfile.id,
      slug: artistProfile.slug,
      name: artistProfile.name,
      heroImage: artistProfile.heroImage,
      entries: parseArtistMediaContent(artistProfile.mediaContent).entries
    }))
    .filter((artistProfile) => artistProfile.entries.length > 0);
  const bannerStyle = profile.heroImage
    ? {
        backgroundImage: `linear-gradient(rgba(7, 11, 20, 0.45), rgba(7, 11, 20, 0.88)), url(${profile.heroImage})`
      }
    : undefined;

  return (
    <main className="container section">
      <header className="artist-banner panel" style={bannerStyle}>
        <div className="artist-banner-copy">
          <div className="badge">PROMOTER</div>
          <h1 className="title" style={{ fontSize: '2.9rem' }}>{profile.name}</h1>
          <p className="artist-headline">{profile.headline || 'Set the tone for the nights, talent, and scenes you champion.'}</p>
          <p className="subtitle">{profile.bio}</p>
          <p className="meta">{[profile.city, profile.country].filter(Boolean).join(', ')}</p>
          <p className="meta">Share ID: <Link href={`/profiles/${profile.hexId}`}>{profile.hexId}</Link></p>
          <div className="tag-row">{profile.genres.map((genre) => <span key={genre} className="tag">{genre}</span>)}</div>
          <HypeButton targetType="profile" targetId={profile.id} initialCount={profile.hypeCount} entityLabel="promoter" />
        </div>
      </header>

      {isOwner ? (
        <ProfilePageEditor
          description="Edit your promoter banner plus the About and Recommend sections."
          fields={[
            { key: 'headline', label: 'Headline banner', placeholder: 'How do you want artists and venues to read this page?' },
            { key: 'heroImage', label: 'Banner image URL', kind: 'url', placeholder: 'https://example.com/promoter.jpg' },
            { key: 'bio', label: 'Short intro', kind: 'textarea', rows: 3 },
            { key: 'aboutContent', label: 'About', kind: 'textarea' },
            { key: 'recommendContent', label: 'Recommend', kind: 'textarea' }
          ]}
          initialValues={{
            headline: profile.headline ?? '',
            bio: profile.bio ?? '',
            heroImage: profile.heroImage ?? '',
            aboutContent: profile.aboutContent ?? '',
            journalContent: profile.journalContent ?? '',
            mediaContent: profile.mediaContent ?? '',
            tourContent: profile.tourContent ?? '',
            merchContent: profile.merchContent ?? '',
            requestContent: profile.requestContent ?? '',
            recommendContent: profile.recommendContent ?? '',
            topFiveContent: profile.topFiveContent ?? ''
          }}
          profileId={profile.id}
          profileName={profile.name}
          title="Customize your promoter page"
        />
      ) : null}

      {isOwner ? (
        <section className="section promoter-owner-modules">
          <PromoterShowCreationTool
            artists={artistLibraries}
            initialPromoterProfileId={profile.id}
            promoters={[{ profileId: profile.id, name: profile.name, slug: profile.slug }]}
          />

          <div className="panel promoter-owner-history-panel">
            <div className="promoter-owner-module-head">
              <div className="badge">History</div>
              <h2>Recent promoter activity</h2>
              <p className="meta">Track the latest shows and venue recommendations without burying them inside the page tabs.</p>
            </div>

            <div className="promoter-history-grid">
              <div className="promoter-history-card">
                <div className="promoter-history-card-head">
                  <h3>Shows</h3>
                  <span className="meta">{shows.length} total</span>
                </div>
                {recentShows.length ? (
                  <div className="promoter-history-list">
                    {recentShows.map((show) => (
                      <article className="promoter-history-item" key={show.id}>
                        <div>
                          <strong>{show.title}</strong>
                          <p className="meta">{formatShowDate(show.startsAt)}</p>
                        </div>
                        <span className="tag">{show.status}</span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty">No show history yet.</div>
                )}
              </div>

              <div className="promoter-history-card">
                <div className="promoter-history-card-head">
                  <h3>Recommendations</h3>
                  <span className="meta">{sentRecommendations.length} sent</span>
                </div>
                {recentRecommendations.length ? (
                  <div className="promoter-history-list">
                    {recentRecommendations.map((request) => (
                      <article className="promoter-history-item" key={request.id}>
                        <div>
                          <strong>{request.venueProfile.name}</strong>
                          <p className="meta">{request.artistProfile?.name ?? request.artistName}</p>
                        </div>
                        <span className="tag">{formatRequestStatus(request.status)}</span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty">No recommendation history yet.</div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section">
        <nav className="section-tabs" aria-label="Promoter page sections">
          {promoterSections.map((section) => (
            <Link
              key={section}
              className={section === activeSection ? 'section-tab active' : 'section-tab'}
              href={`/promoters/${profile.slug}?section=${section}`}
            >
              {getSectionLabel(section)}
            </Link>
          ))}
        </nav>

        <div className="panel artist-section-panel">
          {activeSection === 'about' ? (
            <>
              <h2>About</h2>
              <div className="artist-copy">{profile.aboutContent || profile.bio || 'This promoter has not filled out the About section yet.'}</div>
            </>
          ) : null}

          {activeSection === 'upcoming' ? (
            <>
              <h2>Upcoming</h2>
              <div className="grid grid-2">
                {upcomingShows.length ? upcomingShows.map((show) => <ShowCard key={show.id} show={show} />) : <div className="empty">No upcoming shows yet.</div>}
              </div>
            </>
          ) : null}

          {activeSection === 'previous' ? (
            <>
              <h2>Previous</h2>
              <div className="grid grid-2">
                {previousShows.length ? previousShows.map((show) => <ShowCard key={show.id} show={show} />) : <div className="empty">No previous shows yet.</div>}
              </div>
            </>
          ) : null}

          {activeSection === 'recommend' ? (
            <>
              <h2>Recommend</h2>
              <div className="artist-copy">{profile.recommendContent || 'Use this section to explain the rooms, artists, and collaborations you like to champion.'}</div>
            </>
          ) : null}

          {activeSection === 'stats' ? (
            <>
              <h2>Stats</h2>
              <div className="grid grid-3">
                <div className="stat"><strong>{profile.hypeCount}</strong>Page hype</div>
                <div className="stat"><strong>{upcomingShows.length}</strong>Upcoming shows</div>
                <div className="stat"><strong>{previousShows.length}</strong>Previous shows</div>
                <div className="stat"><strong>{sentRecommendations.length}</strong>Recommendations sent</div>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
