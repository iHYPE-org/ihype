#!/usr/bin/env node
/**
 * Fills an empty platform with believable content, so every surface can be
 * LOOKED AT before there are real members on it.
 *
 * Production has one user, two profiles and zero shows. That is correct for a
 * pre-launch invite-only platform, and it also means discover, the map, the
 * charts, a venue calendar and an artist page all render as blank frames —
 * so nobody can tell a working screen from a broken one, which is exactly the
 * position this was written to get out of.
 *
 * ## Everything it writes lives under one reserved namespace
 *
 * Users are `<slug>@preview.ihype.org`, usernames are `preview-<slug>`, and
 * every profile slug starts `preview-`. That is not cosmetic:
 *
 *   - It cannot collide with a real member. `@preview.ihype.org` is a
 *     subdomain the platform controls and never issues addresses on, and
 *     `isReservedPlatformEmail` already keeps signups off `@ihype.org`.
 *   - It makes removal exact. `--remove` deletes precisely this namespace and
 *     nothing else, so seeded content can never become content nobody dares
 *     delete because they cannot tell it from the real thing.
 *
 * ## Why not the existing demo-user mechanism
 *
 * `runtime-flags.ts` has one, and it is the wrong tool here. `demoIdentifiers`
 * is a fixed list of four addresses (fan/artist/promoter/venue@ihype.org), and
 * `shouldHideDemoContent()` HIDES them in production whenever demo logins are
 * off — which is the default. Seeding into that namespace would put content in
 * the database that the production site then refuses to show, which is the
 * opposite of the point. This namespace is deliberately outside that filter,
 * so what is seeded is what is seen.
 *
 * ## It is additive and idempotent
 *
 * Every write is an upsert on a deterministic slug, so running it twice
 * changes nothing the second time, and it never touches a row it did not
 * create. It does not alter `User.role` for anyone, and it creates no
 * credentials — these accounts have no passkey and no session, so none of them
 * can be signed into.
 *
 *     DATABASE_URL='postgres://…' node scripts/seed-preview-content.mjs
 *     DATABASE_URL='postgres://…' node scripts/seed-preview-content.mjs --remove
 *
 * Portland, Maine, because that is where iHYPE is from and a map with pins in
 * one real scene reads as a product rather than as lorem ipsum.
 */

import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const PREVIEW_DOMAIN = 'preview.ihype.org';
const PREVIEW_PREFIX = 'preview-';
const REMOVE = process.argv.includes('--remove');

const hexFor = (seed) => `0x${createHash('sha256').update(seed).digest('hex').slice(0, 32)}`;
const email = (slug) => `${slug}@${PREVIEW_DOMAIN}`;
const day = 24 * 60 * 60 * 1000;

function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required. Point it at the database you mean to seed.');
    process.exit(1);
  }
  return url;
}

/** Real venues are a scene's skeleton, so these carry real Portland geography. */
const VENUES = [
  { slug: 'state-theatre', name: 'State Theatre', city: 'Portland', region: 'ME', lat: 43.6549, lng: -70.2653, capacity: 1800, bio: 'Congress Street landmark. Touring acts, balcony seating, the best sightlines in the city.' },
  { slug: 'port-city-music-hall', name: 'Port City Music Hall', city: 'Portland', region: 'ME', lat: 43.6567, lng: -70.2620, capacity: 500, bio: 'Three floors, standing room, the room most Portland bands play first.' },
  { slug: 'sun-tiki-studios', name: 'Sun Tiki Studios', city: 'Portland', region: 'ME', lat: 43.6591, lng: -70.2568, capacity: 120, bio: 'DIY room on Free Street. All ages, all genres, run by the people who play in it.' },
  { slug: 'blue', name: 'Blue', city: 'Portland', region: 'ME', lat: 43.6571, lng: -70.2559, capacity: 60, bio: 'Congress Street listening room. Jazz, folk, and quiet enough to hear it.' },
  { slug: 'oxbow-blending', name: 'Oxbow Blending & Bottling', city: 'Portland', region: 'ME', lat: 43.6520, lng: -70.2470, capacity: 250, bio: 'Brewery taproom on Washington Ave with a stage in the back.' },
];

const ARTISTS = [
  { slug: 'harbor-lights', name: 'Harbor Lights', genres: ['indie rock', 'dream pop'], bio: 'Four-piece from Munjoy Hill. Reverb, tide charts, and songs about leaving.' },
  { slug: 'the-longshoremen', name: 'The Longshoremen', genres: ['folk', 'americana'], bio: 'Working songs from the working waterfront. Upright bass, three-part harmony.' },
  { slug: 'casco-static', name: 'Casco Static', genres: ['post-punk', 'noise'], bio: 'Loud, fast, and over in twenty-two minutes. No encores.' },
  { slug: 'maren-vale', name: 'Maren Vale', genres: ['singer-songwriter'], bio: 'Piano, one microphone, and a room that goes quiet on its own.' },
  { slug: 'north-atlantic-drift', name: 'North Atlantic Drift', genres: ['electronic', 'ambient'], bio: 'Modular synths and field recordings from the Eastern Prom.' },
  { slug: 'the-brine', name: 'The Brine', genres: ['garage rock'], bio: 'Two guitars, no bass, and a drummer who will not slow down.' },
  { slug: 'ada-quinn', name: 'Ada Quinn', genres: ['soul', 'r&b'], bio: 'Big voice, small rooms. Backed by whoever is in town that week.' },
  { slug: 'fathom-line', name: 'Fathom Line', genres: ['post-rock'], bio: 'Instrumental. Long build, longer payoff.' },
];

/** Track titles per artist slug, so a page has a real crate rather than "Track 1". */
const TRACKS = {
  'harbor-lights': ['Tide Chart', 'Munjoy Hill', 'Every Ferry Out', 'Slack Water'],
  'the-longshoremen': ['Container Ship', 'Six on the Pier', 'Union Hall'],
  'casco-static': ['Twenty-Two Minutes', 'No Encores', 'Free Street'],
  'maren-vale': ['Quiet Room', 'One Microphone', 'The Long Way Round', 'Winter Light'],
  'north-atlantic-drift': ['Eastern Prom', 'Fog Signal', 'Drift'],
  'the-brine': ['No Bass', 'Faster', 'Salt'],
  'ada-quinn': ['Small Rooms', 'Whoever Is In Town', 'Back Bay'],
  'fathom-line': ['Long Build', 'Sounding', 'Fathom'],
};

const SHOW_TITLES = [
  'Harbor Lights + The Brine',
  'The Longshoremen — Album Release',
  'Casco Static / Fathom Line',
  'Maren Vale, solo',
  'North Atlantic Drift — Late Set',
  'Ada Quinn and the Back Bay Revue',
  'Winter Warmer: Four Bands, One Night',
  'Fathom Line — Instrumental Showcase',
];

async function removeAll(prisma) {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${PREVIEW_DOMAIN}` } },
    select: { id: true },
  });
  if (users.length === 0) {
    console.log('Nothing to remove — no preview accounts found.');
    return;
  }
  const ids = users.map((u) => u.id);
  // Shows are removed explicitly because their creator relation cascades but
  // the venue/headliner relations do not, and a show left pointing at a
  // deleted profile is worse than one that is simply gone.
  const shows = await prisma.show.deleteMany({ where: { slug: { startsWith: PREVIEW_PREFIX } } });
  const profiles = await prisma.profile.deleteMany({ where: { slug: { startsWith: PREVIEW_PREFIX } } });
  const deleted = await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`Removed ${deleted.count} preview accounts, ${profiles.count} profiles, ${shows.count} shows.`);
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });
  try {
    if (REMOVE) {
      await removeAll(prisma);
      return;
    }

    const now = Date.now();
    const venueProfiles = [];
    const artistProfiles = [];
    const previewUserIds = [];
    const trackIds = [];

    for (const venue of VENUES) {
      const slug = `${PREVIEW_PREFIX}${venue.slug}`;
      const owner = await prisma.user.upsert({
        where: { email: email(venue.slug) },
        update: {},
        create: {
          email: email(venue.slug),
          name: venue.name,
          username: `${PREVIEW_PREFIX}${venue.slug}`.slice(0, 30),
          role: 'FAN',
          emailVerified: new Date(),
          isThirteenOrOlder: true,
        },
        select: { id: true },
      });
      previewUserIds.push(owner.id);
      const profile = await prisma.profile.upsert({
        where: { slug },
        update: {},
        create: {
          slug,
          hexId: hexFor(slug),
          name: venue.name,
          type: 'VENUE',
          ownerId: owner.id,
          genres: [],
          bio: venue.bio,
          city: venue.city,
          stateRegion: venue.region,
          country: 'US',
          latitude: venue.lat,
          longitude: venue.lng,
          capacity: venue.capacity,
          // Verified so they render as a real venue would, rather than
          // filling the moderation queue with work nobody asked for.
          verificationStatus: 'VERIFIED',
        },
        select: { id: true, name: true },
      });
      venueProfiles.push(profile);
    }

    for (const artist of ARTISTS) {
      const slug = `${PREVIEW_PREFIX}${artist.slug}`;
      const owner = await prisma.user.upsert({
        where: { email: email(artist.slug) },
        update: {},
        create: {
          email: email(artist.slug),
          name: artist.name,
          username: `${PREVIEW_PREFIX}${artist.slug}`.slice(0, 30),
          role: 'FAN',
          emailVerified: new Date(),
          isThirteenOrOlder: true,
        },
        select: { id: true },
      });
      previewUserIds.push(owner.id);
      const profile = await prisma.profile.upsert({
        where: { slug },
        update: {},
        create: {
          slug,
          hexId: hexFor(slug),
          name: artist.name,
          type: 'ARTIST',
          ownerId: owner.id,
          genres: artist.genres,
          bio: artist.bio,
          city: 'Portland',
          stateRegion: 'ME',
          country: 'US',
          latitude: 43.6591 + (Math.random() - 0.5) * 0.02,
          longitude: -70.2568 + (Math.random() - 0.5) * 0.02,
          verificationStatus: 'VERIFIED',
          hypeCount: 12 + Math.floor(Math.random() * 180),
        },
        select: { id: true, name: true },
      });
      artistProfiles.push(profile);

      for (const [index, title] of (TRACKS[artist.slug] ?? []).entries()) {
        const trackSeed = `${slug}-${index}`;
        const track = await prisma.artistMediaAsset.upsert({
          where: { hexId: hexFor(trackSeed) },
          update: {},
          create: {
            hexId: hexFor(trackSeed),
            profileId: profile.id,
            title,
            // No audio bytes and no storage URL: this is a catalogue to LOOK
            // at, and inventing a playable file the player would 404 on would
            // make the surface less honest, not more complete.
            originalFileName: `${trackSeed}.mp3`,
            mimeType: 'audio/mpeg',
            fileSizeBytes: 0,
            durationSecs: 150 + Math.floor(Math.random() * 130),
            sortOrder: index,
            isPublished: true,
          },
          select: { id: true },
        });
        trackIds.push(track.id);
      }
    }

    // Shows: some past so a venue calendar and an artist page have history,
    // most upcoming so discover and the map have something to show.
    for (const [index, title] of SHOW_TITLES.entries()) {
      const slug = `${PREVIEW_PREFIX}show-${index}`;
      const venue = venueProfiles[index % venueProfiles.length];
      const artist = artistProfiles[index % artistProfiles.length];
      const offsetDays = index < 2 ? -(index + 3) : index * 4 - 4;
      const owner = await prisma.user.findUniqueOrThrow({
        where: { email: email(VENUES[index % VENUES.length].slug) },
        select: { id: true },
      });
      await prisma.show.upsert({
        where: { slug },
        update: {},
        create: {
          slug,
          title,
          status: offsetDays < 0 ? 'ENDED' : 'SCHEDULED',
          startsAt: new Date(now + offsetDays * day),
          creatorId: owner.id,
          venueProfileId: venue.id,
          headlinerProfileId: artist.id,
          isTicketed: true,
          ticketPriceCents: [1200, 1500, 1800, 2200, 2500][index % 5],
          ticketCapacity: 120 + index * 40,
          ticketsSoldCount: Math.floor(Math.random() * 90),
          hypeCount: Math.floor(Math.random() * 60),
          featured: index === 0,
          description: `${artist.name} at ${venue.name}. Doors 8pm.`,
        },
      });
    }

    /**
     * Engagement. Without this the catalogue exists and the surfaces that RANK
     * it are still blank, which is the half that was missing: profiles, tracks
     * and shows were seeded, and `/app/music/charts` stayed empty because
     * nothing ranks a track except a hype.
     *
     * `Seed` does double duty in this schema. A row means "this member has
     * already acted on this track", which is what keeps it out of their own
     * discover deck — and a row with `action: 'hype'` is ALSO the only input
     * `/api/charts` has. Seeding hypes from preview accounts therefore fills
     * the charts without touching any real member's deck, because the deck
     * filter is scoped to the viewer's own rows.
     *
     * **These rows are re-dated on every run, and that is the point.** Charts
     * only counts hypes from the last 7 days (`since` in `/api/charts`), so a
     * one-shot seed would light the charts up and then silently empty them a
     * week later — the exact "why is it blank again" this script exists to
     * prevent. `update` refreshes `createdAt`, so re-running is a refresh.
     */
    const hypeSpread = [];
    for (const [trackIndex, mediaId] of trackIds.entries()) {
      // A deterministic, decreasing number of hypers per track, so the chart
      // has a real ranking rather than 26 tracks tied on one hype each.
      const hypers = Math.max(1, previewUserIds.length - Math.floor(trackIndex / 2));
      for (let u = 0; u < hypers; u++) {
        const userId = previewUserIds[(trackIndex + u) % previewUserIds.length];
        hypeSpread.push({ userId, mediaId, trackIndex, u });
      }
    }
    for (const { userId, mediaId, trackIndex, u } of hypeSpread) {
      // Spread across the last six days, never in the future and never older
      // than the seven-day chart window.
      const createdAt = new Date(now - (((trackIndex + u) % 6) * day + 3600_000));
      await prisma.seed.upsert({
        where: { userId_mediaId: { userId, mediaId } },
        update: { createdAt, action: 'hype' },
        create: { userId, mediaId, action: 'hype', createdAt },
      });
    }

    // Profile-level hype and follows: what makes an artist page read as
    // followed-by-somebody, and what the station context reads for its
    // personalised kinds.
    for (const [artistIndex, artist] of artistProfiles.entries()) {
      const supporters = Math.max(2, previewUserIds.length - artistIndex);
      for (let u = 0; u < supporters; u++) {
        const userId = previewUserIds[(artistIndex + u) % previewUserIds.length];
        await prisma.profileHypeEvent.upsert({
          where: { userId_profileId: { userId, profileId: artist.id } },
          update: {},
          create: { userId, profileId: artist.id },
        });
        await prisma.follow.upsert({
          where: { followerId_followeeProfileId: { followerId: userId, followeeProfileId: artist.id } },
          update: {},
          create: { followerId: userId, followeeProfileId: artist.id },
        });
      }
    }

    const counts = {
      previewUsers: await prisma.user.count({ where: { email: { endsWith: `@${PREVIEW_DOMAIN}` } } }),
      profiles: await prisma.profile.count({ where: { slug: { startsWith: PREVIEW_PREFIX } } }),
      tracks: await prisma.artistMediaAsset.count({ where: { profile: { slug: { startsWith: PREVIEW_PREFIX } } } }),
      shows: await prisma.show.count({ where: { slug: { startsWith: PREVIEW_PREFIX } } }),
      chartHypes: await prisma.seed.count({ where: { action: 'hype', user: { email: { endsWith: `@${PREVIEW_DOMAIN}` } } } }),
      profileHypes: await prisma.profileHypeEvent.count({ where: { profile: { slug: { startsWith: PREVIEW_PREFIX } } } }),
      follows: await prisma.follow.count({ where: { followeeProfile: { slug: { startsWith: PREVIEW_PREFIX } } } }),
    };
    console.log(JSON.stringify(counts, null, 2));
    console.log('\nRemove it all again with: node scripts/seed-preview-content.mjs --remove');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
