import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ShowCard } from '@/components/ShowCard';
import { HypeButton } from '@/components/HypeButton';
import { ProfilePageEditor } from '@/components/ProfilePageEditor';
import { ListenerAvatarCreator } from '@/components/ListenerAvatarCreator';
import { ListenerVenueMap } from '@/components/ListenerVenueMap';
import { getProfileDesignStyleVars } from '@/lib/profile-design';
import { detectRequestLocation } from '@/lib/request-location';

const listenerSections = ['about', 'upcoming', 'previous', 'top5', 'stats'] as const;

type ListenerSection = (typeof listenerSections)[number];

function getActiveSection(section: string | string[] | undefined): ListenerSection {
  if (typeof section === 'string' && listenerSections.includes(section as ListenerSection)) {
    return section as ListenerSection;
  }

  return 'about';
}

function getSectionLabel(section: ListenerSection) {
  if (section === 'top5') return 'Top 5';
  return section.charAt(0).toUpperCase() + section.slice(1);
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default async function ListenerPage({
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
  if (!profile || profile.type !== 'LISTENER') return notFound();

  const [hypedShows, sentRecommendations, viewerLocation, venues] = await Promise.all([
    db.hypeEvent.findMany({
      where: { userId: profile.ownerId },
      include: {
        show: {
          include: {
            venueProfile: true,
            headlinerProfile: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    db.venueConnectionRequest.findMany({
      where: { requesterId: profile.ownerId },
      orderBy: { createdAt: 'desc' }
    }),
    detectRequestLocation(),
    db.profile.findMany({
      where: {
        type: 'VENUE',
        latitude: { not: null },
        longitude: { not: null }
      },
      orderBy: [{ verified: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        addressLine1: true,
        hoursText: true,
        city: true,
        stateRegion: true,
        country: true,
        postalCode: true,
        latitude: true,
        longitude: true
      }
    })
  ]);

  const now = new Date();
  const shows = hypedShows.map((entry) => entry.show);
  const upcomingShows = shows.filter((show) => show.status === 'LIVE' || show.startsAt >= now);
  const previousShows = shows.filter((show) => show.status === 'ENDED' || (show.startsAt < now && show.status !== 'LIVE'));
  const isOwner = session?.user?.id === profile.ownerId;
  const defaultAvatarPrompt = [
    `Cartoon avatar for ${profile.name}.`,
    profile.genres.length ? `Inspired by ${profile.genres.join(', ')}.` : '',
    [profile.city, profile.country].filter(Boolean).join(', ')
      ? `Set the mood around ${[profile.city, profile.country].filter(Boolean).join(', ')}.`
      : '',
    'Expressive, music-obsessed, colorful, and friendly.'
  ]
    .filter(Boolean)
    .join(' ');
  const bannerStyle = profile.heroImage
    ? {
        backgroundImage: `linear-gradient(rgba(7, 11, 20, 0.45), rgba(7, 11, 20, 0.88)), url(${profile.heroImage})`
      }
    : undefined;
  const pageDesignStyle = getProfileDesignStyleVars(profile.themePreset);

  return (
    <main className="container section profile-design-shell" style={pageDesignStyle}>
      <header className="artist-banner panel" style={bannerStyle}>
        <div className="profile-banner-row">
          {profile.avatarImage ? (
            <img alt={`${profile.name} avatar`} className="profile-avatar profile-avatar-hero" src={profile.avatarImage} />
          ) : (
            <div className="profile-avatar profile-avatar-hero profile-avatar-fallback">{getInitials(profile.name)}</div>
          )}
          <div className="artist-banner-copy">
            <div className="badge">LISTENER</div>
            <h1 className="title" style={{ fontSize: '2.9rem' }}>{profile.name}</h1>
            <p className="artist-headline">{profile.headline || 'Capture the shows, artists, and moments you keep coming back to.'}</p>
            <p className="subtitle">{profile.bio}</p>
            <p className="meta">{[profile.city, profile.country].filter(Boolean).join(', ')}</p>
            <p className="meta">Share ID: <Link href={`/profiles/${profile.hexId}`}>{profile.hexId}</Link></p>
            <div className="tag-row">{profile.genres.map((genre) => <span key={genre} className="tag">{genre}</span>)}</div>
            <HypeButton targetType="profile" targetId={profile.id} initialCount={profile.hypeCount} entityLabel="listener page" />
          </div>
        </div>
      </header>

      {isOwner ? (
        <>
          <ListenerAvatarCreator
            defaultPrompt={defaultAvatarPrompt}
            initialAvatarImage={profile.avatarImage}
            profileId={profile.id}
            profileName={profile.name}
          />
          <ProfilePageEditor
            description="Edit your listener banner plus the About and Top 5 sections."
            enableDesignCustomizer
            fields={[
              { key: 'headline', label: 'Headline banner', placeholder: 'How should your page feel?' },
              { key: 'heroImage', label: 'Banner image URL', kind: 'url', placeholder: 'https://example.com/listener.jpg' },
              { key: 'bio', label: 'Short intro', kind: 'textarea', rows: 3 },
              { key: 'aboutContent', label: 'About', kind: 'textarea' },
              { key: 'topFiveContent', label: 'Top 5', kind: 'textarea', rows: 5 }
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
              topFiveContent: profile.topFiveContent ?? '',
              themePreset: profile.themePreset,
              fanShareEnabled: profile.fanShareEnabled
            }}
            previewGenres={profile.genres}
            previewRoleLabel="LISTENER"
            previewTabs={['About', 'Upcoming', 'Previous', 'Top 5', 'Stats']}
            profileId={profile.id}
            profileName={profile.name}
            title="Customize your listener page"
          />
        </>
      ) : null}

      <ListenerVenueMap venues={venues} viewerLocation={viewerLocation} />

      <section className="section">
        <nav className="section-tabs" aria-label="Listener page sections">
          {listenerSections.map((section) => (
            <Link
              key={section}
              className={section === activeSection ? 'section-tab active' : 'section-tab'}
              href={`/listeners/${profile.slug}?section=${section}`}
            >
              {getSectionLabel(section)}
            </Link>
          ))}
        </nav>

        <div className="panel artist-section-panel">
          {activeSection === 'about' ? (
            <>
              <h2>About</h2>
              <div className="artist-copy">{profile.aboutContent || profile.bio || 'This listener has not filled out the About section yet.'}</div>
            </>
          ) : null}

          {activeSection === 'upcoming' ? (
            <>
              <h2>Upcoming</h2>
              <div className="grid grid-2">
                {upcomingShows.length ? upcomingShows.map((show) => <ShowCard key={show.id} show={show} />) : <div className="empty">No upcoming saved shows yet.</div>}
              </div>
            </>
          ) : null}

          {activeSection === 'previous' ? (
            <>
              <h2>Previous</h2>
              <div className="grid grid-2">
                {previousShows.length ? previousShows.map((show) => <ShowCard key={show.id} show={show} />) : <div className="empty">No previous saved shows yet.</div>}
              </div>
            </>
          ) : null}

          {activeSection === 'top5' ? (
            <>
              <h2>Top 5</h2>
              <div className="artist-copy">{profile.topFiveContent || 'No top 5 list yet.'}</div>
            </>
          ) : null}

          {activeSection === 'stats' ? (
            <>
              <h2>Stats</h2>
              <div className="grid grid-3">
                <div className="stat"><strong>{profile.hypeCount}</strong>Page hype</div>
                <div className="stat"><strong>{upcomingShows.length}</strong>Upcoming saved shows</div>
                <div className="stat"><strong>{previousShows.length}</strong>Previous saved shows</div>
                <div className="stat"><strong>{sentRecommendations.length}</strong>Requests sent</div>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
