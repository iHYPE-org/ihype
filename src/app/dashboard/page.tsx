import type { Metadata } from 'next';
import Link from 'next/link';
import { ProfileType } from '@prisma/client';
import { redirect } from 'next/navigation';
import { OwnershipVerificationPanel } from '@/components/OwnershipVerificationPanel';
import { ProfilePageEditor, type ProfilePageEditorField } from '@/components/ProfilePageEditor';
import { ArtistPageBuilder } from '@/components/ArtistPageBuilder';
import { PromoterPageBuilder } from '@/components/PromoterPageBuilder';
import { VenuePageBuilder } from '@/components/VenuePageBuilder';
import { auth } from '@/lib/auth';
import { getSafeImageUrl } from '@/lib/asset-safety';
import { db } from '@/lib/db';
import { shortenHexId } from '@/lib/hex-id';
import { isAdminSession } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Dashboard | iHYPE.org',
  description: 'Manage your iHYPE.org page.',
  robots: {
    index: false,
    follow: false
  }
};

async function getDashboardProfiles(ownerId?: string) {
  return db.profile.findMany({
    where: ownerId ? { ownerId } : undefined,
    orderBy: { name: 'asc' }
  });
}

type DashboardProfile = Awaited<ReturnType<typeof getDashboardProfiles>>[number];

type VenueWizardShow = {
  id: string;
  title: string;
  startsAt: string;
};

type VenueShowCollections = {
  upcoming: VenueWizardShow[];
  previous: VenueWizardShow[];
};

type FanEventHistoryItem = {
  id: string;
  title: string;
  startsAtLabel: string;
  venueName: string | null;
  headlinerName: string | null;
  promoterName: string | null;
  showPath: string;
};

const profileTypeOrder: ProfileType[] = ['LISTENER', 'ARTIST', 'DJ', 'VENUE'];

function getProfileLabel(type: ProfileType) {
  if (type === 'DJ') return 'PROMOTER';
  if (type === 'LISTENER') return 'FAN';
  return type;
}

function getProfilePath(type: ProfileType, slug: string) {
  if (type === 'DJ') return `/promoters/${slug}`;
  if (type === 'VENUE') return `/venues/${slug}`;
  if (type === 'LISTENER') return `/fans/${slug}`;
  return `/artists/${slug}`;
}

function getProfileInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getProfileLocation(profile: DashboardProfile) {
  return [profile.city, profile.stateRegion, profile.country].filter(Boolean).join(', ');
}

function getProfileFocusAreas(type: ProfileType) {
  if (type === 'LISTENER') {
    return ['headline banner', 'avatar lab', 'color scheme', 'top 5', 'fan bio'];
  }

  if (type === 'ARTIST') {
    return ['headline banner', 'color scheme', 'hero graphics', 'journal', 'tour + merch'];
  }

  if (type === 'DJ') {
    return ['headline banner', 'color scheme', 'hero graphics', 'about', 'recommend copy'];
  }

  return ['headline banner', 'venue mood', 'hours', 'local guidance', 'show sections'];
}

function getProfileEditorConfig(profile: DashboardProfile) {
  if (profile.type === 'LISTENER') {
    return {
      title: 'Customize your fan page',
      description:
        'Change your banner, color system, page graphics, intro, and top five from one fan edit studio.',
      fields: [
        { key: 'headline', label: 'Headline banner', placeholder: 'How should your fan page feel?' },
        { key: 'heroImage', label: 'Banner image URL', kind: 'url', placeholder: 'https://example.com/fan.jpg' },
        { key: 'postalCode', label: 'Home ZIP code', placeholder: '60601' },
        { key: 'city', label: 'City', placeholder: 'Chicago' },
        { key: 'stateRegion', label: 'State / province', placeholder: 'Illinois' },
        { key: 'country', label: 'Country', placeholder: 'United States' },
        { key: 'bio', label: 'Short intro', kind: 'textarea', rows: 3 },
        { key: 'aboutContent', label: 'About', kind: 'textarea' },
        { key: 'topFiveContent', label: 'Top 5', kind: 'textarea', rows: 5 }
      ] satisfies ProfilePageEditorField[],
      previewRoleLabel: 'FAN',
      previewTabs: ['About', 'Top 5']
    };
  }

  if (profile.type === 'ARTIST') {
    return {
      title: 'Customize your artist page',
      description:
        'Edit the headline banner, color system, art direction, and artist sections that fans see first.',
      fields: [
        { key: 'headline', label: 'Headline banner', placeholder: 'The line people see first' },
        { key: 'heroImage', label: 'Banner image URL', kind: 'url', placeholder: 'https://example.com/banner.jpg' },
        { key: 'contactInfo', label: 'Contact info', placeholder: 'manager@artist.com | +1 555 101 3030' },
        { key: 'hometown', label: 'Hometown', placeholder: 'Chicago, IL' },
        { key: 'city', label: 'City', placeholder: 'Chicago' },
        { key: 'stateRegion', label: 'State / province', placeholder: 'Illinois' },
        { key: 'country', label: 'Country', placeholder: 'United States' },
        { key: 'bio', label: 'Short intro', kind: 'textarea', rows: 3 },
        { key: 'aboutContent', label: 'About', kind: 'textarea' },
        { key: 'journalContent', label: 'Journal', kind: 'textarea' },
        {
          key: 'mediaContent',
          label: 'Media notes / legacy links',
          kind: 'textarea',
          placeholder:
            'Optional media notes, legacy links, or context lines.\nTrack title | https://example.com/song.mp3 | Release notes'
        },
        { key: 'tourContent', label: 'Tour intro', kind: 'textarea', rows: 4 },
        { key: 'merchContent', label: 'Merch', kind: 'textarea' }
      ] satisfies ProfilePageEditorField[],
      previewRoleLabel: 'ARTIST',
      previewTabs: ['About', 'Media', 'Tour', 'Merch']
    };
  }

  return {
    title: 'Customize your promoter page',
    description:
      'Shape your promoter banner, colors, graphics, city signal, and recommend section from one workspace.',
    fields: [
      { key: 'headline', label: 'Headline banner', placeholder: 'How do you want artists and venues to read this page?' },
      { key: 'heroImage', label: 'Banner image URL', kind: 'url', placeholder: 'https://example.com/promoter.jpg' },
      { key: 'contactInfo', label: 'Contact info', placeholder: 'bookings@promoter.com | +1 555 101 9090' },
      { key: 'city', label: 'City', placeholder: 'Chicago' },
      { key: 'stateRegion', label: 'State / province', placeholder: 'Illinois' },
      { key: 'country', label: 'Country', placeholder: 'United States' },
      { key: 'bio', label: 'Short intro', kind: 'textarea', rows: 3 },
      { key: 'aboutContent', label: 'About', kind: 'textarea' },
      { key: 'recommendContent', label: 'Recommend', kind: 'textarea' }
    ] satisfies ProfilePageEditorField[],
    previewRoleLabel: 'PROMOTER',
    previewTabs: ['About', 'Shows', 'Events']
  };
}

function getProfileInitialValues(profile: DashboardProfile) {
  return {
    headline: profile.headline ?? '',
    bio: profile.bio ?? '',
    heroImage: profile.heroImage ?? '',
    avatarImage: profile.avatarImage ?? '',
    logoImage: profile.logoImage ?? '',
    galleryImage: profile.galleryImage ?? '',
    featureVideoUrl: profile.featureVideoUrl ?? '',
    aboutContent: profile.aboutContent ?? '',
    journalContent: profile.journalContent ?? '',
    mediaContent: profile.mediaContent ?? '',
    tourContent: profile.tourContent ?? '',
    merchContent: profile.merchContent ?? '',
    requestContent: profile.requestContent ?? '',
    recommendContent: profile.recommendContent ?? '',
    topFiveContent: profile.topFiveContent ?? '',
    addressLine1: profile.addressLine1 ?? '',
    contactInfo: profile.contactInfo ?? '',
    hoursText: profile.hoursText ?? '',
    hometown: profile.hometown ?? '',
    city: profile.city ?? '',
    stateRegion: profile.stateRegion ?? '',
    postalCode: profile.postalCode ?? '',
    country: profile.country ?? '',
    parkingDetails: profile.parkingDetails ?? '',
    stayRecommendations: profile.stayRecommendations ?? '',
    upcomingContent: profile.upcomingContent ?? '',
    previousShowHighlights: profile.previousShowHighlights ?? '',
    themePreset: profile.themePreset,
    themeFontPreset: profile.themeFontPreset ?? '',
    themeAccentTone: profile.themeAccentTone ?? '',
    themeBackdropTone: profile.themeBackdropTone ?? '',
    fanShareEnabled: profile.fanShareEnabled
  };
}

function getProfileSummary(profile: DashboardProfile) {
  if (profile.headline) return profile.headline;

  if (profile.type === 'LISTENER') {
    return 'Use this fan workspace to shape your banner, avatar, page mood, and top five.';
  }

  if (profile.type === 'ARTIST') {
    return 'Use this artist workspace to refine your banner, sections, uploads, and fan-facing visuals.';
  }

  if (profile.type === 'DJ') {
    return 'Use this promoter workspace to tune your banner, palette, graphics, and booking voice.';
  }

  return 'Use this venue workspace to style the room, update operations, and frame upcoming nights.';
}

function getArtistBuilderInitialValues(profile: DashboardProfile) {
  return {
    headline: profile.headline ?? '',
    bio: profile.bio ?? '',
    heroImage: profile.heroImage ?? '',
    logoImage: profile.logoImage ?? '',
    galleryImage: profile.galleryImage ?? '',
    featureVideoUrl: profile.featureVideoUrl ?? '',
    contactInfo: profile.contactInfo ?? '',
    hometown: profile.hometown ?? '',
    city: profile.city ?? '',
    stateRegion: profile.stateRegion ?? '',
    country: profile.country ?? '',
    aboutContent: profile.aboutContent ?? '',
    mediaContent: profile.mediaContent ?? '',
    tourContent: profile.tourContent ?? '',
    merchContent: profile.merchContent ?? '',
    themePreset: profile.themePreset,
    themeFontPreset: profile.themeFontPreset,
    themeAccentTone: profile.themeAccentTone,
    themeBackdropTone: profile.themeBackdropTone,
    fanShareEnabled: profile.fanShareEnabled
  };
}

function getPromoterBuilderInitialValues(profile: DashboardProfile) {
  return {
    headline: profile.headline ?? '',
    bio: profile.bio ?? '',
    heroImage: profile.heroImage ?? '',
    logoImage: profile.logoImage ?? '',
    galleryImage: profile.galleryImage ?? '',
    featureVideoUrl: profile.featureVideoUrl ?? '',
    contactInfo: profile.contactInfo ?? '',
    city: profile.city ?? '',
    stateRegion: profile.stateRegion ?? '',
    country: profile.country ?? '',
    aboutContent: profile.aboutContent ?? '',
    recommendContent: profile.recommendContent ?? '',
    themePreset: profile.themePreset,
    themeFontPreset: profile.themeFontPreset,
    themeAccentTone: profile.themeAccentTone,
    themeBackdropTone: profile.themeBackdropTone,
    fanShareEnabled: profile.fanShareEnabled
  };
}

function getVenueBuilderInitialValues(profile: DashboardProfile) {
  return {
    headline: profile.headline ?? '',
    bio: profile.bio ?? '',
    heroImage: profile.heroImage ?? '',
    logoImage: profile.logoImage ?? '',
    galleryImage: profile.galleryImage ?? '',
    featureVideoUrl: profile.featureVideoUrl ?? '',
    addressLine1: profile.addressLine1 ?? '',
    contactInfo: profile.contactInfo ?? '',
    hoursText: profile.hoursText ?? '',
    hometown: profile.hometown ?? '',
    city: profile.city ?? '',
    stateRegion: profile.stateRegion ?? '',
    postalCode: profile.postalCode ?? '',
    country: profile.country ?? '',
    parkingDetails: profile.parkingDetails ?? '',
    stayRecommendations: profile.stayRecommendations ?? '',
    aboutContent: profile.aboutContent ?? '',
    requestContent: profile.requestContent ?? '',
    upcomingContent: profile.upcomingContent ?? '',
    previousShowHighlights: profile.previousShowHighlights ?? '',
    themePreset: profile.themePreset,
    themeFontPreset: profile.themeFontPreset,
    themeAccentTone: profile.themeAccentTone,
    themeBackdropTone: profile.themeBackdropTone,
    fanShareEnabled: profile.fanShareEnabled
  };
}

function createEmptyVenueShowCollectionsMap(profiles: DashboardProfile[]) {
  return new Map<string, VenueShowCollections>(
    profiles
      .filter((profile) => profile.type === 'VENUE')
      .map((profile) => [profile.id, { upcoming: [], previous: [] }])
  );
}

type FanDashboardEditState = 'menu' | 'my-scheme' | 'top-5' | 'event-history';
type DashboardSetupState = 'fan-quickstart' | 'artist-quickstart' | 'promoter-quickstart' | 'venue-quickstart';

function getFanDashboardEditState(value?: string | string[]): FanDashboardEditState | null {
  if (typeof value !== 'string') return null;

  if (
    value === 'menu' ||
    value === 'my-scheme' ||
    value === 'top-5' ||
    value === 'event-history'
  ) {
    return value;
  }

  return null;
}

function getDashboardSetupState(value?: string | string[]): DashboardSetupState | null {
  if (
    value === 'fan-quickstart' ||
    value === 'artist-quickstart' ||
    value === 'promoter-quickstart' ||
    value === 'venue-quickstart'
  ) {
    return value;
  }

  return null;
}

function getDashboardSetupLabel(setupState: DashboardSetupState | null, profileType: ProfileType) {
  if (setupState === 'fan-quickstart' || profileType === 'LISTENER') return 'Fan quick start';
  if (setupState === 'artist-quickstart' || profileType === 'ARTIST') return 'Artist quick start';
  if (setupState === 'promoter-quickstart' || profileType === 'DJ') return 'Promoter quick start';
  return 'Venue quick start';
}

function getProfileOnboardingSteps({
  profile,
  artistUploadedMediaCount,
  fanActionCount,
  promoterShowCount,
  venueShowCount
}: {
  profile: DashboardProfile;
  artistUploadedMediaCount: number;
  fanActionCount: number;
  promoterShowCount: number;
  venueShowCount: number;
}) {
  if (profile.type === 'LISTENER') {
    return [
      {
        title: 'Set your home signal',
        done: Boolean(profile.postalCode || profile.city || profile.country),
        detail: profile.postalCode || profile.city || profile.country ? 'Location signal is ready.' : 'Add ZIP, city, or country.'
      },
      {
        title: 'Build your Top 5',
        done: Boolean(profile.topFiveContent),
        detail: profile.topFiveContent ? 'Top 5 is visible on your page.' : 'Add artists, venues, songs, or memories.'
      },
      {
        title: 'Hype one thing',
        done: fanActionCount > 0,
        detail: fanActionCount > 0 ? `${fanActionCount} fan action${fanActionCount === 1 ? '' : 's'} recorded.` : 'Hype an artist, venue, promoter, or show.'
      }
    ];
  }

  if (profile.type === 'ARTIST') {
    return [
      {
        title: 'Upload one song',
        done: artistUploadedMediaCount > 0,
        detail: artistUploadedMediaCount > 0 ? `${artistUploadedMediaCount} upload${artistUploadedMediaCount === 1 ? '' : 's'} ready.` : 'Add a song or video.'
      },
      {
        title: 'Choose your page look',
        done: Boolean(profile.heroImage || profile.logoImage || profile.galleryImage || profile.headline),
        detail: profile.heroImage || profile.logoImage || profile.galleryImage || profile.headline ? 'Page identity is started.' : 'Pick a preset and add one visual.'
      },
      {
        title: 'Publish your page',
        done: profile.fanShareEnabled,
        detail: profile.fanShareEnabled ? 'Public page is live.' : 'Launch when the first two steps feel right.'
      }
    ];
  }

  if (profile.type === 'DJ') {
    return [
      {
        title: 'Shape your promoter page',
        done: Boolean(profile.headline || profile.bio),
        detail: profile.headline || profile.bio ? 'Public voice is started.' : 'Add a headline and short intro.'
      },
      {
        title: 'Create one radio show',
        done: promoterShowCount > 0,
        detail: promoterShowCount > 0 ? `${promoterShowCount} show${promoterShowCount === 1 ? '' : 's'} saved.` : 'Use Show Creator to save a prerecorded show.'
      },
      {
        title: 'Publish your page',
        done: profile.fanShareEnabled,
        detail: profile.fanShareEnabled ? 'Promoter page is live.' : 'Launch once your page and show are ready.'
      }
    ];
  }

  return [
    {
      title: 'Submit verification',
      done: profile.verificationStatus === 'PENDING' || profile.verificationStatus === 'VERIFIED',
      detail:
        profile.verificationStatus === 'VERIFIED'
          ? 'Venue ownership is verified.'
          : profile.verificationStatus === 'PENDING'
            ? 'Verification is waiting on admin review.'
            : 'Add venue ownership details.'
    },
    {
      title: 'Add operating details',
      done: Boolean(profile.addressLine1 || profile.hoursText || profile.contactInfo),
      detail: profile.addressLine1 || profile.hoursText || profile.contactInfo ? 'Venue basics are present.' : 'Add address, hours, or contact info.'
    },
    {
      title: 'Create one event',
      done: venueShowCount > 0,
      detail: venueShowCount > 0 ? `${venueShowCount} event${venueShowCount === 1 ? '' : 's'} attached.` : 'Create a ticket-ready event.'
    }
  ];
}

function formatShowDateTime(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(value);
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ profile?: string | string[]; edit?: string | string[]; setup?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const isAdmin = isAdminSession(session);
  const profiles = await getDashboardProfiles(isAdmin ? undefined : session.user.id);
  const sortedProfiles = [...profiles].sort((left, right) => {
    const orderDifference =
      profileTypeOrder.indexOf(left.type) - profileTypeOrder.indexOf(right.type);

    if (orderDifference !== 0) return orderDifference;
    return left.name.localeCompare(right.name);
  });

  const venueProfileIds = sortedProfiles
    .filter((profile) => profile.type === 'VENUE')
    .map((profile) => profile.id);

  const venueShows = venueProfileIds.length
    ? await db.show.findMany({
        where: {
          venueProfileId: { in: venueProfileIds }
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          status: true,
          venueProfileId: true
        },
        orderBy: { startsAt: 'asc' }
      })
    : [];

  const now = new Date();
  const venueShowsByProfile = createEmptyVenueShowCollectionsMap(sortedProfiles);

  for (const show of venueShows) {
    if (!show.venueProfileId) continue;
    const collection = venueShowsByProfile.get(show.venueProfileId);
    if (!collection) continue;

    const showRecord = {
      id: show.id,
      title: show.title,
      startsAt: show.startsAt.toISOString()
    };

    if (show.status === 'LIVE' || show.startsAt >= now) {
      collection.upcoming.push(showRecord);
    } else {
      collection.previous.push(showRecord);
    }
  }

  const requestedProfileId =
    typeof resolvedSearchParams.profile === 'string' ? resolvedSearchParams.profile : undefined;
  const activeProfile =
    sortedProfiles.find((profile) => profile.id === requestedProfileId) ?? sortedProfiles[0] ?? null;
  const fanDashboardEditState = getFanDashboardEditState(resolvedSearchParams.edit);
  const dashboardSetupState = getDashboardSetupState(resolvedSearchParams.setup);
  const artistUploadedMediaCount =
    activeProfile?.type === 'ARTIST'
      ? await db.artistMediaAsset.count({
          where: { profileId: activeProfile.id }
        })
      : 0;
  const promoterShowCount =
    activeProfile?.type === 'DJ'
      ? await db.show.count({
          where: { promoterProfileId: activeProfile.id }
        })
      : 0;
  const fanEventHistory =
    activeProfile?.type === 'LISTENER'
      ? await db.hypeEvent.findMany({
          where: { userId: activeProfile.ownerId },
          include: {
            show: {
              include: {
                venueProfile: true,
                headlinerProfile: true,
                promoterProfile: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 24
        })
      : [];

  return (
    <main className="container section dashboard-editor-page">
      {activeProfile?.type !== 'LISTENER' ? (
        <section className="panel dashboard-editor-hero">
          {activeProfile ? (
            <>
              <div className="dashboard-editor-hero-copy">
                <div className="badge">
                  {isAdmin
                    ? 'ADMIN EDIT MODE'
                    : dashboardSetupState
                      ? getDashboardSetupLabel(dashboardSetupState, activeProfile.type).toUpperCase()
                      : `${getProfileLabel(activeProfile.type)} EDIT STUDIO`}
                </div>
                <h1>{dashboardSetupState ? `Launch ${activeProfile.name}` : activeProfile.name}</h1>
                <p className="subtitle">
                  {dashboardSetupState
                    ? 'Start with three practical moves, then come back for deeper customization once the page is live.'
                    : getProfileSummary(activeProfile)}
                </p>
                <div className="dashboard-editor-link-row">
                  <Link className="dashboard-editor-link" href={getProfilePath(activeProfile.type, activeProfile.slug)}>
                    Open public page
                  </Link>
                  <Link className="dashboard-editor-link" href={`/profiles/${activeProfile.hexId}`}>
                    Open share link
                  </Link>
                </div>
              </div>

              <div className="dashboard-editor-hero-stats">
                <article className="dashboard-editor-hero-pill">
                  <span>Share ID</span>
                  <strong>{shortenHexId(activeProfile.hexId)}</strong>
                </article>
                <article className="dashboard-editor-hero-pill">
                  <span>Editable pages</span>
                  <strong>{sortedProfiles.length}</strong>
                </article>
                <article className="dashboard-editor-hero-pill">
                  <span>Scope</span>
                  <strong>{isAdmin ? 'All profiles' : 'Your profiles'}</strong>
                </article>
              </div>
            </>
          ) : (
            <>
              <div className="dashboard-editor-hero-copy">
                <div className="badge">{isAdmin ? 'ADMIN EDIT MODE' : 'EDIT STUDIO'}</div>
                <h1>{isAdmin ? 'Edit every public page from one dashboard.' : 'Dashboard is now your page editor.'}</h1>
                <p className="subtitle">
                  Focus on headline banners, color schemes, graphics, profile info, and role-specific page
                  sections here first. Open the public page whenever you want to review the final result.
                </p>
              </div>

              <div className="dashboard-editor-hero-stats">
                <article className="dashboard-editor-hero-pill">
                  <span>Editable pages</span>
                  <strong>{sortedProfiles.length}</strong>
                </article>
                <article className="dashboard-editor-hero-pill">
                  <span>Scope</span>
                  <strong>{isAdmin ? 'All profiles' : 'Your profiles'}</strong>
                </article>
                {isAdmin && (
                  <Link className="dashboard-editor-hero-pill" href="/admin/verifications" style={{ textDecoration: 'none' }}>
                    <span>Verification queue</span>
                    <strong>→</strong>
                  </Link>
                )}
              </div>
            </>
          )}
        </section>
      ) : null}

      {sortedProfiles.length && activeProfile ? (
        <div className="dashboard-editor-stack">
          {sortedProfiles.length > 1 && activeProfile.type !== 'LISTENER' ? (
            <section className="panel dashboard-editor-card dashboard-editor-selector-card">
              <div className="dashboard-editor-module-head">
                <div>
                  <div className="badge">Profile switcher</div>
                  <h2>Edit another page</h2>
                </div>
              </div>
              <div className="dashboard-editor-switcher">
                {sortedProfiles.map((profile) => (
                  <Link
                    key={profile.id}
                    className={profile.id === activeProfile.id ? 'dashboard-editor-switch active' : 'dashboard-editor-switch'}
                    href={`/dashboard?profile=${profile.id}`}
                  >
                    <span>{profile.name}</span>
                    <strong>{getProfileLabel(profile.type)}</strong>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {(() => {
            const profile = activeProfile;
            const previewImage = getSafeImageUrl(profile.avatarImage || profile.heroImage);
            const locationLine = getProfileLocation(profile);
            const isFanProfile = profile.type === 'LISTENER';
            const isArtistQuickStartProfile =
              profile.type === 'ARTIST' && dashboardSetupState === 'artist-quickstart';
            const isQuickStartProfile =
              dashboardSetupState === `${profile.type === 'LISTENER' ? 'fan' : profile.type === 'DJ' ? 'promoter' : profile.type.toLowerCase()}-quickstart`;
            const editorConfig = isFanProfile ? getProfileEditorConfig(profile) : null;
            const venueShowCollection = venueShowsByProfile.get(profile.id);
            const onboardingSteps = getProfileOnboardingSteps({
              profile,
              artistUploadedMediaCount,
              fanActionCount: fanEventHistory.length,
              promoterShowCount,
              venueShowCount: (venueShowCollection?.upcoming.length ?? 0) + (venueShowCollection?.previous.length ?? 0)
            });
            const fanEventHistoryItems = fanEventHistory
              .map((entry) => entry.show)
              .filter((show) => show.status === 'ENDED' || show.startsAt < now)
              .map((show) => ({
                id: show.id,
                title: show.title,
                startsAtLabel: formatShowDateTime(show.startsAt),
                venueName: show.venueProfile?.name ?? null,
                headlinerName: show.headlinerProfile?.name ?? null,
                promoterName: show.promoterProfile?.name ?? null,
                showPath: `/shows/${show.slug}`
              }));

            const fanEditHref = (editState: FanDashboardEditState | null) =>
              editState
                ? `/dashboard?profile=${profile.id}&edit=${editState}`
                : `/dashboard?profile=${profile.id}`;

            return (
              <section className="panel dashboard-editor-card" key={profile.id}>
                <div className="dashboard-editor-card-head">
                  <div className={isFanProfile ? 'dashboard-editor-card-summary dashboard-editor-card-summary-fan' : 'dashboard-editor-card-summary'}>
                    {previewImage ? (
                      <img
                        alt={`${profile.name} preview`}
                        className="dashboard-editor-card-art"
                        src={previewImage}
                      />
                    ) : (
                      <div className="dashboard-editor-card-art dashboard-editor-card-art-fallback">
                        {getProfileInitials(profile.name)}
                      </div>
                    )}

                    <div className="dashboard-editor-card-copy">
                      <div className="dashboard-editor-card-meta">
                        <span className="badge">{getProfileLabel(profile.type)}</span>
                        {isFanProfile ? (
                          <span className="dashboard-editor-chip">My ID {shortenHexId(profile.hexId)}</span>
                        ) : (
                          <Link className="dashboard-editor-chip" href={`/profiles/${profile.hexId}`}>
                            {shortenHexId(profile.hexId)}
                          </Link>
                        )}
                        {locationLine ? <span className="dashboard-editor-chip">{locationLine}</span> : null}
                      </div>

                      <h2>{profile.name}</h2>
                      {isFanProfile ? null : <p className="subtitle">{getProfileSummary(profile)}</p>}

                      {isFanProfile ? null : (
                        <div className="dashboard-editor-focus-row">
                          {getProfileFocusAreas(profile.type).map((area) => (
                            <span className="dashboard-editor-focus-pill" key={area}>
                              {area}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {isFanProfile ? (
                      <div className="dashboard-editor-banner-actions">
                        <Link className="button small ghost" href={getProfilePath(profile.type, profile.slug)}>
                          View my page
                        </Link>
                        <Link className="button small secondary" href={fanEditHref(fanDashboardEditState ? null : 'menu')}>
                          {fanDashboardEditState ? 'Close edit' : 'Edit page'}
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </div>

                {isFanProfile ? (
                  <>
                    {isQuickStartProfile ? (
                      <section className="panel dashboard-editor-onboarding dashboard-editor-fan-panel">
                        <div className="dashboard-editor-module-head">
                          <div>
                            <div className="badge">{getDashboardSetupLabel(dashboardSetupState, profile.type)}</div>
                            <h2>Three moves to get started</h2>
                          </div>
                          <Link className="dashboard-editor-link" href={`/dashboard?profile=${profile.id}&edit=menu`}>
                            Open page editor
                          </Link>
                        </div>
                        <div className="dashboard-editor-onboarding-grid">
                          {onboardingSteps.map((step) => (
                            <article
                              className={step.done ? 'dashboard-editor-onboarding-step done' : 'dashboard-editor-onboarding-step'}
                              key={step.title}
                            >
                              <strong>{step.title}</strong>
                              <span>{step.detail}</span>
                            </article>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {fanDashboardEditState ? (
                      <div className="dashboard-editor-tool-pills">
                        <Link
                          className={fanDashboardEditState === 'my-scheme' ? 'dashboard-editor-tool-pill active' : 'dashboard-editor-tool-pill'}
                          href={fanEditHref('my-scheme')}
                        >
                          My Scheme
                        </Link>
                        <Link
                          className={fanDashboardEditState === 'top-5' ? 'dashboard-editor-tool-pill active' : 'dashboard-editor-tool-pill'}
                          href={fanEditHref('top-5')}
                        >
                          Top 5
                        </Link>
                        <Link
                          className={fanDashboardEditState === 'event-history' ? 'dashboard-editor-tool-pill active' : 'dashboard-editor-tool-pill'}
                          href={fanEditHref('event-history')}
                        >
                          Event History
                        </Link>
                      </div>
                    ) : null}

                    {fanDashboardEditState === 'my-scheme' ? (
                      <div className="dashboard-editor-fan-panel">
                        <ProfilePageEditor
                          description="Tune your page mood, banner, intro, and color scheme."
                          enableDesignCustomizer
                          fields={[
                            { key: 'headline', label: 'Headline banner', placeholder: 'How should your fan page feel?' },
                            { key: 'heroImage', label: 'Banner image URL', kind: 'url', placeholder: 'https://example.com/fan.jpg' },
                            { key: 'bio', label: 'Short intro', kind: 'textarea', rows: 3 },
                            { key: 'postalCode', label: 'Home ZIP code', placeholder: '60601' },
                            { key: 'city', label: 'City', placeholder: 'Chicago' },
                            { key: 'stateRegion', label: 'State / province', placeholder: 'Illinois' },
                            { key: 'country', label: 'Country', placeholder: 'United States' }
                          ]}
                          hideToggle
                          initialValues={getProfileInitialValues(profile)}
                          previewGenres={profile.genres}
                          previewRoleLabel="FAN"
                          previewTabs={['About', 'Top 5']}
                          profileId={profile.id}
                          profileName={profile.name}
                          quickPresetRole="fan"
                          startOpen
                          title="My Scheme"
                        />
                      </div>
                    ) : null}

                    {fanDashboardEditState === 'top-5' ? (
                      <div className="dashboard-editor-fan-panel">
                        <ProfilePageEditor
                          description="Update the five artists, venues, promoters, or moments that define your page."
                          fields={[
                            { key: 'topFiveContent', label: 'Top 5', kind: 'textarea', rows: 8, placeholder: '1. Artist\n2. Venue\n3. Promoter\n4. Track\n5. Show memory' }
                          ]}
                          hideToggle
                          initialValues={getProfileInitialValues(profile)}
                          previewGenres={profile.genres}
                          previewRoleLabel="FAN"
                          previewTabs={['Top 5']}
                          profileId={profile.id}
                          profileName={profile.name}
                          startOpen
                          title="Top 5"
                        />
                      </div>
                    ) : null}

                    {fanDashboardEditState === 'event-history' ? (
                      <section className="panel dashboard-editor-fan-panel dashboard-editor-history-panel">
                        <div className="dashboard-editor-module-head">
                          <div>
                            <div className="badge">Event history</div>
                            <h2>Shows you have already pushed forward</h2>
                          </div>
                        </div>
                        {fanEventHistoryItems.length ? (
                          <div className="dashboard-editor-history-list">
                            {fanEventHistoryItems.map((show) => (
                              <Link className="dashboard-editor-history-item" href={show.showPath} key={show.id}>
                                <strong>{show.title}</strong>
                                <span>{show.startsAtLabel}</span>
                                <span>{[show.venueName, show.headlinerName, show.promoterName].filter(Boolean).join(' · ')}</span>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <div className="empty">No previous event history has been recorded on this fan profile yet.</div>
                        )}
                      </section>
                    ) : null}
                  </>
                ) : (
                  <div className="dashboard-editor-toolstack">
                    {isQuickStartProfile ? (
                      <section className="panel dashboard-editor-onboarding">
                        <div className="dashboard-editor-module-head">
                          <div>
                            <div className="badge">{getDashboardSetupLabel(dashboardSetupState, profile.type)}</div>
                            <h2>Three moves to get live</h2>
                          </div>
                          <Link className="dashboard-editor-link" href={`/dashboard?profile=${profile.id}`}>
                            Open full editor
                          </Link>
                        </div>
                        <div className="dashboard-editor-onboarding-grid">
                          {onboardingSteps.map((step) => (
                            <article
                              className={step.done ? 'dashboard-editor-onboarding-step done' : 'dashboard-editor-onboarding-step'}
                              key={step.title}
                            >
                              <strong>{step.title}</strong>
                              <span>{step.detail}</span>
                            </article>
                          ))}
                        </div>
                        <p className="meta">
                          Start with the smallest useful setup. You can return for deeper sections after the page is live.
                        </p>
                      </section>
                    ) : null}

                    {(profile.type === 'VENUE' || (profile.type === 'ARTIST' && !isArtistQuickStartProfile)) ? (
                      <OwnershipVerificationPanel
                        contactInfo={profile.contactInfo}
                        profileId={profile.id}
                        roleLabel={profile.type === 'ARTIST' ? 'artist' : 'venue'}
                        verificationNotes={profile.verificationNotes}
                        verificationStatus={profile.verificationStatus}
                      />
                    ) : null}

                    {profile.type === 'ARTIST' ? (
                      <ArtistPageBuilder
                        hideToggle
                        initialValues={getArtistBuilderInitialValues(profile)}
                        previewGenres={profile.genres}
                        profileId={profile.id}
                        profileName={profile.name}
                        quickStart={isArtistQuickStartProfile}
                        startOpen
                        uploadedMediaCount={artistUploadedMediaCount}
                      />
                    ) : null}

                    {profile.type === 'DJ' ? (
                      <PromoterPageBuilder
                        hideToggle
                        initialValues={getPromoterBuilderInitialValues(profile)}
                        previewGenres={profile.genres}
                        profileId={profile.id}
                        profileName={profile.name}
                        startOpen
                      />
                    ) : null}

                    {profile.type === 'VENUE' ? (
                      <VenuePageBuilder
                        hideToggle
                        initialValues={getVenueBuilderInitialValues(profile)}
                        previewGenres={profile.genres}
                        profileId={profile.id}
                        profileName={profile.name}
                        startOpen
                      />
                    ) : null}

                    {editorConfig && !isArtistQuickStartProfile ? (
                      <ProfilePageEditor
                        allowFanShareToggle={profile.type === 'ARTIST'}
                        description={editorConfig.description}
                        enableDesignCustomizer
                        fields={editorConfig.fields}
                        initialValues={getProfileInitialValues(profile)}
                        previewGenres={profile.genres}
                        previewRoleLabel={editorConfig.previewRoleLabel}
                        previewTabs={editorConfig.previewTabs}
                        profileId={profile.id}
                        profileName={profile.name}
                        quickPresetRole={
                          profile.type === 'LISTENER'
                            ? 'fan'
                            : profile.type === 'ARTIST'
                              ? 'artist'
                              : profile.type === 'DJ'
                                ? 'promoter'
                                : 'venue'
                        }
                        title={editorConfig.title}
                      />
                    ) : null}
                  </div>
                )}
              </section>
            );
          })()}
        </div>
      ) : (
        <section className="panel dashboard-editor-empty">
          <h2>No editable pages yet.</h2>
          <p className="subtitle">
            Sign up for a fan, artist, promoter, or venue account first, then come back here to customize the
            headline banner, colors, graphics, and page information.
          </p>
        </section>
      )}
    </main>
  );
}
