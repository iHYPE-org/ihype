import Link from 'next/link';
import { ProfileType } from '@prisma/client';
import { redirect } from 'next/navigation';
import { ArtistMediaUploadManager } from '@/components/ArtistMediaUploadManager';
import { ListenerAvatarCreator } from '@/components/ListenerAvatarCreator';
import { OwnershipVerificationPanel } from '@/components/OwnershipVerificationPanel';
import { ProfilePageEditor, type ProfilePageEditorField } from '@/components/ProfilePageEditor';
import { VenuePageWizard } from '@/components/VenuePageWizard';
import { auth } from '@/lib/auth';
import { getSafeImageUrl } from '@/lib/asset-safety';
import { db } from '@/lib/db';
import { shortenHexId } from '@/lib/hex-id';
import { isAdminSession } from '@/lib/permissions';

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

function buildFanAvatarPrompt(profile: DashboardProfile) {
  return [
    `Cartoon avatar for ${profile.name}.`,
    profile.genres.length ? `Inspired by ${profile.genres.join(', ')}.` : '',
    [profile.city, profile.country].filter(Boolean).join(', ')
      ? `Set the mood around ${[profile.city, profile.country].filter(Boolean).join(', ')}.`
      : '',
    'Expressive, music-obsessed, colorful, and friendly.'
  ]
    .filter(Boolean)
    .join(' ');
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
      previewTabs: ['About', 'Upcoming', 'Previous', 'Top 5', 'Stats']
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
      previewTabs: ['About', 'Journal', 'Media', 'Tour', 'Merch', 'Stats']
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
    previewTabs: ['About', 'Upcoming', 'Previous', 'Recommend', 'Stats']
  };
}

function getProfileInitialValues(profile: DashboardProfile) {
  return {
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

function createEmptyVenueShowCollectionsMap(profiles: DashboardProfile[]) {
  return new Map<string, VenueShowCollections>(
    profiles
      .filter((profile) => profile.type === 'VENUE')
      .map((profile) => [profile.id, { upcoming: [], previous: [] }])
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

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

  return (
    <main className="container section dashboard-editor-page">
      <section className="panel dashboard-editor-hero">
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
        </div>
      </section>

      {sortedProfiles.length ? (
        <div className="dashboard-editor-stack">
          {sortedProfiles.map((profile) => {
            const publicPath = getProfilePath(profile.type, profile.slug);
            const previewImage = getSafeImageUrl(profile.avatarImage || profile.heroImage);
            const locationLine = getProfileLocation(profile);
            const editorConfig = profile.type === 'VENUE' ? null : getProfileEditorConfig(profile);
            const venueShowCollections = venueShowsByProfile.get(profile.id) ?? {
              upcoming: [],
              previous: []
            };

            return (
              <section className="panel dashboard-editor-card" key={profile.id}>
                <div className="dashboard-editor-card-head">
                  <div className="dashboard-editor-card-summary">
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
                        <Link className="dashboard-editor-chip" href={`/profiles/${profile.hexId}`}>
                          {shortenHexId(profile.hexId)}
                        </Link>
                        {locationLine ? <span className="dashboard-editor-chip">{locationLine}</span> : null}
                      </div>

                      <h2>{profile.name}</h2>
                      <p className="subtitle">{getProfileSummary(profile)}</p>

                      <div className="dashboard-editor-link-row">
                        <Link className="dashboard-editor-link" href={publicPath}>
                          Open public page
                        </Link>
                        <Link className="dashboard-editor-link" href={`/profiles/${profile.hexId}`}>
                          Open share link
                        </Link>
                      </div>

                      <div className="dashboard-editor-focus-row">
                        {getProfileFocusAreas(profile.type).map((area) => (
                          <span className="dashboard-editor-focus-pill" key={area}>
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="dashboard-editor-toolstack">
                  {profile.type === 'LISTENER' ? (
                    <ListenerAvatarCreator
                      defaultPrompt={buildFanAvatarPrompt(profile)}
                      initialAvatarImage={profile.avatarImage}
                      profileHexId={profile.hexId}
                      profileId={profile.id}
                      profileName={profile.name}
                    />
                  ) : null}

                  {profile.type === 'ARTIST' || profile.type === 'VENUE' ? (
                    <OwnershipVerificationPanel
                      contactInfo={profile.contactInfo}
                      profileId={profile.id}
                      roleLabel={profile.type === 'ARTIST' ? 'artist' : 'venue'}
                      verificationNotes={profile.verificationNotes}
                      verificationStatus={profile.verificationStatus}
                    />
                  ) : null}

                  {profile.type === 'VENUE' ? (
                    <VenuePageWizard
                      initialValues={{
                        headline: profile.headline ?? '',
                        bio: profile.bio ?? '',
                        heroImage: profile.heroImage ?? '',
                        aboutContent: profile.aboutContent ?? '',
                        requestContent: profile.requestContent ?? '',
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
                        themeAccentTone: profile.themeAccentTone ?? '',
                        themeBackdropTone: profile.themeBackdropTone ?? ''
                      }}
                      previousShows={venueShowCollections.previous}
                      profileId={profile.id}
                      profileName={profile.name}
                      upcomingShows={venueShowCollections.upcoming}
                    />
                  ) : editorConfig ? (
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
                      title={editorConfig.title}
                    />
                  ) : null}

                  {profile.type === 'ARTIST' ? <ArtistMediaUploadManager profileId={profile.id} /> : null}
                </div>
              </section>
            );
          })}
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
