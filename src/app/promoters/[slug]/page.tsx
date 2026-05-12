import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildArtistMediaCollection } from '@/lib/media';
import { ContentReportControl } from '@/components/ContentReportControl';
import { ShowCard } from '@/components/ShowCard';
import { HypeButton } from '@/components/HypeButton';
import { NetworkEarthGlobe } from '@/components/NetworkEarthGlobe';
import { DEFAULT_PROFILE_DESIGN_PRESET, getProfileDesignStyleVars } from '@/lib/profile-design';
import { getSafeBackgroundImageStyle, getSafeImageUrl, getSafeVideoUrl } from '@/lib/asset-safety';
import { canManageOwnedResource } from '@/lib/permissions';
import { detectRequestLocation } from '@/lib/request-location';
import { getDemoCreatorExclusion, getDemoOwnerExclusion, isDemoUser, shouldHideDemoContent } from '@/lib/runtime-flags';

const promoterSections = ['about', 'shows', 'events'] as const;

type PromoterSection = (typeof promoterSections)[number];

function getActiveSection(section: string | string[] | undefined): PromoterSection {
  if (section === 'upcoming' || section === 'previous') {
    return 'shows';
  }

  if (section === 'recommend' || section === 'stats') {
    return 'events';
  }

  if (typeof section === 'string' && promoterSections.includes(section as PromoterSection)) {
    return section as PromoterSection;
  }

  return 'about';
}

function getSectionLabel(section: PromoterSection) {
  if (section === 'shows') return 'Shows';
  if (section === 'events') return 'Events';
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

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const profile = await db.profile.findUnique({
    where: { slug },
    select: { name: true, headline: true, genres: true, city: true, stateRegion: true, hypeCount: true, avatarImage: true }
  });

  if (!profile) return { title: 'Promoter · iHYPE' };

  const loc    = [profile.city, profile.stateRegion].filter(Boolean).join(', ');
  const genres = profile.genres.slice(0, 3).join(', ');
  const title  = `${profile.name} · iHYPE`;
  const description = [
    'Promoter',
    genres || null,
    loc || null,
    profile.hypeCount ? `${profile.hypeCount} HYPE` : null,
    profile.headline || null,
  ].filter(Boolean).join(' · ');
  const image = profile.avatarImage ?? undefined;

  return {
    title,
    description,
    openGraph: {
      type:        'profile',
      siteName:    'iHYPE',
      title,
      description,
      url:         `/promoters/${slug}`,
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
  if (!profile || profile.type !== 'DJ') return notFound();
  if (shouldHideDemoContent() && isDemoUser(profile.owner)) return notFound();
  const profileSlug = profile.slug;
  const isOwner = canManageOwnedResource(session, profile.ownerId);

  const [shows, sentRecommendations, viewerLocation, venues, fanHypeCount] = await Promise.all([
    db.show.findMany({
      where: {
        promoterProfileId: profile.id,
        ...getDemoCreatorExclusion()
      },
      include: { venueProfile: true, headlinerProfile: true, promoterProfile: true },
      orderBy: { startsAt: 'asc' }
    }),
    db.venueConnectionRequest.findMany({
      where: { requesterId: profile.ownerId, requesterType: 'PROMOTER' },
      include: { venueProfile: true, artistProfile: true },
      orderBy: { createdAt: 'desc' }
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
    })
  ]);

  const now = new Date();
  const upcomingShows = shows.filter((show) => show.status === 'LIVE' || show.startsAt >= now);
  const previousShows = shows.filter((show) => show.status === 'ENDED' || (show.startsAt < now && show.status !== 'LIVE'));
  const recentShows = [...shows].sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime()).slice(0, 6);
  const canViewCustomPage = isOwner || profile.fanShareEnabled;
  const sharedThemePreset = canViewCustomPage ? profile.themePreset : DEFAULT_PROFILE_DESIGN_PRESET;
  const bannerStyle = canViewCustomPage ? getSafeBackgroundImageStyle(profile.heroImage) : undefined;
  const pageDesignStyle = getProfileDesignStyleVars(sharedThemePreset, {
    accentTone: canViewCustomPage ? profile.themeAccentTone : undefined,
    backdropTone: canViewCustomPage ? profile.themeBackdropTone : undefined,
    fontPreset: canViewCustomPage ? profile.themeFontPreset : undefined
  });
  const logoUrl = canViewCustomPage ? getSafeImageUrl(profile.logoImage || profile.avatarImage) : null;
  const featureImageUrl = canViewCustomPage ? getSafeImageUrl(profile.galleryImage || profile.heroImage) : null;
  const featureVideoUrl = canViewCustomPage ? getSafeVideoUrl(profile.featureVideoUrl) : null;
  const globeRouteStops = previousShows
    .filter(
      (show) =>
        show.venueProfile?.latitude != null &&
        show.venueProfile.longitude != null
    )
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())
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
      timing: 'past' as const
    }));

  return (
    <main className="container section profile-design-shell" style={pageDesignStyle}>
      <header className="artist-banner panel" style={bannerStyle}>
        <div className="profile-banner-row">
          <div className="artist-banner-copy">
            {logoUrl ? <img alt={`${profile.name} logo`} className="artist-logo-mark" src={logoUrl} /> : null}
            <div className="badge">PROMOTER</div>
            <h1 className="title" style={{ fontSize: '2.9rem' }}>{profile.name}</h1>
            <p className="artist-headline">{profile.headline || 'Set the tone for the nights, talent, and scenes you champion.'}</p>
            <p className="subtitle">{profile.bio}</p>
            <p className="meta">{[profile.city, profile.country].filter(Boolean).join(', ')}</p>
            {profile.contactInfo ? <p className="meta">{profile.contactInfo}</p> : null}
            <p className="meta">Share ID: <Link href={`/profiles/${profile.hexId}`}>{profile.hexId}</Link></p>
            <p className="meta">Fan hype: {fanHypeCount}</p>
            <div className="tag-row">{profile.genres.map((genre) => <span key={genre} className="tag">{genre}</span>)}</div>
            <HypeButton targetType="profile" targetId={profile.id} initialCount={profile.hypeCount} entityLabel="promoter" />
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
        <nav className="section-tabs" aria-label="Promoter page sections">
          {promoterSections.map((section) => (
            <Link
              key={section}
              className={section === activeSection ? 'section-tab active' : 'section-tab'}
              href={`/promoters/${profileSlug}?section=${section}`}
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

          {activeSection === 'shows' ? (
            <>
              <h2>Shows</h2>
              <div className="artist-tour-shows">
                <h3>Upcoming</h3>
                <div className="grid grid-2">
                  {upcomingShows.length ? upcomingShows.map((show) => <ShowCard key={show.id} show={show} />) : <div className="empty">No upcoming shows yet.</div>}
                </div>
              </div>

              <div className="artist-tour-shows">
                <h3>Previous</h3>
                <div className="grid grid-2">
                  {previousShows.length ? previousShows.map((show) => <ShowCard key={show.id} show={show} />) : <div className="empty">No previous shows yet.</div>}
                </div>
              </div>
            </>
          ) : null}

          {activeSection === 'events' ? (
            <>
              <h2>Events</h2>
              <div className="artist-copy">{profile.recommendContent || 'Use this section to explain the rooms, artists, and collaborations you like to champion.'}</div>
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

              <NetworkEarthGlobe
                description="Start from the visitor ZIP, highlight nearby venues, then zoom out to browse outside the current location and trace previous promoted shows."
                emptyRouteLabel="No previous promoted shows are mapped yet."
                routeLabel="Promoted history"
                routeStops={globeRouteStops}
                title="Earth globe for nearby venues and promoted-show history"
                venues={venues}
                viewerLocation={viewerLocation}
              />

              <div className="grid grid-2">
                {recentShows.length ? (
                  recentShows.map((show) => (
                    <div key={show.id} className="stat">
                      <strong>{show.title}</strong>
                      {show.venueProfile?.name ? `${show.venueProfile.name} · ` : ''}
                      {formatShowDate(show.startsAt)}
                    </div>
                  ))
                ) : (
                  <div className="empty">No event history yet.</div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </section>

      <ContentReportControl targetId={profile.id} targetType="profile" />
    </main>
  );
}
