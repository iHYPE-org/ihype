import { randomUUID } from 'node:crypto';
import { PrismaClient, ProfileType, Role, ShowStatus } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

const confirm = process.env.CONFIRM_LAUNCH_SEED;
if (process.env.NODE_ENV === 'production' && confirm !== 'seed ihype launch') {
  throw new Error('Refusing production launch seed without CONFIRM_LAUNCH_SEED="seed ihype launch".');
}

async function main() {
  const passwordHash = await bcrypt.hash(randomUUID(), 10);

  async function user(email: string, username: string, name: string, role: Role) {
    return prisma.user.upsert({
      where: { username },
      update: { email, name, role, passwordHash },
      create: { email, username, name, role, passwordHash, isThirteenOrOlder: true }
    });
  }

  async function profile(input: {
    slug: string;
    hexId: string;
    ownerId: string;
    type: ProfileType;
    name: string;
    headline: string;
    city: string;
    stateRegion: string;
    genres: string[];
    hypeCount: number;
  }) {
    return prisma.profile.upsert({
      where: { slug: input.slug },
      update: {
        name: input.name,
        headline: input.headline,
        city: input.city,
        stateRegion: input.stateRegion,
        country: 'USA',
        genres: input.genres,
        genre: input.genres[0],
        hypeCount: input.hypeCount,
        fanShareEnabled: true,
        verified: true,
        isVerified: true
      },
      create: {
        ...input,
        country: 'USA',
        genre: input.genres[0],
        fanShareEnabled: true,
        verified: true,
        isVerified: true
      }
    });
  }

  await user('launch-fan@ihype.org', 'launch-fan', 'Launch Fan', Role.FAN);
  const artistOwner = await user('launch-artist@ihype.org', 'launch-artist', 'Launch Artist', Role.ARTIST);
  const venueOwner = await user('launch-venue@ihype.org', 'launch-venue', 'Launch Venue', Role.VENUE);
  const promoterOwner = await user('launch-promoter@ihype.org', 'launch-promoter', 'Launch Promoter', Role.DJ);

  const artist = await profile({
    slug: 'static-bloom',
    hexId: '0xlaunch000000000000000000000000000001',
    ownerId: artistOwner.id,
    type: ProfileType.ARTIST,
    name: 'Static Bloom',
    headline: 'Dream-pop hooks built for late-night rooms.',
    city: 'Chicago',
    stateRegion: 'IL',
    genres: ['Dream Pop', 'Indie'],
    hypeCount: 84
  });

  const venue = await profile({
    slug: 'signal-yard',
    hexId: '0xlaunch000000000000000000000000000002',
    ownerId: venueOwner.id,
    type: ProfileType.VENUE,
    name: 'Signal Yard',
    headline: 'All-ages room connecting local scenes without ticket fees.',
    city: 'Chicago',
    stateRegion: 'IL',
    genres: ['Live Music', 'DIY'],
    hypeCount: 57
  });

  const promoter = await profile({
    slug: 'south-loop-signal',
    hexId: '0xlaunch000000000000000000000000000003',
    ownerId: promoterOwner.id,
    type: ProfileType.DJ,
    name: 'South Loop Signal',
    headline: 'Community bills, radio nights, and first-listen showcases.',
    city: 'Chicago',
    stateRegion: 'IL',
    genres: ['House', 'Indie Dance'],
    hypeCount: 41
  });

  await prisma.show.upsert({
    where: { slug: 'signal-yard-launch-night' },
    update: {
      status: ShowStatus.SCHEDULED,
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      creatorId: promoterOwner.id,
      venueProfileId: venue.id,
      headlinerProfileId: artist.id,
      promoterProfileId: promoter.id,
      hypeCount: 31
    },
    create: {
      slug: 'signal-yard-launch-night',
      title: 'Signal Yard Launch Night',
      description: 'A zero-fee launch bill for artists, fans, venues, and promoters building the first iHYPE scene graph.',
      status: ShowStatus.SCHEDULED,
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      creatorId: promoterOwner.id,
      venueProfileId: venue.id,
      headlinerProfileId: artist.id,
      promoterProfileId: promoter.id,
      isTicketed: true,
      ticketPriceCents: 1200,
      ticketCapacity: 150,
      venuePayoutPercent: 50,
      artistPayoutPercent: 45,
      promoterPayoutPercent: 5,
      tags: ['launch', 'zero-fee', 'chicago'],
      hypeCount: 31
    }
  });

  await prisma.show.upsert({
    where: { slug: 'static-bloom-listening-room' },
    update: {
      status: ShowStatus.SCHEDULED,
      startsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      creatorId: artistOwner.id,
      venueProfileId: venue.id,
      headlinerProfileId: artist.id,
      hypeCount: 24
    },
    create: {
      slug: 'static-bloom-listening-room',
      title: 'Static Bloom Listening Room',
      description: 'A focused first-listen night for fans to seed the discovery graph with real attendance.',
      status: ShowStatus.SCHEDULED,
      startsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      creatorId: artistOwner.id,
      venueProfileId: venue.id,
      headlinerProfileId: artist.id,
      promoterProfileId: promoter.id,
      isTicketed: false,
      ticketPriceCents: 0,
      tags: ['listening-room', 'artist-seed'],
      hypeCount: 24
    }
  });

  await prisma.artistMediaAsset.upsert({
    where: { hexId: '0xlaunch000000000000000000000000000010' },
    update: {},
    create: {
      hexId: '0xlaunch000000000000000000000000000010',
      title: 'Static Bloom — Demo Track',
      originalFileName: 'static-bloom-demo.mp3',
      mimeType: 'audio/mpeg',
      fileSizeBytes: 0,
      storageProvider: 'external',
      storageUrl: 'https://ihype.org/seed/static-bloom-demo.mp3',
      freeUseEnabled: true,
      isPublished: true,
      profileId: artist.id
    }
  });

  console.log('Launch seed content upserted.');
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
