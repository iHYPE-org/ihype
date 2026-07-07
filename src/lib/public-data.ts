import { unstable_cache } from 'next/cache';
import { Prisma, ProfileType, ShowStatus } from '@prisma/client';
import { db, withDbRetry } from '@/lib/db';
import { sortShowsForFeed } from '@/lib/integrity';
import { demoUserEmails, shouldHideDemoContent } from '@/lib/runtime-flags';
import { getTransparencySnapshot } from '@/lib/transparency';

const publicShowArgs = Prisma.validator<Prisma.ShowDefaultArgs>()({
  select: {
    id: true,
    slug: true,
    title: true,
    description: true,
    status: true,
    startsAt: true,
    hypeCount: true,
    isTicketed: true,
    ticketPriceCents: true,
    ticketCapacity: true,
    ticketsSoldCount: true,
    tags: true,
    isRadioShow: true,
    radioTracks: { select: { durationSecs: true } },
    venueProfile: {
      select: {
        id: true,
        name: true,
        city: true,
        stateRegion: true,
        country: true
      }
    },
    headlinerProfile: {
      select: {
        id: true,
        name: true,
        city: true,
        country: true,
        genres: true
      }
    }
  }
});

const publicProfileArgs = Prisma.validator<Prisma.ProfileDefaultArgs>()({
  select: {
    id: true,
    type: true,
    slug: true,
    hexId: true,
    name: true,
    hoursText: true,
    city: true,
    stateRegion: true,
    country: true,
    hometown: true,
    hypeCount: true,
    bio: true,
    genres: true,
    avatarImage: true,
    verified: true
  }
});

const publicRequestArgs = Prisma.validator<Prisma.VenueConnectionRequestDefaultArgs>()({
  select: {
    venueProfile: {
      select: {
        city: true,
        country: true
      }
    },
    artistProfile: {
      select: {
        city: true,
        country: true
      }
    }
  }
});

type PublicShowRow = Prisma.ShowGetPayload<typeof publicShowArgs>;
type PublicProfileRow = Prisma.ProfileGetPayload<typeof publicProfileArgs>;
type PublicRequest = Prisma.VenueConnectionRequestGetPayload<typeof publicRequestArgs>;

// Contact and precise-location fields are never fetched for public pages —
// they stay in the response shape as nulls so consumers keep compiling.
type RedactedProfileFields = {
  contactInfo: null;
  addressLine1: null;
  postalCode: null;
  latitude: null;
  longitude: null;
};
type RedactedVenueFields = { postalCode: null; latitude: null; longitude: null };
type PublicProfile = PublicProfileRow & RedactedProfileFields;
export type PublicShow = Omit<PublicShowRow, 'venueProfile'> & {
  venueProfile: (NonNullable<PublicShowRow['venueProfile']> & RedactedVenueFields) | null;
};

function publicProfileWhere(type?: ProfileType) {
  return {
    ...(type ? { type } : {}),
    ...(shouldHideDemoContent() ? { owner: { email: { notIn: demoUserEmails } } } : {})
  };
}

function publicShowWhere() {
  return {
    status: { in: [ShowStatus.SCHEDULED, ShowStatus.LIVE, ShowStatus.ENDED] },
    ...(shouldHideDemoContent() ? { creator: { email: { notIn: demoUserEmails } } } : {})
  };
}

function sanitizePublicProfile(profile: PublicProfileRow): PublicProfile {
  return {
    ...profile,
    contactInfo: null,
    addressLine1: null,
    postalCode: null,
    latitude: null,
    longitude: null
  };
}

function sanitizePublicShow(show: PublicShowRow): PublicShow {
  return {
    ...show,
    venueProfile: show.venueProfile
      ? {
          ...show.venueProfile,
          postalCode: null,
          latitude: null,
          longitude: null
        }
      : null
  };
}

const getHomePageDataCached = unstable_cache(
  async () => {
    let shows: PublicShowRow[] = [];
    let profiles: PublicProfileRow[] = [];
    let requests: PublicRequest[] = [];

    try {
      // Bounded so the cached payload can't grow without limit as the
      // Show/Profile tables grow; the home page renders far fewer than this.
      [shows, profiles, requests] = await withDbRetry(() =>
        db.$transaction([
          db.show.findMany({
            where: publicShowWhere(),
            orderBy: [{ startsAt: 'asc' }],
            take: 500,
            ...publicShowArgs
          }),
          db.profile.findMany({
            where: publicProfileWhere(),
            orderBy: [{ verified: 'desc' }, { hypeCount: 'desc' }, { name: 'asc' }],
            take: 1000,
            ...publicProfileArgs
          }),
          db.venueConnectionRequest.findMany({
            orderBy: { createdAt: 'desc' },
            take: 500,
            ...publicRequestArgs
          })
        ])
      );
    } catch (error) {
      console.error('Falling back to empty home page data', error);
    }

    const transparencySnapshot = await getTransparencySnapshot();
    const rankedShows = sortShowsForFeed(shows.map(sanitizePublicShow));

    return {
      rankedShows,
      featuredShows: rankedShows.slice(0, 4),
      profiles: profiles.map(sanitizePublicProfile),
      requests,
      transparencySnapshot
    };
  },
  ['home-page-data-v2'],
  { revalidate: 60 }
);

const getDirectoryProfilesCached = unstable_cache(
  async (type: ProfileType) =>
    withDbRetry(() =>
      db.profile.findMany({
        where: publicProfileWhere(type),
        orderBy: [{ verified: 'desc' }, { hypeCount: 'desc' }, { name: 'asc' }],
        take: 1000,
        ...publicProfileArgs
      })
    ).catch((error) => {
      console.error(`Falling back to empty directory for ${type}`, error);
      return [];
    }).then((profiles) => profiles.map(sanitizePublicProfile)),
  ['directory-profiles-v1'],
  { revalidate: 120 }
);

const getShowsDirectoryDataCached = unstable_cache(
  async () =>
    withDbRetry(() =>
      db.show.findMany({
        where: publicShowWhere(),
        orderBy: [{ startsAt: 'asc' }],
        take: 500,
        ...publicShowArgs
      })
    ).then((shows) => shows.map(sanitizePublicShow))
    .catch((error) => {
      console.error('Falling back to empty shows directory', error);
      return [];
    }),
  ['shows-directory-v1'],
  { revalidate: 60 }
);

export async function getHomePageData() {
  return getHomePageDataCached();
}

export async function getDirectoryProfiles(type: ProfileType) {
  return getDirectoryProfilesCached(type);
}

export async function getShowsDirectoryData() {
  return getShowsDirectoryDataCached();
}
