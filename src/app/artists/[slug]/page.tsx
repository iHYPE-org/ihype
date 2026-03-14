import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildArtistMediaCollection } from '@/lib/media';
import { ShowCard } from '@/components/ShowCard';
import { HypeButton } from '@/components/HypeButton';
import { ProfilePageEditor } from '@/components/ProfilePageEditor';
import { ArtistMediaPlaylist } from '@/components/ArtistMediaPlaylist';
import { ArtistMediaUploadManager } from '@/components/ArtistMediaUploadManager';
import { OwnershipVerificationPanel } from '@/components/OwnershipVerificationPanel';
import { MarketRecommendationsPanel } from '@/components/MarketRecommendationsPanel';
import { getSafeBackgroundImageStyle, getSafeImageUrl } from '@/lib/asset-safety';
import { canManageOwnedResource } from '@/lib/permissions';
import { DEFAULT_PROFILE_DESIGN_PRESET, getProfileDesignStyleVars } from '@/lib/profile-design';
import { getAdvertisingRecommendations } from '@/lib/market-recommendations';

const artistSections = ['media', 'events', 'about', 'merch', 'stats'] as const;

type ArtistSection = (typeof artistSections)[number];

function getActiveSection(section: string | string[] | undefined): ArtistSection {
  if (section === 'journal' || section === 'tour') {
    return section === 'tour' ? 'events' : 'about';
  }

  if (typeof section === 'string' && artistSections.includes(section as ArtistSection)) {
    return section as ArtistSection;
  }

  return 'media';
}

function getSectionLabel(section: ArtistSection) {
  return section.charAt(0).toUpperCase() + section.slice(1);
}

export default async function ArtistPage({
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
    }
  });
  if (!profile || profile.type !== 'ARTIST') return notFound();
  const media = buildArtistMediaCollection(profile.mediaContent, profile.mediaUploads);

  const shows = await db.show.findMany({
    where: { headlinerProfileId: profile.id },
    include: { venueProfile: true, headlinerProfile: true },
    orderBy: { startsAt: 'asc' }
  });

  const now = new Date();
  const upcomingShows = shows.filter((show) => show.status === 'LIVE' || show.startsAt >= now);
  const previousShows = shows.filter((show) => show.status === 'ENDED' || (show.startsAt < now && show.status !== 'LIVE'));
  const recommendations = await getAdvertisingRecommendations({
    profile: {
      type: 'ARTIST',
      city: profile.city,
      country: profile.country
    },
    stats: {
      pageHype: profile.hypeCount,
      upcomingCount: upcomingShows.length,
      previousCount: previousShows.length,
      songUploads: profile.songUploadCount
    }
  });
  const isOwner = canManageOwnedResource(session, profile.ownerId);
  const sharedThemePreset = isOwner || profile.fanShareEnabled ? profile.themePreset : DEFAULT_PROFILE_DESIGN_PRESET;
  const bannerStyle = getSafeBackgroundImageStyle(profile.heroImage);
  const pageDesignStyle = getProfileDesignStyleVars(sharedThemePreset, {
    accentTone: isOwner || profile.fanShareEnabled ? profile.themeAccentTone : undefined,
    backdropTone: isOwner || profile.fanShareEnabled ? profile.themeBackdropTone : undefined
  });
  const artworkUrl = getSafeImageUrl(profile.heroImage);

  return (
    <main className="container section profile-design-shell" style={pageDesignStyle}>
      <header className="artist-banner panel" style={bannerStyle}>
        <div className="artist-banner-copy">
          <div className="badge">ARTIST</div>
          <h1 className="title" style={{ fontSize: '2.9rem' }}>{profile.name}</h1>
          <p className="artist-headline">{profile.headline || 'Build your headline banner and tell people what this chapter sounds like.'}</p>
          <p className="subtitle">{profile.bio}</p>
          <p className="meta">{[profile.city, profile.country].filter(Boolean).join(', ')}</p>
          <p className="meta">Share ID: <Link href={`/profiles/${profile.hexId}`}>{profile.hexId}</Link></p>
          <div className="tag-row">{profile.genres.map((genre) => <span key={genre} className="tag">{genre}</span>)}</div>
          <HypeButton targetType="profile" targetId={profile.id} initialCount={profile.hypeCount} entityLabel="artist" />
        </div>
      </header>

      {isOwner ? (
        <>
          <OwnershipVerificationPanel
            contactInfo={profile.contactInfo}
            profileId={profile.id}
            roleLabel="artist"
            verificationNotes={profile.verificationNotes}
            verificationStatus={profile.verificationStatus}
          />

          <ProfilePageEditor
            allowFanShareToggle
            description="Edit your banner, section copy, and the fan-facing design preset before you share it."
            enableDesignCustomizer
            fields={[
              { key: 'headline', label: 'Headline banner', placeholder: 'The line people see first' },
              { key: 'heroImage', label: 'Banner image URL', kind: 'url', placeholder: 'https://example.com/banner.jpg' },
              { key: 'contactInfo', label: 'Contact info', placeholder: 'manager@artist.com | +1 555 101 3030' },
              { key: 'hometown', label: 'Hometown', placeholder: 'Chicago, IL' },
              { key: 'bio', label: 'Short intro', kind: 'textarea', rows: 3 },
              { key: 'aboutContent', label: 'About', kind: 'textarea' },
              { key: 'journalContent', label: 'Journal', kind: 'textarea' },
              {
                key: 'mediaContent',
                label: 'Media notes / legacy links',
                kind: 'textarea',
                placeholder:
                  'Optional notes for your media section, plus any legacy external links you still want to keep.\nMidnight Demo | https://example.com/demo.mp3 | Live room mix'
              },
              { key: 'tourContent', label: 'Tour intro', kind: 'textarea', rows: 4 },
              { key: 'merchContent', label: 'Merch', kind: 'textarea' }
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
              themeAccentTone: profile.themeAccentTone ?? '',
              themeBackdropTone: profile.themeBackdropTone ?? '',
              fanShareEnabled: profile.fanShareEnabled
            }}
            previewGenres={profile.genres}
              previewRoleLabel="ARTIST"
            previewTabs={['Media', 'Events', 'About', 'Merch', 'Stats']}
            profileId={profile.id}
            profileName={profile.name}
            title="Customize your artist page"
          />

          <div className="panel profile-share-status-panel">
            <div className="badge">Fan Share</div>
            <h2>{profile.fanShareEnabled ? 'Fans can see your custom page design.' : 'Your custom page design is still private.'}</h2>
            <p className="meta">
              {profile.fanShareEnabled
                ? 'Fans who visit this page now see the saved preset, layout mood, and visual styling you picked.'
                : 'Turn on "share with fans" in the customizer when you want fans to see the saved design instead of the default artist look.'}
            </p>
          </div>
        </>
      ) : null}

      <MarketRecommendationsPanel recommendations={recommendations} roleLabel="artist" />

      <section className="section">
        <nav className="section-tabs" aria-label="Artist page sections">
          {artistSections.map((section) => (
            <Link
              key={section}
              className={section === activeSection ? 'section-tab active' : 'section-tab'}
              href={`/artists/${profile.slug}?section=${section}`}
            >
              {getSectionLabel(section)}
            </Link>
          ))}
        </nav>

        <div className="panel artist-section-panel">
          {activeSection === 'media' ? (
            <>
              <h2>Media</h2>
              {media.notes ? <div className="artist-copy">{media.notes}</div> : null}
              {isOwner ? <ArtistMediaUploadManager profileId={profile.id} /> : null}
              {media.entries.length ? (
                <ArtistMediaPlaylist
                  artistName={profile.name}
                  artistSlug={profile.slug}
                  artworkUrl={artworkUrl}
                  entries={media.entries}
                  isOwner={isOwner}
                />
              ) : (
                <div className="empty">
                  No playable uploads yet. Artists can upload audio below or keep using legacy external links in the editor:
                  <br />
                  <code>Track title | https://example.com/song.mp3 | Notes</code>
                </div>
              )}
            </>
          ) : null}

          {activeSection === 'events' ? (
            <>
              <h2>Events</h2>
              <div className="artist-copy">{profile.tourContent || 'No tour notes yet.'}</div>

              <div className="artist-tour-shows">
                <h3>Upcoming</h3>
                <div className="grid grid-2">
                  {upcomingShows.length ? upcomingShows.map((show) => <ShowCard key={show.id} show={show} />) : <div className="empty">No upcoming dates yet.</div>}
                </div>
              </div>

              <div className="artist-tour-shows">
                <h3>Previous</h3>
                <div className="grid grid-2">
                  {previousShows.length ? previousShows.map((show) => <ShowCard key={show.id} show={show} />) : <div className="empty">No previous dates yet.</div>}
                </div>
              </div>
            </>
          ) : null}

          {activeSection === 'about' ? (
            <>
              <h2>About</h2>
              <div className="artist-copy">
                {profile.aboutContent || profile.bio || 'This artist has not filled out the About section yet.'}
              </div>
              {profile.journalContent ? (
                <div className="artist-copy">
                  <strong>Journal</strong>
                  <br />
                  {profile.journalContent}
                </div>
              ) : null}
            </>
          ) : null}

          {activeSection === 'merch' ? (
            <>
              <h2>Merch</h2>
              <div className="artist-copy">{profile.merchContent || 'No merch notes yet.'}</div>
            </>
          ) : null}

          {activeSection === 'stats' ? (
            <>
              <h2>Stats</h2>
              <div className="grid grid-3">
                <div className="stat"><strong>{profile.hypeCount}</strong>Page hype</div>
                <div className="stat"><strong>{upcomingShows.length}</strong>Upcoming dates</div>
                <div className="stat"><strong>{previousShows.length}</strong>Previous dates</div>
                <div className="stat"><strong>{profile.songUploadCount}</strong>Uploaded tracks</div>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
