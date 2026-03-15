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
import { NetworkEarthGlobe } from '@/components/NetworkEarthGlobe';
import { getSafeBackgroundImageStyle, getSafeImageUrl } from '@/lib/asset-safety';
import { canManageOwnedResource } from '@/lib/permissions';
import { DEFAULT_PROFILE_DESIGN_PRESET, getProfileDesignStyleVars } from '@/lib/profile-design';
import { getAdvertisingRecommendations } from '@/lib/market-recommendations';
import { detectRequestLocation } from '@/lib/request-location';

const artistSections = ['about', 'media', 'tour', 'merch'] as const;

type ArtistSection = (typeof artistSections)[number];

function getActiveSection(section: string | string[] | undefined): ArtistSection {
  if (section === 'journal' || section === 'tour') {
    return section === 'tour' ? 'tour' : 'about';
  }

  if (section === 'events') {
    return 'tour';
  }

  if (typeof section === 'string' && artistSections.includes(section as ArtistSection)) {
    return section as ArtistSection;
  }

  return 'about';
}

function getSectionLabel(section: ArtistSection) {
  if (section === 'tour') return 'Tour';
  return section.charAt(0).toUpperCase() + section.slice(1);
}

function formatShowDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(value);
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

  const [shows, viewerLocation, venues] = await Promise.all([
    db.show.findMany({
      where: { headlinerProfileId: profile.id },
      include: { venueProfile: true, headlinerProfile: true },
      orderBy: { startsAt: 'asc' }
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
  const globeRouteStops = shows
    .filter(
      (show) =>
        show.venueProfile?.latitude != null &&
        show.venueProfile.longitude != null
    )
    .map((show) => ({
      id: show.id,
      title: show.title,
      href: `/shows/${show.slug}`,
      venueName: show.venueProfile?.name ?? 'Venue',
      venueSlug: show.venueProfile?.slug ?? null,
      city: show.venueProfile?.city ?? null,
      stateRegion: show.venueProfile?.stateRegion ?? null,
      country: show.venueProfile?.country ?? null,
      postalCode: show.venueProfile?.postalCode ?? null,
      latitude: show.venueProfile?.latitude ?? null,
      longitude: show.venueProfile?.longitude ?? null,
      startsAtLabel: formatShowDate(show.startsAt),
      timing:
        show.status === 'LIVE'
          ? ('live' as const)
          : show.startsAt >= now
            ? ('upcoming' as const)
            : ('past' as const)
    }));

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
            previewTabs={['About', 'Media', 'Tour', 'Merch']}
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

      {isOwner ? <MarketRecommendationsPanel recommendations={recommendations} roleLabel="artist" /> : null}

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

          {activeSection === 'tour' ? (
            <>
              <h2>Tour</h2>
              <div className="artist-copy">{profile.tourContent || 'No tour notes yet.'}</div>

              <NetworkEarthGlobe
                description="Start from the visitor ZIP, highlight nearby venues, then zoom out to trace the artist tour path across current and previous show stops."
                emptyRouteLabel="No tour stops are mapped yet."
                routeLabel="Tour path"
                routeStops={globeRouteStops}
                title="Earth globe for nearby venues and tour paths"
                venues={venues}
                viewerLocation={viewerLocation}
              />

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

          {activeSection === 'merch' ? (
            <>
              <h2>Merch</h2>
              <div className="artist-copy">{profile.merchContent || 'No merch notes yet.'}</div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
