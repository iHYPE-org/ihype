import { createHash } from 'node:crypto';
import type { BrowserContext } from '@playwright/test';
import { PrismaClient, type Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { encode } from 'next-auth/jwt';

/**
 * Mints a real signed session for an e2e test instead of depending on a
 * hand-maintained session-cookie secret.
 *
 * Why this exists: mandatory authenticated coverage cannot depend on a token
 * copied from another environment. Each spec creates the least-privileged user
 * state it needs in the scratch database, then signs a short-lived cookie with
 * the same CI-only secret used by the Worker under test.
 *
 * The token shape is not guesswork: it mirrors `buildAuthSessionCookie`
 * (src/lib/auth-session.ts), which is what the app's own magic-link and passkey
 * sign-ins use. The claim that matters is `securityVersion` — `auth()`'s jwt
 * callback (src/lib/auth.ts) re-reads `User.userSecurityVersion` on every call
 * and returns null if it disagrees, so the value has to come from the row, not
 * a constant.
 *
 * Deliberately uses its own PrismaClient rather than `@/lib/db`: that module
 * imports the wasm/workerd query engine on purpose (see the comment at the top
 * of it), which cannot load in a plain Node test process. This client talks to
 * the same scratch database the workerd instance under test is pointed at,
 * over the node-postgres driver adapter — Prisma 7 rejects a bare
 * `new PrismaClient()`, and both `datasources` and `datasourceUrl` are gone,
 * so this mirrors prisma/seed.ts rather than inventing a third pattern.
 */

const COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60; // AUTH_SESSION_MAX_AGE_SECONDS

export type SeededUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export type ShellFixtureOptions = {
  /** Creator profiles to attach, which is what the drawer's role gates read. */
  profiles?: { type: 'ARTIST' | 'VENUE'; name: string }[];
  role?: Role;
};

function databaseUrl() {
  const url = process.env.E2E_WORKERD_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('E2E_WORKERD_DATABASE_URL (or DATABASE_URL) must be set to seed a session.');
  return url;
}

export function sessionCookieName() {
  return process.env.PLAYWRIGHT_AUTH_COOKIE_SECURE === 'true'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';
}

/**
 * Creates (or reuses) a user plus any requested creator profiles, and returns a
 * cookie value `auth()` will accept.
 */
export async function seedSessionCookie(
  email: string,
  options: ShellFixtureOptions = {},
): Promise<{ cookie: string; user: SeededUser }> {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET must be set to sign an e2e session.');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });
  try {
    const role: Role = options.role ?? 'FAN';
    const name = email.split('@')[0];
    // `username` is non-null and unique in the schema; derive it from the
    // address so re-running a spec reuses the same row instead of colliding.
    const username = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const user = await prisma.user.upsert({
      where: { email },
      update: { role },
      create: { email, name, username, role, emailVerified: new Date() },
      select: { id: true, email: true, name: true, role: true, userSecurityVersion: true, emailVerified: true },
    });

    for (const profile of options.profiles ?? []) {
      // Slug is derived from the user id so repeated runs are idempotent and
      // two concurrently-seeded users cannot collide on it.
      const slug = `e2e-${profile.type.toLowerCase()}-${user.id.slice(0, 8)}`;
      // hexId is non-null and unique too, and is what /invite/[hexId] and the
      // embed route look profiles up by. Derived from the same seed as the slug
      // so it is stable across runs.
      const hexId = `0x${createHash('sha256').update(slug).digest('hex').slice(0, 32)}`;
      await prisma.profile.upsert({
        where: { slug },
        update: {},
        create: { slug, hexId, name: profile.name, type: profile.type, ownerId: user.id, genres: [] },
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const cookieName = sessionCookieName();
    const cookie = await encode({
      token: {
        sub: user.id,
        name: user.name,
        email: user.email,
        picture: null,
        role: user.role,
        emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
        securityVersion: user.userSecurityVersion,
        iat: now,
        exp: now + COOKIE_MAX_AGE_SECONDS,
        jti: crypto.randomUUID(),
      },
      secret,
      // The salt MUST be the cookie name — NextAuth derives the encryption key
      // from (secret, salt), so a mismatch decodes to nothing and every request
      // silently 401s rather than erroring anywhere visible.
      salt: cookieName,
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });

    return {
      cookie,
      user: { id: user.id, email: user.email!, name: user.name!, role: user.role },
    };
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Seeds a session AND installs the cookie on a browser context.
 *
 * Every authenticated spec was hand-rolling this five-field object, and the
 * fields are not independent: when `PLAYWRIGHT_AUTH_COOKIE_SECURE` is true —
 * which `scripts/e2e-workerd.mjs` always sets — `sessionCookieName()` returns
 * the `__Secure-` prefixed name, and the prefix is only legal on a cookie that
 * actually carries `secure: true`. Omit the flag and Chromium rejects the whole
 * call with a bare "Protocol error (Storage.setCookies): Invalid cookie fields",
 * which names neither the field nor the reason. That cost a full CI run, so the
 * pairing now lives in one place instead of in each spec's private helper.
 *
 * `domain` is derived from the base URL rather than hardcoded to 'localhost',
 * so a spec cannot silently install a cookie the browser will never send.
 */
export async function applySessionCookie(
  context: BrowserContext,
  email: string,
  options: ShellFixtureOptions = {},
) {
  const seeded = await seedSessionCookie(email, options);
  const secure = process.env.PLAYWRIGHT_AUTH_COOKIE_SECURE === 'true';
  await context.addCookies([{
    name: sessionCookieName(),
    value: seeded.cookie,
    domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').hostname,
    path: '/',
    secure,
  }]);
  return seeded;
}

/** True when this environment can seed its own session. */
export function canSeedSession() {
  return Boolean(
    (process.env.E2E_WORKERD_DATABASE_URL || process.env.DATABASE_URL) &&
    (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
  );
}

/**
 * Seeds a real show and a real ticket for a user, so the surfaces that only
 * exist when a member HAS something can be asserted.
 *
 * Why this matters more than it looks: every ticket assertion in this suite was
 * previously written against an account with no tickets, so they could only
 * check that a section rendered and did not link out. Two real bugs shipped
 * straight through that gap — a ticket list sorted so attended shows sat above
 * upcoming ones, and a buy pane that passed no promoter, silently crediting
 * nobody from the 10% pool. Both are invisible without rows.
 *
 * Everything is upserted from a deterministic key so re-running a spec reuses
 * the same rows instead of piling up new ones.
 */
export type SeededShow = {
  showId: string;
  slug: string;
  title: string;
  serializedId: string;
  /**
   * The show's acts, so a spec can visit their profiles without re-deriving
   * the slug stamp. Recomputing `e2e-artist-${userId.slice(0,8)}-${key}` in a
   * spec would couple it to this function's private naming and break silently
   * the first time that naming changed.
   */
  artistSlug: string;
  venueSlug: string;
  /** The TicketOrder id. Both transfer endpoints are addressed by the ORDER,
   *  not by a ticket's serialized id — a transfer moves the whole order — so a
   *  spec that only had the serializedId could not reach them. */
  orderId: string;
};

export async function seedShowWithTicket({
  buyerUserId,
  buyerEmail,
  key = 'default',
  startsAt,
}: {
  buyerUserId: string;
  buyerEmail: string;
  /** Distinguishes multiple shows in one spec. */
  key?: string;
  /** Defaults to a week out, i.e. upcoming. Pass a past date for an attended one. */
  startsAt?: Date;
}): Promise<SeededShow> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });
  try {
    const stamp = `${buyerUserId.slice(0, 8)}-${key}`;
    const venueSlug = `e2e-venue-${stamp}`;
    const artistSlug = `e2e-artist-${stamp}`;
    const showSlug = `e2e-show-${stamp}`;
    const hex = (seed: string) => `0x${createHash('sha256').update(seed).digest('hex').slice(0, 32)}`;

    /**
     * The show's acts belong to an ORGANISER account, not to the buyer.
     *
     * They used to be `ownerId: buyerUserId`, which quietly turned the suite's
     * plain-fan account into the owner of an artist profile and a venue
     * profile. That is not a test detail: the drawer's role gates, ME's role
     * switcher and the HYPE link card all resolve from the member's own
     * `Profile` rows, so seeding a ticket silently changed what a fan sees
     * everywhere else in the suite. It surfaced as "a profile-less account
     * still renders ME, without a HYPE link card" failing — the account was
     * no longer profile-less.
     *
     * Buying a ticket must not make you an artist. Same in the fixture as in
     * the product.
     */
    const organiserEmail = `e2e-organiser+${stamp}@ihype.test`;
    const organiser = await prisma.user.upsert({
      where: { email: organiserEmail },
      update: {},
      create: {
        email: organiserEmail,
        name: 'E2E Organiser',
        username: `e2e-organiser-${stamp}`,
        role: 'ARTIST',
        emailVerified: new Date(),
      },
      select: { id: true },
    });

    const venue = await prisma.profile.upsert({
      where: { slug: venueSlug },
      update: {},
      create: {
        slug: venueSlug, hexId: hex(venueSlug), name: 'E2E Venue', type: 'VENUE',
        ownerId: organiser.id, genres: [], city: 'Portland', stateRegion: 'ME', country: 'US',
        discoverable: true,
      },
    });
    const artist = await prisma.profile.upsert({
      where: { slug: artistSlug },
      update: {},
      create: {
        slug: artistSlug, hexId: hex(artistSlug), name: 'E2E Artist', type: 'ARTIST',
        ownerId: organiser.id, genres: [], discoverable: true,
      },
    });

    // A real ticketed show: priced, with a split, so the buy pane and the split
    // bar both have something true to draw. The split is the charter's, which
    // is what the payout engine assumes when nothing overrides it.
    /* The title carries the KEY, and that is load-bearing rather than cosmetic.
       Every seeded show used to be called "E2E Night", so the moment a suite
       seeded two of them for one account — 'default' and 'attended' are both
       seeded by mmm-shell — `locator('.mmm-ticket-row', { hasText: seeded.title })`
       matched two rows and failed on strict mode. It passed in CI only because a
       fresh database happens to reach the first assertion before the second show
       exists; on any database that has run the suite before, it failed and read
       as a broken ticket list. No test hardcodes the literal, they all use the
       returned `title`, so a distinct one per key costs nothing.

       `startsAt` is restored on update too: a suite seeding the same key with a
       past date for an attended ticket would otherwise keep whatever the first
       run wrote. */
    const showTitle = `E2E Night ${key}`;
    const showStartsAt = startsAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const show = await prisma.show.upsert({
      where: { slug: showSlug },
      update: { title: showTitle, startsAt: showStartsAt },
      create: {
        slug: showSlug,
        title: showTitle,
        startsAt: showStartsAt,
        creatorId: buyerUserId,
        venueProfileId: venue.id,
        headlinerProfileId: artist.id,
        status: 'SCHEDULED',
        isTicketed: true,
        ticketPriceCents: 1800,
        ticketCapacity: 100,
        venuePayoutPercent: 20,
        artistPayoutPercent: 70,
        promoterPayoutPercent: 10,
      },
    });

    const confirmationCode = `E2E-${stamp}`.toUpperCase().slice(0, 24);
    /* The update clause RESTORES the state this fixture promises, rather than
       leaving whatever a previous run did. It used to be `{}`, which made the
       seed idempotent only on a virgin database: the ticket-transfer suite
       claims an order, which moves buyerUserId to the claiming account
       permanently, so the next run on the same database re-used an order the
       seeded buyer no longer owned and the transfer panel correctly refused to
       render. A seed that silently means something different on a second run is
       worse than one that fails. */
    const order = await prisma.ticketOrder.upsert({
      where: { confirmationCode },
      update: {
        buyerUserId,
        buyerEmail,
        status: 'CAPTURED',
        transferredAt: null,
        transferredToEmail: null,
      },
      create: {
        confirmationCode,
        showId: show.id,
        buyerUserId,
        buyerName: 'E2E Buyer',
        buyerEmail,
        quantity: 1,
        subtotalCents: 1800,
        // The buyer pays Stripe's fee; iHYPE absorbs none of it. Seeded so the
        // ticket sheet's money lines have the same shape production produces.
        processingFeeCents: 85,
        totalChargeCents: 1885,
        venuePayoutCents: 360,
        artistPayoutCents: 1260,
        promoterPayoutCents: 180,
        status: 'CAPTURED',
      },
    });

    const serializedId = `IHY-${createHash('sha256').update(confirmationCode).digest('hex').slice(0, 8).toUpperCase()}`;
    /* Cleared and recreated rather than upserted on serializedId, because a
       TRANSFER rotates that id: after one, no row carries the canonical value,
       so an upsert cannot find it and adds a SECOND ticket to the same order
       instead. Two runs left two tickets; three left three, each with a
       different id and all of them valid. */
    await prisma.ticket.deleteMany({ where: { ticketOrderId: order.id } });
    await prisma.ticket.create({
      data: {
        serializedId,
        ticketOrderId: order.id,
        showId: show.id,
        venueProfileId: venue.id,
        holderName: 'E2E Buyer',
        holderEmail: buyerEmail,
        status: 'VALID',
      },
    });

    return { showId: show.id, slug: show.slug, title: show.title, serializedId, artistSlug, venueSlug, orderId: order.id };
  } finally {
    await prisma.$disconnect();
  }
}

export type SeededMedia = {
  /** The `hexId` — what `/app/tracks/[hexId]` and `/embed/[hexId]` look up by. */
  hexId: string;
  title: string;
  /** A FanPlaylist id, for `/app/playlists/[id]`. */
  playlistId: string;
  playlistName: string;
};

/**
 * Seeds a published track and a playlist containing it.
 *
 * Exists because the track and playlist panes could not be covered without it:
 * `seedShowWithTicket` creates profiles, a show and a ticket but no
 * `ArtistMediaAsset` and no `FanPlaylist`, so there was no id to visit. Those
 * two panes therefore shipped with no browser coverage at all — and the other
 * two, which DID get covered, turned out to render nothing.
 *
 * The track is attached to the caller's own ARTIST profile so this needs no
 * second account, and everything is upserted from a deterministic key so
 * re-running a spec reuses the rows instead of multiplying them.
 */
export async function seedTrackAndPlaylist({
  userId,
  key = 'default',
}: {
  userId: string;
  key?: string;
}): Promise<SeededMedia> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });
  try {
    const stamp = `${userId.slice(0, 8)}-${key}`;
    const profileSlug = `e2e-media-artist-${stamp}`;
    const hex = (seed: string) => `0x${createHash('sha256').update(seed).digest('hex').slice(0, 32)}`;

    const profile = await prisma.profile.upsert({
      where: { slug: profileSlug },
      update: {},
      create: {
        slug: profileSlug,
        hexId: hex(profileSlug),
        name: 'E2E Media Artist',
        type: 'ARTIST',
        ownerId: userId,
        genres: ['Indie'],
      },
      select: { id: true, name: true },
    });

    const trackHex = hex(`${profileSlug}-track`);
    const track = await prisma.artistMediaAsset.upsert({
      where: { hexId: trackHex },
      update: { isPublished: true },
      create: {
        hexId: trackHex,
        title: 'E2E Test Track',
        // `isPublished` defaults true, but the pane filters on it explicitly,
        // so it is stated rather than inherited.
        isPublished: true,
        originalFileName: 'e2e-test-track.mp3',
        mimeType: 'audio/mpeg',
        fileSizeBytes: 1024,
        durationSecs: 123,
        profileId: profile.id,
      },
      select: { hexId: true, title: true },
    });

    // FanPlaylist has no natural unique key, so it is looked up by
    // (userId, name) and created only when absent — an upsert would need a
    // compound unique the schema does not declare.
    const playlistName = `E2E Playlist ${stamp}`;
    let playlist = await prisma.fanPlaylist.findFirst({
      where: { userId, name: playlistName },
      select: { id: true, name: true },
    });
    if (!playlist) {
      playlist = await prisma.fanPlaylist.create({
        data: {
          userId,
          name: playlistName,
          items: {
            create: [{
              mediaId: track.hexId,
              title: track.title,
              artistName: profile.name,
              url: `/api/public-media/${track.hexId}`,
              position: 0,
            }],
          },
        },
        select: { id: true, name: true },
      });
    }

    return {
      hexId: track.hexId,
      title: track.title,
      playlistId: playlist.id,
      playlistName: playlist.name,
    };
  } finally {
    await prisma.$disconnect();
  }
}
