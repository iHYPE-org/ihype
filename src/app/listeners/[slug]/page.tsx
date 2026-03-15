import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ShowCard } from '@/components/ShowCard';
import { HypeButton } from '@/components/HypeButton';
import { ProfilePageEditor } from '@/components/ProfilePageEditor';
import { ListenerAvatarCreator } from '@/components/ListenerAvatarCreator';
import { NetworkEarthGlobe } from '@/components/NetworkEarthGlobe';
import { FanPageCompanion } from '@/components/FanPageCompanion';
import { FanRecommendationsPanel } from '@/components/FanRecommendationsPanel';
import { getSafeBackgroundImageStyle, getSafeImageUrl } from '@/lib/asset-safety';
import { canManageOwnedResource } from '@/lib/permissions';
import { getProfileDesignStyleVars } from '@/lib/profile-design';
import { detectRequestLocation } from '@/lib/request-location';

const listenerSections = ['about', 'recommend', 'upcoming', 'previous', 'top5', 'stats'] as const;

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

function formatShowDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(value);
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

  const [hypedShows, sentRecommendations, viewerLocation, venues, activeShows, profileHypes, promoterShows] = await Promise.all([
    db.hypeEvent.findMany({
      where: { userId: profile.ownerId },
      include: {
        show: {
          include: {
            venueProfile: true,
            headlinerProfile: true,
            promoterProfile: true
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
    }),
    db.show.findMany({
      where: {
        status: { in: ['SCHEDULED', 'LIVE'] }
      },
      include: {
        venueProfile: true,
        headlinerProfile: true,
        promoterProfile: true
      },
      orderBy: [{ startsAt: 'asc' }, { hypeCount: 'desc' }],
      take: 16
    }),
    db.profileHypeEvent.findMany({
      where: { userId: profile.ownerId },
      include: {
        profile: {
          select: {
            id: true,
            type: true
          }
        }
      }
    }),
    db.show.findMany({
      where: {
        promoterProfileId: { not: null },
        headlinerProfileId: { not: null }
      },
      include: {
        promoterProfile: true,
        headlinerProfile: true,
        venueProfile: true
      },
      orderBy: [{ startsAt: 'desc' }, { hypeCount: 'desc' }],
      take: 24
    })
  ]);

  const now = new Date();
  const shows = hypedShows.map((entry) => entry.show);
  const upcomingShows = shows.filter((show) => show.status === 'LIVE' || show.startsAt >= now);
  const previousShows = shows.filter((show) => show.status === 'ENDED' || (show.startsAt < now && show.status !== 'LIVE'));
  const isOwner = canManageOwnedResource(session, profile.ownerId);
  const likedArtistIds = new Set<string>(
    [
      ...profileHypes
        .filter((entry) => entry.profile.type === 'ARTIST')
        .map((entry) => entry.profile.id),
      ...shows
        .map((show) => show.headlinerProfileId)
        .filter((headlinerProfileId): headlinerProfileId is string => Boolean(headlinerProfileId))
    ]
  );
  const nearbyShows = activeShows
    .filter((show) => {
      const venueProfile = show.venueProfile;
      if (!venueProfile) return false;

      if (viewerLocation?.postalCode && venueProfile.postalCode === viewerLocation.postalCode) return true;
      if (viewerLocation?.city && venueProfile.city === viewerLocation.city) return true;
      if (viewerLocation?.stateRegion && venueProfile.stateRegion === viewerLocation.stateRegion) return true;

      return false;
    })
    .slice(0, 4);
  const trendingShows = [...activeShows]
    .sort((left, right) => right.hypeCount * 3 + right.ticketsSoldCount - (left.hypeCount * 3 + left.ticketsSoldCount))
    .slice(0, 4);
  const promoterMatches = Array.from(
    promoterShows.reduce(
      (map, show) => {
        if (!show.promoterProfile || !show.headlinerProfile || !likedArtistIds.has(show.headlinerProfile.id)) {
          return map;
        }

        const current = map.get(show.promoterProfile.id) ?? {
          id: show.promoterProfile.id,
          slug: show.promoterProfile.slug,
          name: show.promoterProfile.name,
          city: show.promoterProfile.city,
          stateRegion: show.promoterProfile.stateRegion,
          matchedArtistNames: new Set<string>(),
          sharedShowCount: 0
        };

        current.matchedArtistNames.add(show.headlinerProfile.name);
        current.sharedShowCount += 1;
        map.set(show.promoterProfile.id, current);
        return map;
      },
      new Map<
        string,
        {
          id: string;
          slug: string;
          name: string;
          city: string | null;
          stateRegion: string | null;
          matchedArtistNames: Set<string>;
          sharedShowCount: number;
        }
      >()
    ).values()
  )
    .map((entry) => ({
      ...entry,
      matchedArtistNames: [...entry.matchedArtistNames]
    }))
    .sort((left, right) => right.sharedShowCount - left.sharedShowCount)
    .slice(0, 5);
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
  const bannerStyle = getSafeBackgroundImageStyle(profile.heroImage);
  const pageDesignStyle = getProfileDesignStyleVars(profile.themePreset, {
    accentTone: profile.themeAccentTone,
    backdropTone: profile.themeBackdropTone
  });
  const avatarImage = getSafeImageUrl(profile.avatarImage);
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
    <main className="container section profile-design-shell fan-page-shell" data-fan-companion-root style={pageDesignStyle}>
      <FanPageCompanion avatarImage={avatarImage} fanName={profile.name} initials={getInitials(profile.name)} />

      <header className="artist-banner panel" data-fan-companion-label="profile pulse" style={bannerStyle}>
        <div className="profile-banner-row">
          {avatarImage ? (
            <img alt={`${profile.name} avatar`} className="profile-avatar profile-avatar-hero" src={avatarImage} />
          ) : (
            <div className="profile-avatar profile-avatar-hero profile-avatar-fallback">{getInitials(profile.name)}</div>
          )}
          <div className="artist-banner-copy">
            <div className="badge">FAN</div>
            <h1 className="title" style={{ fontSize: '2.9rem' }}>{profile.name}</h1>
            <p className="artist-headline">{profile.headline || 'Capture the shows, artists, and moments you keep coming back to.'}</p>
            <p className="subtitle">{profile.bio}</p>
            <p className="meta">{[profile.city, profile.country].filter(Boolean).join(', ')}</p>
            <p className="meta">Share ID: <Link href={`/profiles/${profile.hexId}`}>{profile.hexId}</Link></p>
            <div className="tag-row">{profile.genres.map((genre) => <span key={genre} className="tag">{genre}</span>)}</div>
            <HypeButton targetType="profile" targetId={profile.id} initialCount={profile.hypeCount} entityLabel="fan page" />
          </div>
        </div>
      </header>

      {isOwner ? (
        <>
          <div data-fan-companion-label="character lab">
            <ListenerAvatarCreator
              defaultPrompt={defaultAvatarPrompt}
              initialAvatarImage={profile.avatarImage}
              profileId={profile.id}
              profileHexId={profile.hexId}
              profileName={profile.name}
            />
          </div>
          <div data-fan-companion-label="fan page customizer">
            <ProfilePageEditor
              description="Edit your fan banner plus the About and Top 5 sections."
              enableDesignCustomizer
              fields={[
                { key: 'headline', label: 'Headline banner', placeholder: 'How should your page feel?' },
                { key: 'heroImage', label: 'Banner image URL', kind: 'url', placeholder: 'https://example.com/fan.jpg' },
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
                themeAccentTone: profile.themeAccentTone ?? '',
                themeBackdropTone: profile.themeBackdropTone ?? '',
                fanShareEnabled: profile.fanShareEnabled
              }}
              previewGenres={profile.genres}
              previewRoleLabel="FAN"
              previewTabs={['About', 'Upcoming', 'Previous', 'Top 5', 'Stats']}
              profileId={profile.id}
              profileName={profile.name}
              title="Customize your fan page"
            />
          </div>
        </>
      ) : null}

      <div data-fan-companion-label="venue radar">
        <NetworkEarthGlobe
          description="Start at the detected ZIP from this request, highlight nearby venues, then zoom out to browse farther scenes and trace the shows this fan has already attended."
          emptyRouteLabel="No previous attended shows are mapped yet."
          routeLabel="Attended shows"
          routeStops={globeRouteStops}
          title="Earth globe for nearby venues and attended shows"
          venues={venues}
          viewerLocation={viewerLocation}
        />
      </div>

      <section className="section" data-fan-companion-label={`${getSectionLabel(activeSection)} section`}>
        <nav className="section-tabs" aria-label="Fan page sections" data-fan-companion-label="fan section tabs">
          {listenerSections.map((section) => (
            <Link
              key={section}
              className={section === activeSection ? 'section-tab active' : 'section-tab'}
              href={`/fans/${profile.slug}?section=${section}`}
            >
              {getSectionLabel(section)}
            </Link>
          ))}
        </nav>

        <div className="panel artist-section-panel" data-fan-companion-label={`${getSectionLabel(activeSection)} highlights`}>
          {activeSection === 'about' ? (
            <>
              <h2>About</h2>
              <div className="artist-copy">{profile.aboutContent || profile.bio || 'This fan has not filled out the About section yet.'}</div>
            </>
          ) : null}

          {activeSection === 'recommend' ? (
            <FanRecommendationsPanel
              nearbyShows={nearbyShows}
              promoterMatches={promoterMatches}
              trendingShows={trendingShows}
              zipLabel={viewerLocation?.postalCode ?? null}
            />
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
