import { unstable_cache } from 'next/cache';
import { Prisma, ProfileType } from '@prisma/client';
import { db, withDbRetry } from '@/lib/db';
import { sortShowsForFeed } from '@/lib/integrity';
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
    venueProfile: {
      select: {
        name: true,
        city: true,
        stateRegion: true,
        country: true,
        postalCode: true,
        latitude: true,
        longitude: true
      }
    },
    headlinerProfile: {
      select: {
        name: true,
        city: true,
        country: true
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
    contactInfo: true,
    addressLine1: true,
    hoursText: true,
    city: true,
    stateRegion: true,
    country: true,
    hometown: true,
    postalCode: true,
    latitude: true,
    longitude: true,
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

type PublicShow = Prisma.ShowGetPayload<typeof publicShowArgs>;
type PublicProfile = Prisma.ProfileGetPayload<typeof publicProfileArgs>;
type PublicRequest = Prisma.VenueConnectionRequestGetPayload<typeof publicRequestArgs>;

const getHomePageDataCached = unstable_cache(
  async () => {
    let shows: PublicShow[] = [];
    let profiles: PublicProfile[] = [];
    let requests: PublicRequest[] = [];

    try {
      [shows, profiles, requests] = await withDbRetry(() =>
        db.$transaction([
          db.show.findMany({
            where: { status: { not: 'CANCELED' } },
            orderBy: [{ startsAt: 'asc' }],
            ...publicShowArgs
          }),
          db.profile.findMany({
            orderBy: [{ verified: 'desc' }, { hypeCount: 'desc' }, { name: 'asc' }],
            ...publicProfileArgs
          }),
          db.venueConnectionRequest.findMany(publicRequestArgs)
        ])
      );
    } catch (error) {
      console.error('Falling back to empty home page data', error);
    }

    const transparencySnapshot = await getTransparencySnapshot();
    const rankedShows = sortShowsForFeed(shows);

    return {
      rankedShows,
      featuredShows: rankedShows.slice(0, 4),
      profiles,
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
        where: { type },
        orderBy: [{ verified: 'desc' }, { hypeCount: 'desc' }, { name: 'asc' }],
        ...publicProfileArgs
      })
    ).catch((error) => {
      console.error(`Falling back to empty directory for ${type}`, error);
      return [];
    }),
  ['directory-profiles-v1'],
  { revalidate: 120 }
);

const getShowsDirectoryDataCached = unstable_cache(
  async () =>
    withDbRetry(() =>
      db.show.findMany({
        where: { status: { not: 'CANCELED' } },
        orderBy: [{ startsAt: 'asc' }],
        ...publicShowArgs
      })
    ).catch((error) => {
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
