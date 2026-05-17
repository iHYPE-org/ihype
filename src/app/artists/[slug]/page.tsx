import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildArtistMediaCollection } from '@/lib/media';
import { ShowCard } from '@/components/ShowCard';
import { HypeButton } from '@/components/HypeButton';
import { ArtistMediaPlaylist } from '@/components/ArtistMediaPlaylist';
import { ContentReportControl } from '@/components/ContentReportControl';
import { ShareButton } from '@/components/ShareButton';
import { FollowButton } from '@/components/FollowButton';
import { PeopleAlsoHype } from '@/components/PeopleAlsoHype';
import { ProfileLinkShelf } from '@/components/ProfileLinkShelf';
import { ReportButton } from '@/components/ReportButton';
import { CollapsibleText } from '@/components/CollapsibleText';
import { NetworkEarthGlobe } from '@/components/NetworkEarthGlobe';
import { getSafeBackgroundImageStyle, getSafeImageUrl, getSafeVideoUrl } from '@/lib/asset-safety';
import { canManageOwnedResource } from '@/lib/permissions';
import { DEFAULT_PROFILE_DESIGN_PRESET, getProfileDesignStyleVars } from '@/lib/profile-design';
import { detectRequestLocation } from '@/lib/request-location';
import { AdBanner } from '@/components/AdBanner';
import { AvailabilityCalendar } from '@/components/AvailabilityCalendar';
import { getDemoCreatorExclusion, getDemoOwnerExclusion, isDemoUser, shouldHideDemoContent } from '@/lib/runtime-flags';
import { SoundsLike } from '@/components/SoundsLike';
import { StreamingLinks } from '@/components/StreamingLinks';

const artistSections = ['about', 'media', 'merch'] as const;

type ArtistSection = (typeof artistSections)[number];

function getActiveSection(section: string | string[] | undefined): ArtistSection {
  // Map legacy tour/events/journal params to about
  if (section === 'tour' || section === 'events' || section === 'journal') {
    return 'about';
  }

  if (typeof section === 'string' && artistSections.includes(section as ArtistSection)) {
    return section as ArtistSection;
  }

  return 'about';
}

function getSectionLabel(section: ArtistSection) {
  return section.charAt(0).toUpperCase() + section.slice(1);
}

function formatShowDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(value);
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const profile = await db.profile.findUnique({
    where: { slug },
    select: {
      name: true,
      headline: true,
      genres: true,
      city: true,
      stateRegion: true,
      hypeCount: true,
      avatarImage: true,
      owner: { select: { email: true, username: true } }
    }
  });

  if (!profile || (shouldHideDemoContent() && isDemoUser(profile.owner))) {
    return { title: 'Artist | iHYPE' };
  }

  const location = [profile.city, profile.stateRegion].filter(Boolean).join(', ');
  const genres = profile.genres.slice(0, 3).join(', ');
  const title = `${profile.name} | iHYPE`;
  const description = [
    'Artist',
    genres || null,
    location || null,
    profile.hypeCount ? `${profile.hypeCount} HYPE` : null,
    profile.headline || null
  ]
    .filter(Boolean)
    .join(' | ');

  return {
    title,
    description,
    openGraph: {
      type: 'profile',
      siteName: 'iHYPE',
      title,
      description,
      url: `/artists/${slug}`,
      ...(profile.avatarImage ? { images: [{ url: profile.avatarImage }] } : {})
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(profile.avatarImage ? { images: [profile.avatarImage] } : {})
    }
  };
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
      owner: {
        select: {
          email: true,
          username: true
        }
      },
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
  if (shouldHideDemoContent() && isDemoUser(profile.owner)) return notFound();
  const profileSlug = profile.slug;
  const media = buildArtistMediaCollection(profile.mediaContent, profile.mediaUploads);

  const [shows, viewerLocation, venues, fanHypeCount, journalEntries] = await Promise.all([
    db.show.findMany({
      where: {
        headlinerProfileId: profile.id,
        ...getDemoCreatorExclusion()
      },
      include: { venueProfile: true, headlinerProfile: true },
      orderBy: { startsAt: 'asc' }
    }),
    detectRequestLocation(),
    db.profile.findMany({
      where: {
        type: 'VENUE',
        latitude: { not: null },
        longitude: { not: null },
        ...getDemoOwnerExclusion()
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
    }),
    db.profileHypeEvent.count({
      where: {
        profileId: profile.id,
        user: {
          role: 'FAN'
        }
      }
    }),
    db.artistJournalPost.findMany({
      where: { profileId: profile.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, createdAt: true, title: true, content: true }
    })
  ]);

  const now = new Date();
  const upcomingShows = shows.filter((show) => show.status === 'LIVE' || show.startsAt >= now);
  const previousShows = shows.filter((show) => show.status === 'ENDED' || (show.startsAt < now && show.status !== 'LIVE'));
  const isBookMeReady = Boolean(profile.contactInfo && profile.genres.length > 0 && media.entries.length > 0);
  const isOwner = canManageOwnedResource(session, profile.ownerId);
  const canViewCustomPage = isOwner || profile.fanShareEnabled;
  const sharedThemePreset = canViewCustomPage ? profile.themePreset : DEFAULT_PROFILE_DESIGN_PRESET;
  const bannerStyle = canViewCustomPage ? getSafeBackgroundImageStyle(profile.heroImage) : undefined;
  const pageDesignStyle = getProfileDesignStyleVars(sharedThemePreset, {
    accentTone: canViewCustomPage ? profile.themeAccentTone : undefined,
    backdropTone: canViewCustomPage ? profile.themeBackdropTone : undefined,
    fontPreset: canViewCustomPage ? profile.themeFontPreset : undefined
  });
  const artworkUrl = canViewCustomPage
    ? getSafeImageUrl(profile.galleryImage || profile.heroImage)
    : null;
  const logoUrl = canViewCustomPage ? getSafeImageUrl(profile.logoImage || profile.avatarImage) : null;
  const featureVideoUrl = canViewCustomPage ? getSafeVideoUrl(profile.featureVideoUrl) : null;
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

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ihype.org';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: profile.name,
    url: `${base}/artists/${profile.slug}`,
    ...(profile.headline ? { description: profile.headline } : {}),
    ...(profile.avatarImage ? { image: profile.avatarImage } : {}),
    ...(profile.city ? { foundingLocation: { '@type': 'Place', name: [profile.city, profile.stateRegion].filter(Boolean).join(', ') } } : {}),
    ...(profile.genres?.length ? { genre: profile.genres } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <main className="container section profile-design-shell" style={pageDesignStyle}>
      <header className="artist-banner panel" style={bannerStyle}>
        <div className="profile-banner-row">
          <div className="artist-banner-copy">
            {logoUrl ? <img alt={`${profile.name} logo`} className="artist-logo-mark" src={logoUrl} /> : null}
            <div className="badge">ARTIST</div>
            <h1 className="title" style={{ fontSize: '2.9rem' }}>
              {profile.name}
              {profile.verificationStatus === 'VERIFIED' ? (
                <span
                  title="Verified artist"
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
            <p className="artist-headline">{profile.headline || 'Build your headline banner and tell people what this chapter sounds like.'}</p>
            <p className="subtitle">{profile.bio}</p>
            <p className="meta">{[profile.city, profile.country].filter(Boolean).join(', ')}</p>
            {profile.contactInfo ? <p className="meta">Contact: {profile.contactInfo}</p> : null}
            <p className="meta">Share ID: <Link href={`/profiles/${profile.hexId}`}>{profile.hexId}</Link></p>
            <p className="meta">Fan hype: {fanHypeCount}</p>
            <div className="tag-row">
              {isBookMeReady ? <span className="tag artist-ready-tag">Book me ready</span> : null}
              {profile.genres.map((genre) => <span key={genre} className="tag">{genre}</span>)}
              {profile.genre ? <span className="tag">{profile.genre}</span> : null}
            </div>
            <ProfileLinkShelf linksJson={profile.links ?? null} />
            <HypeButton targetType="profile" targetId={profile.id} initialCount={profile.hypeCount} entityLabel="artist" />
            <FollowButton profileId={profile.id} />
            {profile.contactInfo ? (
              <div className="cta-row" style={{ marginTop: 12 }}>
                <a
                  className="button"
                  href={profile.contactInfo.includes('@') ? `mailto:${profile.contactInfo}?subject=${encodeURIComponent(`Booking inquiry for ${profile.name}`)}` : '#'}
                >
                  Send booking inquiry
                </a>
              </div>
            ) : null}
            <div className="profile-public-actions">
              <Link className="button small secondary" href="/register?role=FAN">Follow as fan</Link>
              <Link className="button small secondary" href={`/artists/${profile.slug}?section=media`}>Hear media</Link>
              <Link className="button small secondary" href="/register?role=VENUE">Book artists</Link>
              <ShareButton path={`/artists/${profile.slug}`} title={profile.name} label="Copy profile link" />
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
        <nav className="section-tabs" aria-label="Artist page sections">
          {artistSections.map((section) => (
            <Link
              key={section}
              className={section === activeSection ? 'section-tab active' : 'section-tab'}
              href={`/artists/${profileSlug}?section=${section}`}
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
                <CollapsibleText text={profile.aboutContent || profile.bio || 'This artist has not filled out the About section yet.'} lines={3} />
              </div>
              {profile.journalContent ? (
                <div className="artist-copy">
                  <strong>Journal</strong>
                  <br />
                  {profile.journalContent}
                </div>
              ) : null}
              {journalEntries.length > 0 ? (
                <div className="artist-copy">
                  <strong>Recent updates</strong>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 10 }}>
                    {journalEntries.map((entry) => (
                      <li key={entry.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                        <div style={{ fontWeight: 700 }}>{entry.title ?? 'Untitled'}</div>
                        <div className="meta" style={{ fontSize: 11 }}>
                          {new Date(entry.createdAt).toLocaleString()}
                        </div>
                        <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{entry.content ?? ''}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Tour content merged into about */}
              {profile.tourContent ? (
                <div className="artist-copy">{profile.tourContent}</div>
              ) : null}

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
                <h3>Upcoming shows</h3>
                <div className="grid grid-2">
                  {upcomingShows.length ? upcomingShows.map((show) => <ShowCard key={show.id} show={show} />) : <div className="empty">No upcoming dates yet.</div>}
                </div>
              </div>

              <div className="artist-tour-shows">
                <h3>Previous shows</h3>
                <div className="grid grid-2">
                  {previousShows.length ? previousShows.map((show) => <ShowCard key={show.id} show={show} />) : <div className="empty">No previous dates yet.</div>}
                </div>
              </div>
            </>
          ) : null}

          {activeSection === 'media' ? (
            <>
              <h2>Media</h2>
              {media.notes ? <div className="artist-copy">{media.notes}</div> : null}
              {artworkUrl ? (
                <div className="artist-media-visuals">
                  <img alt={`${profile.name} featured artwork`} className="artist-media-visual-image" src={artworkUrl} />
                </div>
              ) : null}
              {featureVideoUrl ? (
                <div className="artist-media-visuals">
                  <video className="artist-media-visual-video" controls preload="metadata" src={featureVideoUrl} />
                </div>
              ) : null}
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
                  <span className="empty-title">No playable uploads yet.</span>
                  <p>Example upload: Track title | audio link | short note. Artists can add it from the editor.</p>
                  <div className="empty-example-card">Seed preview, artwork, and play controls will appear here.</div>
                </div>
              )}
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

      <div style={{ marginTop: 8 }}>
        <Link className="button small secondary" href={`/artists/${profile.slug}/epk`}>Press Kit</Link>
      </div>
      <div style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 8 }}>Availability</h3>
        <AvailabilityCalendar profileId={profile.id} />
      </div>
      <PeopleAlsoHype profileId={profile.id} />
      <SoundsLike profileId={profile.id} profileName={profile.name} />
      <StreamingLinks linksJson={profile.links ?? null} />
      <div style={{ marginTop: 16 }}>
        <ReportButton entityType="profile" entityId={profile.id} />
      </div>
      <ContentReportControl targetId={profile.id} targetType="profile" />
      <div style={{ marginTop: 24 }}>
        <AdBanner />
      </div>
    </main>
    </>
  );
}
