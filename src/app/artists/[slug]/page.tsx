import type { Metadata } from 'next';
import { cache } from 'react';

export const revalidate = 60;
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
import { getSafeBackgroundImageStyle, getSafeImageUrl } from '@/lib/asset-safety';
import { canManageOwnedResource } from '@/lib/permissions';
import { DEFAULT_PROFILE_DESIGN_PRESET, getProfileDesignStyleVars } from '@/lib/profile-design';
import { detectRequestLocation } from '@/lib/request-location';
import { AdBanner } from '@/components/AdBanner';
import { AvailabilityCalendar } from '@/components/AvailabilityCalendar';
import { getDemoCreatorExclusion, getDemoOwnerExclusion, isDemoUser, shouldHideDemoContent } from '@/lib/runtime-flags';
import { SoundsLike } from '@/components/SoundsLike';
import { StreamingLinks } from '@/components/StreamingLinks';
import { getBaseUrl } from '@/lib/utils';
import { ProfileWidgetsDisplay } from '@/components/ProfileWidgets';
import { parseWidgetConfig } from '@/lib/widgets';

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

const getArtistMeta = cache((slug: string) =>
  db.profile.findUnique({
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
  })
);

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getArtistMeta(slug);

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

  const getArtistPage = cache((s: string) =>
    db.profile.findUnique({
      where: { slug: s },
      include: {
        owner: { select: { email: true, username: true } },
        mediaUploads: {
          select: { hexId: true, title: true, notes: true, mimeType: true, fileSizeBytes: true, createdAt: true, freeUseEnabled: true, sortOrder: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
        }
      }
    })
  );
  const profile = await getArtistPage(slug);
  if (!profile || profile.type !== 'ARTIST') return notFound();
  if (shouldHideDemoContent() && isDemoUser(profile.owner)) return notFound();
  const profileSlug = profile.slug;
  const media = buildArtistMediaCollection(profile.mediaContent, profile.mediaUploads);

  const uploadHexIds = profile.mediaUploads.map((u) => u.hexId);
  const [shows, viewerLocation, venues, fanHypeCount, journalEntries, playCounts, firstBelievers, ownerHypes] = await Promise.all([
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
    }),
    uploadHexIds.length > 0
      ? db.mediaListen.groupBy({
          by: ['mediaId'],
          where: { mediaId: { in: uploadHexIds } },
          _count: { _all: true }
        })
      : Promise.resolve([]),
    db.profileHypeEvent.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: {
        createdAt: true,
        userId: true,
        user: { select: { username: true, name: true, image: true } }
      }
    }),
    // For listening stats widget: fetch owner's top genres from their hyped profiles
    db.profileHypeEvent.findMany({
      where: { userId: profile.ownerId },
      select: { profile: { select: { genres: true, name: true } } },
      take: 200
    })
  ]);

  const playCountMap = new Map(playCounts.map((r) => [r.mediaId, r._count._all]));

  const widgetConfig = parseWidgetConfig(profile.widgetConfig);
  const ownerGenreCounts = new Map<string, number>();
  for (const h of ownerHypes) {
    for (const g of h.profile.genres) {
      const k = g.toLowerCase().trim();
      if (k) ownerGenreCounts.set(k, (ownerGenreCounts.get(k) ?? 0) + 1);
    }
  }
  const listeningData = {
    topGenres: [...ownerGenreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5) as [string, number][],
    topArtists: [...new Set(ownerHypes.map(h => h.profile.name))].slice(0, 3)
  };

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

  const base = getBaseUrl();
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

  const userHype = session?.user?.id
    ? await db.profileHypeEvent.findUnique({ where: { userId_profileId: { userId: session.user.id, profileId: profile.id } }, select: { userId: true } })
    : null;

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
            <HypeButton targetType="profile" targetId={profile.id} initialCount={profile.hypeCount} initiallyHyped={!!userHype} entityLabel="artist" />
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
                <div className="artist-copy" style={{ padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.4, fontFamily: 'var(--f-m, monospace)' }}>Road Journal</div>
                      <div style={{ fontSize: '0.72rem', opacity: 0.4, marginTop: 2 }}>Thoughts from {profile.name}</div>
                    </div>
                    <span style={{ fontSize: '0.62rem', opacity: 0.3 }}>{journalEntries.length} {journalEntries.length === 1 ? 'entry' : 'entries'}</span>
                  </div>
                  <div style={{ display: 'grid', gap: 0 }}>
                    {journalEntries.map((entry, i) => (
                      <div key={entry.id} style={{ paddingTop: i > 0 ? 14 : 0, marginTop: i > 0 ? 14 : 0, borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 3 }}>{entry.title ?? 'Untitled'}</div>
                        <div style={{ fontSize: '0.6rem', opacity: 0.35, marginBottom: 6, fontFamily: 'var(--f-m, monospace)' }}>
                          {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.82rem', opacity: 0.75, whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{entry.content ?? ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Tour content merged into about */}
              {profile.tourContent ? (
                <div className="artist-copy">{profile.tourContent}</div>
              ) : null}

              {widgetConfig.enabled.length > 0 && (
                <ProfileWidgetsDisplay
                  config={widgetConfig}
                  upcomingShows={upcomingShows.slice(0, 3).map(s => ({
                    id: s.id,
                    title: s.title,
                    startsAt: s.startsAt.toISOString(),
                    venueName: s.venueProfile?.name ?? undefined,
                    slug: s.slug ?? undefined
                  }))}
                  listeningData={listeningData}
                />
              )}

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
              {media.entries.length ? (
                <ArtistMediaPlaylist
                  artistName={profile.name}
                  artistSlug={profile.slug}
                  artworkUrl={artworkUrl}
                  entries={media.entries}
                  isOwner={isOwner}
                  profileId={profile.id}
                  playCountMap={Object.fromEntries(playCountMap)}
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
      {firstBelievers.length > 0 ? (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 8 }}>First Believers</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            {firstBelievers.map((believer, index) => {
              const rank = index + 1;
              const rankColor =
                rank === 1 ? '#fbbf24' :
                rank === 2 ? '#94a3b8' :
                rank === 3 ? '#cd7f32' :
                undefined;
              const displayName = believer.user.username ? `@${believer.user.username}` : (believer.user.name ?? 'Fan');
              return (
                <li key={index} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, width: 24, color: rankColor }}>#{rank}</span>
                  {believer.user.image ? (
                    <img
                      src={believer.user.image}
                      alt={displayName}
                      style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: rankColor ?? '#6b7280',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      color: '#fff',
                      fontWeight: 700
                    }}>
                      {(believer.user.name ?? believer.user.username ?? '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{displayName}</span>
                  <span className="meta" style={{ fontSize: 11, marginLeft: 'auto' }}>
                    {new Date(believer.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </span>
                </li>
              );
            })}
          </ul>
          {session?.user?.id && (() => {
            const idx = firstBelievers.findIndex((b) => b.userId === session.user?.id);
            return idx !== -1 ? (
              <p className="meta" style={{ marginTop: 8, fontSize: 12 }}>
                You are fan #{idx + 1} of this artist
              </p>
            ) : null;
          })()}
        </div>
      ) : null}
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
