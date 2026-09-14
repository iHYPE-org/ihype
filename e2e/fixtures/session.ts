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
  /** Creator profiles to attach, which is what the drawer's role gates read.
   * `verified` stamps VERIFIED — the upload gate (POST /api/artist-media)
   * 403s an UNVERIFIED profile, so a spec exercising upload must seed a
   * profile that has passed the gate the product really enforces. */
  profiles?: { type: 'ARTIST' | 'VENUE'; name: string; verified?: boolean }[];
  role?: Role;
  /** Starting HYPE balance. `User.hypeBalance` defaults to 0 and
   * `applyHypeEntry` refuses a spend it cannot cover, so a freshly seeded
   * member CANNOT hype anything — a spec that wants the success path has to
   * say so, and a spec that wants the refusal path gets it by saying nothing.
   * Both are real states and both are worth testing. */
  hypeBalance?: number;
  /** An advertiser account, and campaigns on it.
   *
   * NOTHING in this repository seeded one until 2026-09-13, so the advertiser
   * dashboard's POPULATED state — five stat cards, the 14-day chart and the
   * campaign rows, the surface where a paying customer reads what they were
   * charged — had never been rendered by any instrument. `audit:mounts` cannot
   * see it (the page is mounted), and `measure:layout` reached the route and
   * measured the empty state.
   *
   * Every date here is PINNED by the CALLER for the reason row 403 records:
   * the page renders them through `toLocaleDateString`, so a campaign seeded
   * at `now - 7 days` measures two different strings in two runs an hour
   * apart. Impressions are deliberately NOT seeded — the chart buckets the
   * last 14 days against `Date.now()`, and with no rows every bar is the
   * 2px floor, which is the only bar height that does not depend on when the
   * capture ran. */
  advertiser?: {
    companyName: string;
    pitch?: string;
    website?: string;
    campaigns?: SeedAdCampaign[];
  };
};

export type SeedAdCampaign = {
  title: string;
  status: string;
  pricingModel: 'SPONSORSHIP' | 'METERED';
  budgetCents: number;
  spentCents?: number;
  impressions?: number;
  clickUrl?: string;
  createdAt: Date;
  startsAt?: Date;
  endsAt?: Date;
  authorizedAt?: Date;
  settledAt?: Date;
  settledChargedCents?: number;
  refundedCents?: number;
  stripeRefundId?: string;
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
export type SeededProfile = { id: string; slug: string; name: string; type: 'ARTIST' | 'VENUE' };

export async function seedSessionCookie(
  email: string,
  options: ShellFixtureOptions = {},
): Promise<{ cookie: string; user: SeededUser; profiles: SeededProfile[] }> {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET must be set to sign an e2e session.');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });
  try {
    const role: Role = options.role ?? 'FAN';
    const name = email.split('@')[0];
    // `username` is non-null and unique in the schema; derive it from the
    // address so re-running a spec reuses the same row instead of colliding.
    const username = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    // The balance is written on UPDATE as well as CREATE, deliberately: a
    // rerun's existing row has already spent whatever the last run gave it, so
    // create-only seeding passes the first time and fails ever after.
    const balance = options.hypeBalance === undefined ? {} : { hypeBalance: options.hypeBalance };
    const user = await prisma.user.upsert({
      where: { email },
      update: { role, ...balance },
      create: { email, name, username, role, emailVerified: new Date(), ...balance },
      select: { id: true, email: true, name: true, role: true, userSecurityVersion: true, emailVerified: true },
    });

    const seededProfiles: SeededProfile[] = [];
    for (const profile of options.profiles ?? []) {
      // Slug is derived from the user id so repeated runs are idempotent and
      // two concurrently-seeded users cannot collide on it.
      const slug = `e2e-${profile.type.toLowerCase()}-${user.id.slice(0, 8)}`;
      // hexId is non-null and unique too, and is what /invite/[hexId] and the
      // embed route look profiles up by. Derived from the same seed as the slug
      // so it is stable across runs.
      const hexId = `0x${createHash('sha256').update(slug).digest('hex').slice(0, 32)}`;
      const verification = profile.verified ? { verificationStatus: 'VERIFIED' as const } : {};
      const row = await prisma.profile.upsert({
        where: { slug },
        // The update must carry the verification too: an upsert that only
        // creates it leaves a rerun's existing row unverified, and the spec
        // fails only on the second run — the worst kind of flake.
        update: { ...verification },
        create: { slug, hexId, name: profile.name, type: profile.type, ownerId: user.id, genres: [], ...verification },
        select: { id: true, slug: true, name: true, type: true },
      });
      seededProfiles.push({ id: row.id, slug: row.slug, name: row.name, type: profile.type });
    }

    if (options.advertiser) {
      /* One shared slot rather than one per run: `AdSlot` is platform
         inventory, not per-advertiser, and a row per seeded user would grow
         the scratch database without measuring anything new. Upserted by a
         fixed id so a rerun reuses it. */
      const slot = await prisma.adSlot.upsert({
        where: { id: 'e2e-ad-slot' },
        update: {},
        create: { id: 'e2e-ad-slot', name: 'E2E Station Break', active: true },
        select: { id: true },
      });
      await prisma.advertiserAccount.upsert({
        where: { userId: user.id },
        update: {
          companyName: options.advertiser.companyName,
          pitch: options.advertiser.pitch ?? null,
          website: options.advertiser.website ?? null,
        },
        create: {
          userId: user.id,
          companyName: options.advertiser.companyName,
          contactName: user.name,
          pitch: options.advertiser.pitch ?? null,
          website: options.advertiser.website ?? null,
        },
      });
      for (const [index, campaign] of (options.advertiser.campaigns ?? []).entries()) {
        // Deterministic id, same reason as the profile slug above: a rerun
        // updates its own row instead of adding a second campaign, which
        // would make every capture of this page a different length.
        const id = `e2e-ad-${user.id.slice(0, 8)}-${index}`;
        const data = {
          slotId: slot.id,
          advertiserId: user.id,
          title: campaign.title,
          status: campaign.status,
          pricingModel: campaign.pricingModel,
          budgetCents: campaign.budgetCents,
          spentCents: campaign.spentCents ?? 0,
          impressions: campaign.impressions ?? 0,
          clickUrl: campaign.clickUrl ?? null,
          createdAt: campaign.createdAt,
          startsAt: campaign.startsAt ?? null,
          endsAt: campaign.endsAt ?? null,
          authorizedAt: campaign.authorizedAt ?? null,
          settledAt: campaign.settledAt ?? null,
          settledChargedCents: campaign.settledChargedCents ?? null,
          refundedCents: campaign.refundedCents ?? null,
          stripeRefundId: campaign.stripeRefundId ?? null,
        };
        await prisma.ad.upsert({ where: { id }, update: data, create: { id, ...data } });
      }
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
      /* The seeded profiles, so a spec can reach one WITHOUT recomputing
       * `e2e-artist-${userId.slice(0,8)}` for itself. That recomputation
       * couples a spec to this function's private naming, and it breaks
       * silently — a wrong slug is a 404, which reads as "the page is gone"
       * rather than "the test built the wrong URL". Needed the moment a spec
       * has to reach SOMEONE ELSE's profile: HYPE refuses your own
       * (`/api/hype` answers 409 "You cannot HYPE your own profile"), so a
       * hype test cannot use the signed-in member's own page. */
      profiles: seededProfiles,
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
  orderCreatedAt,
}: {
  buyerUserId: string;
  buyerEmail: string;
  /** Distinguishes multiple shows in one spec. */
  key?: string;
  /** Defaults to a week out, i.e. upcoming. Pass a past date for an attended one. */
  startsAt?: Date;
  /**
   * When the order was placed. Defaults to the moment of seeding.
   *
   * `/shows/[slug]` draws a demand sparkline: ticket orders from the last 12
   * hours, bucketed into 8 windows measured back from `Date.now()`. So an order
   * seeded once MIGRATES from bar to bar as real time passes — every 90 minutes
   * it crosses a boundary and two of the eight bars swap height and colour.
   * That is correct for the product and poison for anything comparing two
   * captures of the page, which is why `measure-layout.mts` pins this outside
   * the window.
   */
  orderCreatedAt?: Date;
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
    /* On sale, and this fixture is why the closed-ticketing bug survived so
       long. `isTicketingOpen()` reads `ticketingOpensAt` and a null means NOT
       on sale; every show this fixture had ever built was ticketed with a null,
       so `TicketSaleCard` rendered no form and the purchase route would have
       answered 409 — under a suite where nothing asserts on either, because the
       specs that use this seed are about a ticket somebody already holds. A
       fixture that cannot buy a ticket cannot notice that nobody can. */
    const ticketingOpensAt = new Date(
      Math.min(Date.now(), showStartsAt.getTime() - 14 * 24 * 60 * 60 * 1000),
    );
    const show = await prisma.show.upsert({
      where: { slug: showSlug },
      update: { title: showTitle, startsAt: showStartsAt, ticketingOpensAt },
      create: {
        slug: showSlug,
        title: showTitle,
        startsAt: showStartsAt,
        ticketingOpensAt,
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
        /* Restored on update for the same reason `startsAt` is: a caller that
           asks for a pinned instant must get one on the second run too. */
        ...(orderCreatedAt ? { createdAt: orderCreatedAt } : {}),
      },
      create: {
        confirmationCode,
        showId: show.id,
        buyerUserId,
        buyerName: 'E2E Buyer',
        buyerEmail,
        ...(orderCreatedAt ? { createdAt: orderCreatedAt } : {}),
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
 * A playable track the signed-in FAN will actually hear on their default
 * station — and nothing else in this file seeded one until 2026-09-14.
 *
 * The dock's last-resort transport and the Radio tab both start
 * `defaultStationSlug()`, the FIRST station `/api/stations` lists, which is
 * `for-you`; and `for_you` is `profileId in hypedProfileIds` (src/lib/stations.ts),
 * so a freshly seeded fan with no hypes gets an EMPTY default station by
 * construction. `e2e/mmm-shell.spec.ts`'s "a surface's own play control loads
 * the mini player" tests read that emptiness and skipped — on every surface,
 * on every CI run since they were written (DESIGN_SYNC row 434). The transport
 * wire CLAUDE.md calls "the one most easily lost in a chrome rewrite" had
 * therefore never been proven by the mandatory suite.
 *
 * So this seeds the three rows that make `for-you` non-empty for ONE fan: an
 * artist (its own owner, so the fan is not hyping their own profile — which
 * `/api/hype` refuses and which `discover/seeds` excludes), a released track
 * with a `storageUrl` (the recommend route and the station row both require
 * one), and the fan's `ProfileHypeEvent` on that artist. Deterministic keys, so
 * a rerun reuses the rows. Give each spec that needs it its OWN fan email:
 * the hype is a taste signal, and a spec asserting a cold fan's empty state
 * must not share a fan with one that warmed it.
 */
/** A real, small, static audio file the worker serves: the deck, the station
 *  row and the recommend list all hand `storageUrl` straight to <audio>.
 *  ABSOLUTE, as every stored `storageUrl` is (`https://ihype.org/cdn/…`), so
 *  the fixture carries the shape production does. The listen route no longer
 *  refuses a relative `mediaUrl` — its old `.url()` check was one of the 400s
 *  row 436 found — but a fixture should not depend on that leniency. */
const STATION_TRACK_URL = new URL('/audio/samples/signal-chime.wav', process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8787').toString();
const STATION_CITY = 'Portland';
const STATION_REGION = 'ME';
const STATION_COUNTRY = 'US';

export async function seedPlayableStation({
  fanUserId,
  key = 'default',
}: {
  fanUserId: string;
  key?: string;
}): Promise<{ trackHexId: string; title: string; artistName: string; artistSlug: string; playlistId: string; neighbourTitle: string }> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });
  try {
    const stamp = `station-${key}`;
    const hex = (seed: string) => `0x${createHash('sha256').update(seed).digest('hex').slice(0, 32)}`;
    const ownerEmail = `e2e-${stamp}-artist@ihype.test`;
    const owner = await prisma.user.upsert({
      where: { email: ownerEmail },
      update: {},
      create: { email: ownerEmail, name: 'E2E Station Artist', username: `e2e-${stamp}-artist`, role: 'ARTIST', emailVerified: new Date() },
      select: { id: true },
    });
    const slug = `e2e-${stamp}-artist`;
    const profile = await prisma.profile.upsert({
      where: { slug },
      create: {
        slug, hexId: hex(slug), name: 'E2E Station Artist', type: 'ARTIST', ownerId: owner.id, discoverable: true,
        // A genre with a GENRE STATION (src/lib/stations.ts): the Radio tab opens
        // on its Genre filter, so this is what puts an enabled station under the
        // member's thumb on arrival.
        genres: ['Dream-pop'],
        // Placed, so the AREA chart's `local` scope — the Charts tab's default —
        // has a candidate when the listener is placed in the same city.
        city: STATION_CITY, stateRegion: STATION_REGION, country: STATION_COUNTRY,
      },
      update: { discoverable: true, genres: ['Dream-pop'], city: STATION_CITY, stateRegion: STATION_REGION, country: STATION_COUNTRY },
      select: { id: true, name: true, slug: true },
    });
    const trackHex = hex(`${slug}-track`);
    const track = await prisma.artistMediaAsset.upsert({
      where: { hexId: trackHex },
      // Released, and playable: the station row's `mediaUrl` IS `storageUrl`,
      // and the player hands it to an <audio> element as-is — so it has to be
      // a URL the worker really serves bytes from. A first draft pointed it at
      // `/api/public-media/<hex>`, which resolves the SAME row's storageUrl and
      // fetches it upstream: a route pointing at itself.
      update: { isPublished: true, publishAt: null, storageUrl: STATION_TRACK_URL },
      create: {
        hexId: trackHex,
        title: 'E2E Station Track',
        isPublished: true,
        originalFileName: 'e2e-station-track.wav',
        mimeType: 'audio/wav',
        fileSizeBytes: 1024,
        durationSecs: 123,
        storageUrl: STATION_TRACK_URL,
        profileId: profile.id,
      },
      select: { id: true, hexId: true, title: true },
    });
    await prisma.profileHypeEvent.upsert({
      where: { userId_profileId: { userId: fanUserId, profileId: profile.id } },
      update: {},
      create: { userId: fanUserId, profileId: profile.id },
    });
    /* The Charts tab ranks by Seed hypes inside its window and, on its default
       `local` scope, only for a viewer whose FIRST profile carries a city — so
       the listener gets a placed LISTENER profile and one deck hype on the
       track. Both are ordinary member state, not chart fixtures: a fan who has
       hyped a card from the deck and set a hometown is the fan the tab is for. */
    const listenerSlug = `e2e-${stamp}-listener`;
    await prisma.profile.upsert({
      where: { slug: listenerSlug },
      update: { city: STATION_CITY, stateRegion: STATION_REGION, country: STATION_COUNTRY },
      create: {
        slug: listenerSlug, hexId: hex(listenerSlug), name: 'E2E Station Listener', type: 'LISTENER', ownerId: fanUserId,
        city: STATION_CITY, stateRegion: STATION_REGION, country: STATION_COUNTRY,
      },
    });
    await prisma.seed.upsert({
      where: { userId_mediaId: { userId: fanUserId, mediaId: track.id } },
      // Re-stamped on every seed: the chart's window is measured back from now.
      update: { action: 'hype', createdAt: new Date() },
      create: { userId: fanUserId, mediaId: track.id, action: 'hype' },
    });
    /* And the fan's own playlist holding the track, so `/app/playlists/[id]`
       — a page that registers its items with the dock and, since row 435,
       gives each row a key — has something to press. Find-or-create by
       (userId, name), as `seedTrackAndPlaylist` does: FanPlaylist has no
       compound unique for an upsert to target. */
    const playlistName = `E2E Station Playlist ${stamp}`;
    const existing = await prisma.fanPlaylist.findFirst({ where: { userId: fanUserId, name: playlistName }, select: { id: true } });
    const playlist = existing
      ?? await prisma.fanPlaylist.create({
        data: {
          userId: fanUserId,
          name: playlistName,
          items: { create: [{ mediaId: track.hexId, title: track.title, artistName: profile.name, url: STATION_TRACK_URL, position: 0 }] },
        },
        select: { id: true },
      });
    /* Re-stamped on a re-run: the item is a denormalised COPY of the track
       (its own url and name), and a scratch database that outlives a fixture
       change would otherwise keep serving the old shape — which is how a
       relative url from an earlier draft went on being asserted here. */
    if (existing) {
      await prisma.fanPlaylistItem.updateMany({
        where: { playlistId: existing.id },
        data: { mediaId: track.hexId, title: track.title, artistName: profile.name, url: STATION_TRACK_URL },
      });
    }
    /* A NEIGHBOUR the listener has NOT hyped: the Recommended tab is
       `getRecommendations`, which excludes every act the viewer already knows
       and offers acts in the viewer's genres — so the hyped station artist can
       never appear there, and without this the tab's rows are whatever other
       fixtures left in the database, whose audio the harness cannot serve.
       Same genre and city so it ranks first; the same static file so a
       completion can actually be heard and posted. */
    const neighbourSlug = `e2e-${stamp}-neighbour`;
    const neighbourEmail = `${neighbourSlug}@ihype.test`;
    const neighbourOwner = await prisma.user.upsert({
      where: { email: neighbourEmail },
      update: {},
      create: { email: neighbourEmail, name: 'E2E Station Neighbour', username: neighbourSlug, role: 'ARTIST', emailVerified: new Date() },
      select: { id: true },
    });
    const neighbour = await prisma.profile.upsert({
      where: { slug: neighbourSlug },
      create: {
        slug: neighbourSlug, hexId: hex(neighbourSlug), name: 'E2E Station Neighbour', type: 'ARTIST', ownerId: neighbourOwner.id, discoverable: true,
        genres: ['Dream-pop'], city: STATION_CITY, stateRegion: STATION_REGION, country: STATION_COUNTRY,
      },
      update: { discoverable: true, genres: ['Dream-pop'], city: STATION_CITY, stateRegion: STATION_REGION, country: STATION_COUNTRY },
      select: { id: true, name: true },
    });
    const neighbourTrackHex = hex(`${neighbourSlug}-track`);
    const neighbourTrack = await prisma.artistMediaAsset.upsert({
      where: { hexId: neighbourTrackHex },
      update: { isPublished: true, publishAt: null, storageUrl: STATION_TRACK_URL },
      create: {
        hexId: neighbourTrackHex,
        title: 'E2E Neighbour Track',
        isPublished: true,
        originalFileName: 'e2e-neighbour-track.wav',
        mimeType: 'audio/wav',
        fileSizeBytes: 1024,
        durationSecs: 123,
        storageUrl: STATION_TRACK_URL,
        profileId: neighbour.id,
      },
      select: { title: true },
    });
    return {
      trackHexId: track.hexId, title: track.title, artistName: profile.name, artistSlug: profile.slug, playlistId: playlist.id,
      neighbourTitle: neighbourTrack.title,
    };
  } finally {
    await prisma.$disconnect();
  }
}

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
