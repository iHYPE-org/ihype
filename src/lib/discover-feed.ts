import { Prisma } from '@prisma/client/wasm';
import { withDbRetry, db } from '@/lib/db';
import type { DirectoryBrowserProfile, DirectoryMediaSearchEntry } from '@/components/ProfileDirectoryBrowser';
import type { RequestLocation } from '@/lib/request-location';
import { buildArtistMediaCollection } from '@/lib/media';
import { demoUserEmails, shouldHideDemoContent } from '@/lib/runtime-flags';

export type DiscoverSpotlightProfile = DirectoryBrowserProfile & {
  scopeLabel: string;
  createdAtLabel: string;
};

export type DiscoverLocationMatchCandidate = {
  postalCode?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  country?: string | null;
};

const spotlightProfileArgs = Prisma.validator<Prisma.ProfileDefaultArgs>()({
  select: {
    id: true,
    type: true,
    slug: true,
    hexId: true,
    name: true,
    contactInfo: true,
    addressLine1: true,
    hoursText: true,
    hometown: true,
    city: true,
    stateRegion: true,
    country: true,
    postalCode: true,
    hypeCount: true,
    bio: true,
    genres: true,
    avatarImage: true,
    createdAt: true,
    mediaContent: true,
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

type SpotlightProfileRecord = Prisma.ProfileGetPayload<typeof spotlightProfileArgs>;

function profileWhere(type: 'ARTIST' | 'DJ') {
  return {
    type,
    ...(shouldHideDemoContent() ? { owner: { email: { notIn: demoUserEmails } } } : {})
  };
}

function normalize(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

export function isLocalMatch(profile: DiscoverLocationMatchCandidate, location: RequestLocation | null) {
  if (!location) {
    return false;
  }

  if (location.postalCode && profile.postalCode && normalize(location.postalCode) === normalize(profile.postalCode)) {
    return true;
  }

  return (
    Boolean(location.city) &&
    Boolean(profile.city) &&
    normalize(location.city) === normalize(profile.city) &&
    normalize(location.country) === normalize(profile.country) &&
    normalize(location.stateRegion) === normalize(profile.stateRegion)
  );
}

export function isRegionalMatch(
  profile: Pick<DiscoverLocationMatchCandidate, 'stateRegion' | 'country'>,
  location: RequestLocation | null
) {
  if (!location) {
    return false;
  }

  return (
    Boolean(location.stateRegion) &&
    Boolean(profile.stateRegion) &&
    normalize(location.stateRegion) === normalize(profile.stateRegion) &&
    normalize(location.country) === normalize(profile.country)
  );
}

function formatCreatedAt(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(value);
}

function toDirectoryProfile(profile: SpotlightProfileRecord): DirectoryBrowserProfile {
  return {
    id: profile.id,
    type: profile.type,
    slug: profile.slug,
    hexId: profile.hexId,
    name: profile.name,
    contactInfo: profile.contactInfo,
    addressLine1: profile.addressLine1,
    hoursText: profile.hoursText,
    hometown: profile.hometown,
    city: profile.city,
    stateRegion: profile.stateRegion,
    country: profile.country,
    hypeCount: profile.hypeCount,
    bio: profile.bio,
    genres: profile.genres,
    avatarImage: profile.avatarImage
  };
}

function withScopeLabel(profile: SpotlightProfileRecord, location: RequestLocation | null): DiscoverSpotlightProfile {
  return {
    ...toDirectoryProfile(profile),
    scopeLabel: isLocalMatch(profile, location) ? 'Local' : isRegionalMatch(profile, location) ? 'Regional' : 'Network',
    createdAtLabel: formatCreatedAt(profile.createdAt)
  };
}

function hypeVelocity(profile: SpotlightProfileRecord): number {
  const ageDays = Math.max(1, (Date.now() - new Date(profile.createdAt).getTime()) / 86_400_000);
  return (profile.hypeCount + 1) / (ageDays + 1);
}

function sortByLocalRegional<T extends SpotlightProfileRecord>(profiles: T[], location: RequestLocation | null) {
  return [...profiles].sort((left, right) => {
    const leftScore = isLocalMatch(left, location) ? 2 : isRegionalMatch(left, location) ? 1 : 0;
    const rightScore = isLocalMatch(right, location) ? 2 : isRegionalMatch(right, location) ? 1 : 0;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    // Within the same geographic bucket, rank by hype velocity (hypes/day) rather than raw count.
    // This surfaces breakout profiles that are gaining fast over well-established ones that peaked long ago.
    return hypeVelocity(right) - hypeVelocity(left);
  });
}

export async function getSharedDiscoverFeed(viewerLocation: RequestLocation | null) {
  const [artistProfiles, promoterProfiles] = await withDbRetry(() =>
    db.$transaction([
      db.profile.findMany({
        where: profileWhere('ARTIST'),
        orderBy: [{ hypeCount: 'desc' }, { createdAt: 'desc' }],
        take: 40,
        ...spotlightProfileArgs
      }),
      db.profile.findMany({
        where: profileWhere('DJ'),
        orderBy: [{ createdAt: 'desc' }, { hypeCount: 'desc' }],
        take: 30,
        ...spotlightProfileArgs
      })
    ])
  ).catch((error) => {
    console.error('Falling back to empty discover feed', error);
    return [[], []] as [SpotlightProfileRecord[], SpotlightProfileRecord[]];
  });

  const hypedNearMe = sortByLocalRegional(artistProfiles, viewerLocation)
    .filter((profile) => isLocalMatch(profile, viewerLocation) || isRegionalMatch(profile, viewerLocation) || !viewerLocation)
    .slice(0, 6)
    .map((profile) => withScopeLabel(profile, viewerLocation));

  const newArtists = artistProfiles
    .filter((profile) => isLocalMatch(profile, viewerLocation) || !viewerLocation)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 6)
    .map((profile) => withScopeLabel(profile, viewerLocation));

  const newPromoters = promoterProfiles
    .filter((profile) => isLocalMatch(profile, viewerLocation) || isRegionalMatch(profile, viewerLocation) || !viewerLocation)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 6)
    .map((profile) => withScopeLabel(profile, viewerLocation));

  const mediaEntries: DirectoryMediaSearchEntry[] = artistProfiles
    .flatMap((profile) =>
      buildArtistMediaCollection(profile.mediaContent, profile.mediaUploads).entries.map((entry) => ({
        id: `${profile.slug}-${entry.hexId}`,
        mediaId: entry.hexId,
        title: entry.title,
        artistName: profile.name,
        artistSlug: profile.slug,
        artistProfileId: profile.id,
        artistHypeCount: profile.hypeCount,
        url: entry.url,
        notes: entry.notes,
        artworkUrl: profile.avatarImage,
        mediaType: entry.mediaType ?? 'audio'
      }))
    )
    .slice(0, 120);

  return {
    hypedNearMe,
    newArtists,
    newPromoters,
    mediaEntries
  };
}
