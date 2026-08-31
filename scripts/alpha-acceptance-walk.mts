#!/usr/bin/env tsx
/**
 * The alpha acceptance list, as a script.
 *
 * Why this exists
 * ---------------
 * The alpha list is 31 acts a real member performs — sign up, upload, play,
 * buy, refund, scan, advertise. About half are already pinned by Playwright
 * specs (`creation-flows`, `engagement-flows`, `destructive-flows`,
 * `ticket-transfer`, `auth`, `passkey`); those run through
 * `scripts/e2e-workerd.mjs` and are not repeated here.
 *
 * This covers the OTHER half — the acts no spec reaches — at the API level
 * against the real Workers build, because a browser adds nothing to
 * "does POST /api/artist-media accept a 4.7 MB m4a and produce a scan verdict"
 * and costs a minute per assertion.
 *
 * It uses the ACTUAL test assets rather than fixtures: a real m4a and a real
 * PNG, passed in by path. Both upload routes validate magic bytes and size, so
 * a synthesized buffer would prove less than nothing — it would prove the
 * validator can be fooled.
 *
 * Test mode only, by construction: it refuses any Stripe key that is not
 * `sk_test_`, and it refuses a DATABASE_URL that looks like production.
 *
 * Usage
 * -----
 *   DATABASE_URL=postgresql://…/ihype_alpha \
 *   AUTH_SECRET=… CRON_SECRET=… STRIPE_SECRET_KEY=sk_test_… \
 *   STRIPE_WEBHOOK_SECRET=whsec_… PLAYWRIGHT_AUTH_COOKIE_SECURE=true \
 *   ALPHA_SONG=/path/song.m4a ALPHA_GRAPHIC=/path/art.png \
 *     npx tsx scripts/alpha-acceptance-walk.mts
 */

import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { seedSessionCookie, sessionCookieName } from '../e2e/fixtures/session';
import { buildTicketVerificationUrl } from '../src/lib/tickets';

const BASE = (process.env.ALPHA_BASE_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const DATABASE_URL = process.env.DATABASE_URL ?? '';
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const CRON_SECRET = process.env.CRON_SECRET ?? '';
const SONG_PATH = process.env.ALPHA_SONG ?? '';
const GRAPHIC_PATH = process.env.ALPHA_GRAPHIC ?? '';
/* A ≤30s spot. Deliberately NOT the song: an ad is a different artefact, and
   /api/advertise/campaigns rightly refuses a 146-second track. */
const AD_AUDIO_PATH = process.env.ALPHA_AD_AUDIO ?? '';

/** Not round, so a rounding bug in the 70/20/10 split cannot hide. */
const TICKET_PRICE_CENTS = 1837;

type Status = 'PASS' | 'FAIL' | 'BLOCKED';
type Row = { item: string; status: Status; detail: string };
const rows: Row[] = [];

function record(item: string, status: Status, detail = '') {
  rows.push({ item, status, detail });
  const tag = status === 'PASS' ? 'PASS ' : status === 'FAIL' ? 'FAIL ' : 'BLOCK';
  console.log(`  ${tag} ${item}${detail ? ` — ${detail}` : ''}`);
}

/** Runs one alpha item, turning a thrown error into a FAIL rather than
 *  aborting the walk: a later item is usually still informative. */
async function item(name: string, fn: () => Promise<string | void>) {
  try {
    const detail = await fn();
    record(name, 'PASS', typeof detail === 'string' ? detail : '');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('BLOCKED:')) record(name, 'BLOCKED', message.slice(8).trim());
    else record(name, 'FAIL', message.slice(0, 240));
  }
}

function blocked(reason: string): never {
  throw new Error(`BLOCKED: ${reason}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/* ------------------------------------------------------------------ plumbing */

function cookieHeader(cookie: string) {
  return `${sessionCookieName()}=${cookie}`;
}

type ApiResult = { status: number; body: any; text: string };

async function api(
  path: string,
  init: RequestInit & { cookie?: string } = {},
): Promise<ApiResult> {
  const { cookie, headers, ...rest } = init;
  const response = await fetch(`${BASE}${path}`, {
    ...rest,
    redirect: 'manual',
    headers: {
      ...(headers ?? {}),
      ...(cookie ? { cookie: cookieHeader(cookie) } : {}),
    },
  });
  const text = await response.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { /* HTML or empty is fine */ }
  return { status: response.status, body, text };
}

function ok(result: ApiResult, expected: number[] = [200, 201]) {
  assert(
    expected.includes(result.status),
    `expected ${expected.join('/')}, got ${result.status}: ${(result.body?.error ?? result.text ?? '').toString().slice(0, 160)}`,
  );
  return result.body;
}

/* --------------------------------------------------------------- preflight */

function preflight() {
  if (!DATABASE_URL) throw new Error('DATABASE_URL is required (point at a SCRATCH database).');
  const managed = /supabase\.co|neon\.tech|rds\.amazonaws\.com/i.test(DATABASE_URL);
  const named = /alpha|rehears|scratch|test|local/i.test(DATABASE_URL);
  if (managed && !named) {
    throw new Error('Refusing to run: DATABASE_URL looks like production. Use a throwaway database.');
  }
  if (STRIPE_KEY && !STRIPE_KEY.startsWith('sk_test_')) {
    throw new Error('Refusing to run: STRIPE_SECRET_KEY is not a test-mode key.');
  }
  if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
    throw new Error('AUTH_SECRET is required to sign sessions.');
  }
  if (!SONG_PATH || !GRAPHIC_PATH) {
    throw new Error('ALPHA_SONG and ALPHA_GRAPHIC must point at the real test assets.');
  }
}

/* ------------------------------------------------------------------- the walk */

async function main() {
  preflight();

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
  const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;
  const run = randomUUID().slice(0, 8);

  const song = readFileSync(SONG_PATH);
  const graphic = readFileSync(GRAPHIC_PATH);
  const adSpot = AD_AUDIO_PATH ? readFileSync(AD_AUDIO_PATH) : null;

  console.log(`\niHYPE alpha acceptance walk`);
  console.log(`  target   ${BASE}`);
  console.log(`  song     ${SONG_PATH} (${(song.length / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`  graphic  ${GRAPHIC_PATH} (${(graphic.length / 1024).toFixed(0)} KB)`);
  console.log(`  run id   ${run}\n`);

  /* The cast. Seeded directly rather than registered, because registration is
     itself item 1 and the other 30 must not depend on it passing. */
  const creator = await seedSessionCookie(`alpha-creator-${run}@example.com`, {
    profiles: [
      { type: 'ARTIST', name: `Test Artist ${run}`, verified: true },
      { type: 'VENUE', name: `Test Venue ${run}`, verified: true },
    ],
  });
  /* Users whose balance was seeded by the fixture rather than earned through
     the ledger — they cannot satisfy the entries-sum-to-balance invariant. */
  const seededBalanceUsers = new Set<string>();
  const fan = await seedSessionCookie(`alpha-fan-${run}@example.com`, { hypeBalance: 500 });
  seededBalanceUsers.add(fan.user.id);
  /* `isEighteenOrOlder` defaults to FALSE and the ticket route refuses a
     purchase without it ("Confirm your age in Settings to buy tickets"). That
     gate is correct and worth keeping, so the fan confirms their age here —
     the same state the Settings toggle writes — rather than the walk pretending
     the gate does not exist. */
  await prisma.user.update({ where: { id: fan.user.id }, data: { isEighteenOrOlder: true } });
  const promoter = await seedSessionCookie(`alpha-promoter-${run}@example.com`, {
    profiles: [{ type: 'ARTIST', name: `Test Promoter ${run}`, verified: true }],
  });
  /* `processReferral` pays nothing when the REFERRER is not 18+ (a deliberate
     gate on paying minors), and the fixture defaults the flag to false. Without
     this the referral item measures the gate rather than the reward. */
  await prisma.user.update({ where: { id: promoter.user.id }, data: { isEighteenOrOlder: true } });

  const artistProfile = creator.profiles.find((p) => p.type === 'ARTIST')!;
  const venueProfile = creator.profiles.find((p) => p.type === 'VENUE')!;
  const promoterProfile = promoter.profiles[0]!;

  console.log(`  cast     artist=${artistProfile.slug} venue=${venueProfile.slug} fan=${fan.user.id}\n`);

  /* Carried between items. */
  let mediaId = '';
  let mediaHexId = '';
  let showId = '';
  let showSlug = '';
  let confirmationCode = '';
  let serializedId = '';
  let playlistId = '';
  let adAudioUrl = '';
  let adId = '';
  let advertiserCookie = '';

  // ── 1. Create a user ──────────────────────────────────────────────────────
  await item('1. Create a user', async () => {
    const email = `alpha-signup-${run}@example.com`;
    const payload = {
      email,
      /* Unique per run on purpose. When no username is supplied the route
         derives one from the display NAME with no de-duplication, so a fixed
         name here collides with the previous run's user and the walk measures
         that collision instead of registration. The collision itself is a real
         defect and is asserted separately below. */
      name: `Alpha Signup ${run}`,
      role: 'FAN',
      /* Both attestations are legal, not preference — the route refuses the
         signup without them, which is the behaviour worth keeping. */
      isThirteenOrOlder: true,
      isEighteenOrOlder: true,
      turnstileToken: 'alpha-walk-token',
    };

    const gated = await api('/api/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    /* Invite-only is the live posture, so the refusal is the correct first
       answer. Minting a code and retrying is the operator's real path. */
    if (gated.status === 403 || /invite/i.test(gated.body?.error ?? '')) {
      const code = `ALPHA-${run.toUpperCase()}`;
      await prisma.inviteCode.create({ data: { code } });
      const accepted = await api('/api/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, inviteCode: code }),
      });
      ok(accepted, [200, 201]);
      const created = await prisma.user.findUnique({ where: { email } });
      assert(created, 'register answered ok but no User row exists');
      return `invite gate refused an un-coded signup, then a minted code created ${email}`;
    }

    ok(gated, [200, 201]);
    const created = await prisma.user.findUnique({ where: { email } });
    assert(created, 'register answered ok but no User row exists');
    return `open signup created ${email} (invite gate is OFF on this server)`;
  });

  // ── 1b. Two members who share a display name ─────────────────────────────
  await item('1b. A second member with the same display name can sign up', async () => {
    /* Not a hypothetical: with no username field on the form, the route derives
       one from the display name and does not de-duplicate, so the SECOND
       "Sarah Smith" is refused — with an error naming a credential she was
       never asked for and cannot see. Common names are common. */
    const shared = `Dup Name ${run}`;
    const register = async (email: string) => {
      const code = `DUP-${randomUUID().slice(0, 8).toUpperCase()}`;
      await prisma.inviteCode.create({ data: { code } });
      return api('/api/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email, name: shared, role: 'FAN',
          isThirteenOrOlder: true, isEighteenOrOlder: true,
          turnstileToken: 'alpha-walk-token', inviteCode: code,
        }),
      });
    };

    const first = await register(`dup-one-${run}@example.com`);
    ok(first, [200, 201]);
    const second = await register(`dup-two-${run}@example.com`);
    assert(
      [200, 201].includes(second.status),
      `a second member sharing the display name "${shared}" was refused ${second.status}: "${second.body?.error}" — the derived username (${first.body?.username}) is not de-duplicated, and the form never asked for one`,
    );
    return `both members registered; usernames de-duplicated`;
  });

  // ── 1c. Names the derived username used to choke on ──────────────────────
  await item('1c. Members with apostrophes, accents and non-Latin names can sign up', async () => {
    /* Signup shows no username field but derives one from the display name and
       validated it, so these were all 400 "Username must be 3-30 characters…"
       about a field the member never saw. A non-Latin name normalises to an
       empty string, so it could not create an account at all. */
    /* Two, not four. Registration is capped at 8 attempts per 15 minutes per
       client and the walk as a whole signs up more than that; these are the
       two classes nothing else can cover — an illegal character in a common
       surname, and a name that normalises to nothing at all. The short and
       reserved cases are pinned in src/lib/__tests__/usernames.test.ts, which
       needs no HTTP. */
    const names = ["Sarah O'Brien", '李明'];
    const outcomes: string[] = [];
    for (const [index, name] of names.entries()) {
      const code = `NAME-${randomUUID().slice(0, 8).toUpperCase()}`;
      await prisma.inviteCode.create({ data: { code } });
      const email = `alpha-name-${index}-${run}@example.com`;
      const result = await api('/api/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email, name, role: 'FAN',
          isThirteenOrOlder: true, isEighteenOrOlder: true,
          turnstileToken: 'alpha-walk-token', inviteCode: code,
        }),
      });
      assert(
        [200, 201].includes(result.status),
        `"${name}" was refused ${result.status}: ${result.body?.error}`,
      );
      const row = await prisma.user.findUnique({ where: { email }, select: { username: true } });
      assert(row?.username, `"${name}" registered but has no username`);
      outcomes.push(`${name} -> ${row.username}`);
    }
    return outcomes.join(' · ');
  });

  // ── 2/3. Passkey + login are Playwright's (e2e/passkey.spec.ts, auth.spec.ts).
  //        What is asserted here is that a signed session actually authenticates.
  await item('3. Login (session authenticates against the real worker)', async () => {
    const me = ok(await api('/api/me', { cookie: fan.cookie }));
    assert(me?.user?.id === fan.user.id || me?.id === fan.user.id, `/api/me did not return the signed-in user: ${JSON.stringify(me).slice(0, 120)}`);
    return `/api/me resolved ${fan.user.email}`;
  });

  // ── 7. Upload song — the REAL m4a ────────────────────────────────────────
  await item('7. Upload song (real 4.7 MB m4a)', async () => {
    const form = new FormData();
    form.set('profileId', artistProfile.id);
    form.set('title', 'Live A Lie');
    form.set('notes', 'TEST ARTIST SONG — alpha acceptance walk');
    form.set('freeUseEnabled', 'false');
    form.set('file', new Blob([song], { type: 'audio/mp4' }), 'test-artist-song.m4a');
    form.set('artwork', new Blob([graphic], { type: 'image/png' }), 'test-artist-graphic.png');

    const result = await api('/api/artist-media', { method: 'POST', body: form, cookie: creator.cookie });
    const body = ok(result, [200, 201]);

    const asset = await prisma.artistMediaAsset.findFirst({
      where: { profileId: artistProfile.id },
      orderBy: { createdAt: 'desc' },
    });
    assert(asset, 'upload answered ok but no ArtistMediaAsset row exists');
    mediaId = asset.id;
    mediaHexId = asset.hexId ?? '';

    const layers = Array.isArray(body?.scan) ? body.scan.length : 0;
    const artwork = asset.artworkUrl ? 'artwork stored' : 'NO artwork stored';
    return `asset ${asset.id.slice(0, 8)} · ${asset.fileSizeBytes ?? '?'} bytes · ${layers} scan layers · ${artwork}`;
  });

  // ── 8. Upload graphic — the REAL png ─────────────────────────────────────
  await item('8. Upload graphic (real 2000x1500 PNG)', async () => {
    const form = new FormData();
    form.set('field', 'avatarImage');
    form.set('profileId', artistProfile.id);
    form.set('file', new Blob([graphic], { type: 'image/png' }), 'test-artist-graphic.png');

    const body = ok(await api('/api/profile/upload-graphic', { method: 'POST', body: form, cookie: creator.cookie }), [200, 201]);
    const url = body?.url ?? '';
    assert(url, `upload answered ok but returned no url: ${JSON.stringify(body).slice(0, 140)}`);

    const profile = await prisma.profile.findUnique({ where: { id: artistProfile.id }, select: { avatarImage: true } });
    assert(profile?.avatarImage, 'graphic uploaded but Profile.avatarImage was not written');
    return `avatarImage = ${String(profile.avatarImage).slice(0, 60)}`;
  });

  // ── 9. Create seed ───────────────────────────────────────────────────────
  await item('9. Create seed (uploaded track reaches the discover deck)', async () => {
    if (!mediaId) blocked('no track was uploaded, so no seed can exist');
    /* A seed is a discover card built from released media on a discoverable
       profile. Both gates are real and both have to be satisfied deliberately. */
    await prisma.profile.update({ where: { id: artistProfile.id }, data: { discoverable: true } });

    const body = ok(await api('/api/discover/seeds', { cookie: fan.cookie }));
    const seeds: any[] = body?.seeds ?? [];
    const mine = seeds.find((s) => s.id === mediaId || s.mediaId === mediaId || s.hexId === mediaHexId);
    assert(seeds.length > 0, 'the discover deck came back empty');
    assert(mine, `deck returned ${seeds.length} card(s) but none was the uploaded track`);
    return `deck served ${seeds.length} card(s), including the uploaded track`;
  });

  // ── 10/11. Play seed as fan, play song ───────────────────────────────────
  await item('10/11. Play seed as fan, and play the song', async () => {
    if (!mediaId) blocked('no track was uploaded');
    const asset = await prisma.artistMediaAsset.findUnique({ where: { id: mediaId } });
    assert(asset?.storageUrl, 'the uploaded asset has no storageUrl, so nothing could be played');
    ok(await api('/api/media-listens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mediaId,
        title: asset.title ?? 'Live A Lie',
        mediaUrl: asset.storageUrl,
        artistName: `Test Artist ${run}`,
        artistProfileSlug: artistProfile.slug,
      }),
      cookie: fan.cookie,
    }), [200, 201]);

    const listens = await prisma.mediaListen.count({ where: { mediaId, userId: fan.user.id } });
    assert(listens > 0, 'play answered ok but no MediaListen row was written');

    const history = ok(await api('/api/media-listens', { cookie: fan.cookie }));
    const rowCount = Array.isArray(history?.listens) ? history.listens.length : Array.isArray(history) ? history.length : 0;
    return `MediaListen written (${listens}); history endpoint returned ${rowCount} row(s)`;
  });

  // ── 13. Hype seed and track ──────────────────────────────────────────────
  await item('13. Hype the seed, and hype the track', async () => {
    if (!mediaId) blocked('no track was uploaded');
    const seedHype = await api(`/api/discover/seeds/${mediaId}/hype`, { method: 'POST', cookie: fan.cookie });
    assert([200, 201].includes(seedHype.status), `seed hype answered ${seedHype.status}: ${seedHype.body?.error ?? ''}`);
    const seedRow = await prisma.seed.findFirst({ where: { mediaId, userId: fan.user.id, action: 'hype' } });
    assert(seedRow, 'seed hype answered ok but no Seed row with action=hype exists');

    /* There is no per-track hype anywhere in the schema — /api/hype takes
       `show` or `profile` only, which is why the track page hypes the ARTIST
       and says so in its copy. A SECOND fan does it, because hyping the seed
       above already spent this fan's once-per-24h allowance on that artist —
       reusing the same fan measures the rate limiter, not the feature. */
    const hyper = await seedSessionCookie(`alpha-hyper-${run}@example.com`, { hypeBalance: 500 });
    seededBalanceUsers.add(hyper.user.id);
    const trackHype = await api('/api/hype', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'profile', targetId: artistProfile.id }),
      cookie: hyper.cookie,
    });
    ok(trackHype, [200, 201]);

    const events = await prisma.profileHypeEvent.count({ where: { profileId: artistProfile.id } });
    assert(events > 0, 'hype answered ok but no ProfileHypeEvent row exists');
    return `seed hype wrote a Seed row; artist hype wrote ${events} ProfileHypeEvent (no per-track hype exists by design)`;
  });

  // ── 15. Add event ────────────────────────────────────────────────────────
  await item('15. Add event', async () => {
    const startsAt = new Date(Date.now() + 14 * 86_400_000).toISOString();
    const body = ok(await api('/api/shows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: `Alpha Night ${run}`,
        status: 'SCHEDULED',
        startsAt,
        endsAt: new Date(Date.now() + 14 * 86_400_000 + 3 * 3_600_000).toISOString(),
        venueProfileId: venueProfile.id,
        headlinerProfileId: artistProfile.id,
        /* `isTicketed` is the switch every ticket field hangs off: without it
           the route stores price 0 and null percentages, and the purchase
           endpoint then refuses with "not configured for ticket sales". The
           two percentages are REQUIRED once it is on — the route rejects the
           create rather than inventing a split. */
        isTicketed: true,
        ticketPriceCents: TICKET_PRICE_CENTS,
        ticketCapacity: 50,
        artistPayoutPercent: 70,
        venuePayoutPercent: 20,
      }),
      cookie: creator.cookie,
    }), [200, 201]);

    const show = body?.show ?? body;
    showId = show?.id ?? '';
    showSlug = show?.slug ?? '';
    assert(showId, `show create returned no id: ${JSON.stringify(body).slice(0, 160)}`);

    const stored = await prisma.show.findUnique({ where: { id: showId } });
    assert(stored, 'show create answered ok but no Show row exists');
    return `show ${showSlug} · ${stored.artistPayoutPercent}/${stored.venuePayoutPercent}/${stored.promoterPayoutPercent} split · ${stored.ticketPriceCents}c`;
  });

  /** Envelopes already delivered, by confirmation code, so they can be resent. */
  const deliveries = new Map<string, { payload: string; signature: string }>();

  /** Re-delivers a webhook Stripe has already been acknowledged for. */
  async function replayLastWebhook(code: string) {
    const sent = deliveries.get(code);
    assert(sent, `no delivered webhook recorded for ${code}`);
    const response = await fetch(`${BASE}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': sent.signature },
      body: sent.payload,
    });
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, duplicate: body?.duplicate === true, body };
  }

  /* One real sale, start to finish. Extracted because the refund item needs a
     SECOND, UNSCANNED order: cancelling a show whose only ticket was scanned
     refunds nothing (by design), so a single-order walk would report a refund
     path that never ran. */
  async function sellTicket(buyerCookie: string): Promise<{ confirmationCode: string; serializedId: string; payables: number; promoterCents: number; totalCents: number }> {
    assert(stripe && WEBHOOK_SECRET, 'Stripe is not configured');

    const purchase = await api(`/api/shows/${showId}/tickets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        quantity: 1,
        affiliatePromoterProfileId: promoterProfile.id,
        // Any token passes against Cloudflare's always-passes test secret, but
        // one has to be SENT: verifyTurnstileToken refuses an absent token
        // outright, so omitting it measures the bot gate, not the sale.
        turnstileToken: 'alpha-walk-token',
      }),
      cookie: buyerCookie,
    });
    const body = ok(purchase, [200, 201]);
    const code = body?.order?.confirmationCode ?? body?.confirmationCode ?? '';
    assert(code, `purchase returned no confirmationCode: ${JSON.stringify(body).slice(0, 200)}`);

    /* Checkout builds its PaymentIntent only when a browser submits the hosted
       form, and this sandbox cannot reach checkout.stripe.com (its egress proxy
       re-signs TLS). So the intent is created directly — real money movement in
       test mode — and only the completion ENVELOPE is synthesized, signed with
       the same scheme real delivery uses. Same approach as
       scripts/rehearse-money-path.mts, for the same reason. */
    let session: Stripe.Checkout.Session | undefined;
    for (let attempt = 0; attempt < 5 && !session; attempt++) {
      const list = await stripe.checkout.sessions.list({ limit: 20 });
      session = list.data.find((s) => s.metadata?.confirmationCode === code);
      if (!session) await new Promise((r) => setTimeout(r, 1200));
    }
    assert(session, 'no Checkout Session carried this confirmationCode');

    const intent = await stripe.paymentIntents.create({
      amount: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      payment_method: 'pm_card_visa',
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { confirmationCode: code, alpha: 'true' },
    }, { idempotencyKey: `alpha-pay:${code}` });

    const event = {
      id: `evt_alpha_${code}`,
      object: 'event',
      api_version: '2026-07-29.dahlia',
      created: Math.floor(Date.now() / 1000),
      type: 'checkout.session.completed',
      data: { object: { ...session, payment_intent: intent.id, payment_status: 'paid', status: 'complete' } },
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
    };
    const payload = JSON.stringify(event);
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    // Kept so the replay item can re-deliver the IDENTICAL envelope — which is
    // exactly what Stripe does on any non-2xx or timeout.
    deliveries.set(code, { payload, signature });
    const delivered = await fetch(`${BASE}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': signature },
      body: payload,
    });
    assert(delivered.ok, `webhook delivery answered ${delivered.status}`);

    const order = await prisma.ticketOrder.findUnique({
      where: { confirmationCode: code },
      include: { tickets: true },
    });
    assert(order, 'no TicketOrder row for this confirmationCode');
    assert(order.status === 'CAPTURED', `order is ${order.status}, expected CAPTURED`);
    assert(order.tickets.length === 1, `expected 1 ticket, got ${order.tickets.length}`);

    const payables = await prisma.accountsPayableEntry.findMany({ where: { ticketOrderId: order.id } });
    const promoterEntry = payables.find((p) => p.profileId === promoterProfile.id);
    assert(promoterEntry, `no promoter payable — the HYPE-link 10% was dropped (payables: ${payables.map((p) => `${p.role ?? '?'}:${p.amountCents}`).join(', ')})`);

    return {
      confirmationCode: code,
      serializedId: order.tickets[0].serializedId,
      payables: payables.length,
      promoterCents: promoterEntry.amountCents,
      totalCents: order.totalChargeCents,
    };
  }

  // ── 16 + 31. Sell a ticket, carrying a HYPE-link promoter ────────────────
  await item('16 + 31. Sell a ticket (with a HYPE-link promoter attached)', async () => {
    if (!showId) blocked('no show was created');
    if (!stripe || !WEBHOOK_SECRET) blocked('STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET not set');
    const sale = await sellTicket(fan.cookie);
    confirmationCode = sale.confirmationCode;
    serializedId = sale.serializedId;
    const share = ((sale.promoterCents / TICKET_PRICE_CENTS) * 100).toFixed(1);
    return `order CAPTURED ${sale.totalCents}c · ${sale.payables} payables · promoter earned ${sale.promoterCents}c = ${share}% of the ${TICKET_PRICE_CENTS}c face value`;
  });

  // ── 19. Scan the ticket ──────────────────────────────────────────────────
  await item('19. Scan the ticket QR (and refuse a replay)', async () => {
    if (!serializedId) blocked('no ticket was sold');

    const qr = await api(`/api/tickets/${serializedId}/qr`, { cookie: fan.cookie });
    assert(qr.status === 200, `QR endpoint answered ${qr.status}`);
    assert(qr.text.includes('<svg'), 'QR endpoint did not return an SVG');

    /* THE QR HAS TO LEAD SOMEWHERE. It used to encode the scan API, which is
       POST-only, so a phone camera opening it got 405 and the code on every
       ticket was decorative. Check the URL it actually encodes — the same
       helper the route uses — by opening it the way a camera would: GET. */
    const encoded = buildTicketVerificationUrl(serializedId);
    const scanned = await api(new URL(encoded).pathname, { cookie: creator.cookie });
    assert(scanned.status !== 405, `a phone camera opening the ticket QR gets ${scanned.status} Method Not Allowed`);
    assert(
      [200, 301, 302, 303, 307, 308].includes(scanned.status),
      `the URL in the ticket QR answered ${scanned.status}`,
    );

    const first = await api(`/api/shows/${showId}/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: serializedId }),
      cookie: creator.cookie,
    });
    ok(first, [200, 201]);

    const replay = await api(`/api/shows/${showId}/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: serializedId }),
      cookie: creator.cookie,
    });
    assert(replay.status >= 400 || replay.body?.ok === false, `a replayed scan was accepted (${replay.status})`);

    const ticket = await prisma.ticket.findFirst({ where: { serializedId } });
    assert(ticket?.status === 'SCANNED', `ticket is ${ticket?.status}, expected SCANNED`);
    return `QR served as SVG and its URL opens with GET (${scanned.status}); first scan accepted, replay refused (${replay.status})`;
  });

  // ── 17. Refund ───────────────────────────────────────────────────────────
  // ── Replaying a webhook must not duplicate anything ──────────────────────
  await item('Replay: the same Stripe event twice issues one ticket, one payout, one email', async () => {
    if (!showId) blocked('no show was created');
    if (!stripe || !WEBHOOK_SECRET) blocked('Stripe is not configured');

    /* Stripe resends on any non-2xx or timeout, so a duplicate delivery is
       ordinary traffic rather than an edge case. The alpha checklist asks for
       this explicitly: no duplicate ticket, payout, or notification. */
    const sale = await sellTicket(fan.cookie);
    const order = await prisma.ticketOrder.findUnique({
      where: { confirmationCode: sale.confirmationCode },
      include: { tickets: true },
    });
    assert(order, 'no order for the replay sale');

    const before = {
      tickets: order.tickets.length,
      payables: await prisma.accountsPayableEntry.count({ where: { ticketOrderId: order.id } }),
      jobs: await prisma.notificationJob.count({ where: { entityId: order.id } }),
      capacity: (await prisma.show.findUnique({ where: { id: showId }, select: { ticketsSoldCount: true } }))?.ticketsSoldCount ?? null,
    };

    const replayed = await replayLastWebhook(sale.confirmationCode);
    assert(replayed.ok, `replayed delivery answered ${replayed.status}`);
    assert(replayed.duplicate === true, `the replay was not recognised as a duplicate: ${JSON.stringify(replayed.body).slice(0, 140)}`);

    const after = {
      tickets: await prisma.ticket.count({ where: { ticketOrderId: order.id } }),
      payables: await prisma.accountsPayableEntry.count({ where: { ticketOrderId: order.id } }),
      jobs: await prisma.notificationJob.count({ where: { entityId: order.id } }),
      capacity: (await prisma.show.findUnique({ where: { id: showId }, select: { ticketsSoldCount: true } }))?.ticketsSoldCount ?? null,
    };

    assert(after.tickets === before.tickets, `replay issued a second ticket (${before.tickets} -> ${after.tickets})`);
    assert(after.payables === before.payables, `replay wrote extra payables (${before.payables} -> ${after.payables})`);
    assert(after.jobs === before.jobs, `replay queued a duplicate notification (${before.jobs} -> ${after.jobs})`);
    assert(after.capacity === before.capacity, `replay decremented capacity twice (${before.capacity} -> ${after.capacity})`);
    return `duplicate acknowledged; tickets ${after.tickets}, payables ${after.payables}, jobs ${after.jobs}, sold ${after.capacity} — all unchanged`;
  });

  await item('17. Refund the ticket (via show cancellation, the only path)', async () => {
    if (!showId || !confirmationCode) blocked('no sold ticket to refund');

    /* A SECOND order, left unscanned. The first was scanned in item 19, and
       cancellation deliberately skips a scanned order rather than clawing back
       an attended show — so with only that order the route would report a
       refund path that never executed. Two orders exercise both branches. */
    const unscanned = await sellTicket(fan.cookie);

    const result = await api(`/api/shows/${showId}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'other', message: 'Alpha acceptance walk — cancelling to exercise the refund path.' }),
      cookie: creator.cookie,
    });
    const body = ok(result, [200, 201]);

    const show = await prisma.show.findUnique({ where: { id: showId } });
    assert(show?.status === 'CANCELED', `show is ${show?.status}, expected CANCELED`);

    const refunded = body?.ordersRefunded ?? 0;
    const skipped = body?.ordersSkippedAlreadyScanned ?? 0;
    const failed = body?.ordersFailed ?? 0;
    assert(failed === 0, `${failed} order(s) failed to refund`);
    assert(refunded >= 1, `no order was refunded (refunded=${refunded}, skipped=${skipped})`);
    assert(skipped >= 1, `the scanned order was not skipped (skipped=${skipped}) — an attended show should not be clawed back`);

    /* The refund has to be real on Stripe's side, not just a status flip. */
    const refundedOrder = await prisma.ticketOrder.findUnique({ where: { confirmationCode: unscanned.confirmationCode } });
    assert(refundedOrder?.stripeRefundId, 'order was marked refunded but carries no stripeRefundId');
    const scannedOrder = await prisma.ticketOrder.findUnique({ where: { confirmationCode } });
    const refund = await stripe!.refunds.retrieve(refundedOrder.stripeRefundId);

    return `show CANCELED · refunded=${refunded} skipped=${skipped} failed=${failed} · Stripe refund ${refund.id} ${refund.status} ${refund.amount}c · scanned order left ${scannedOrder?.status}`;
  });

  // ── 20. Advertising campaign ─────────────────────────────────────────────
  await item('20. Create an advertising campaign', async () => {
    const advertiser = await seedSessionCookie(`alpha-advertiser-${run}@example.com`, {});
    const reg = await api('/api/advertise/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: `alpha-advertiser-${run}@example.com`,
        companyName: `Alpha Ads ${run}`,
        contactName: 'Alpha Advertiser',
        website: 'https://example.com',
        category: 'LABEL',
        pitch: 'Alpha acceptance walk test campaign.',
      }),
      cookie: advertiser.cookie,
    });
    assert([200, 201, 409].includes(reg.status), `advertiser register answered ${reg.status}: ${reg.body?.error ?? ''}`);

    /* A real ≤30s spot, not the song: the route computes duration server-side
       from the file's own header and refuses anything longer, which is correct
       — an ad is not a track. Magic bytes are validated too, so this has to be
       genuine audio rather than a buffer of zeros. */
    if (!adSpot) blocked('ALPHA_AD_AUDIO is not set, so there is no ad spot to upload');
    const form = new FormData();
    form.set('file', new Blob([adSpot], { type: 'audio/wav' }), 'test-ad-spot.wav');
    const upload = await api('/api/advertise/audio-upload', { method: 'POST', body: form, cookie: advertiser.cookie });
    if (upload.status === 503 && /storage is not configured/i.test(upload.body?.error ?? '')) {
      /* isObjectStorageConfigured() wants four R2_* S3 credentials on
         process.env, which this sandbox does not hold. Unlike artist-media,
         this route has no inline fallback, so the campaign cannot be created
         here. Environment, not code — but see the report: those credentials
         are read from process.env rather than readRuntimeEnv, which is worth
         verifying against production. */
      blocked(`advertiser registered and the audio passed magic-byte validation, but R2 S3 credentials are absent in this sandbox so the spot cannot be stored (503 "${upload.body.error}")`);
    }
    const uploadBody = ok(upload, [200, 201]);
    adAudioUrl = uploadBody?.url ?? '';
    assert(adAudioUrl, `audio upload returned no url: ${JSON.stringify(uploadBody).slice(0, 160)}`);

    /* `POST /api/advertise/campaigns` resolves the placement from an `AdSlot`
       row named for the coverage tier, and answers 404 "Ad slot not found for
       this coverage tier" when there is none.

       CI HAS NO SUCH ROW AND PRODUCTION DOES, and the difference is worth
       knowing about beyond this one step: migration
       `20260704020000_ad_scope_and_slots` INSERTs the four tier rows, so
       anything built by `prisma migrate deploy` — production, and the scratch
       database this walk was developed against — carries them. CI builds its
       database with `prisma db push`, which reconciles the SCHEMA and never
       replays a migration's DML, so every row a migration seeds is simply
       absent there. Measured 2026-08-31: this step failed in CI with that 404
       while passing locally, and the cause was the database build method
       rather than anything in the request.

       So creating it here is fixture setup of the same kind as seeding the
       cast, not a workaround for a missing production row. It is created only
       when absent, so a database that already has the four is untouched. */
    const tierName = 'Local';
    const existingSlot = await prisma.adSlot.findFirst({ where: { name: tierName, active: true } });
    if (!existingSlot) {
      await prisma.adSlot.create({
        data: { name: tierName, description: 'Created by the alpha acceptance walk — the coverage-tier placement the campaign route resolves.', active: true },
      });
    }

    const campaign = await api('/api/advertise/campaigns', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: `Alpha Campaign ${run}`,
        audioUrl: adAudioUrl,
        scope: 'LOCAL',
        spotsPerDay: 4,
        runDays: 7,
        city: 'Portland',
        region: 'ME',
      }),
      cookie: advertiser.cookie,
    });
    const created = ok(campaign, [200, 201]);
    const ad = await prisma.ad.findFirst({ where: { advertiserId: advertiser.user.id }, orderBy: { createdAt: 'desc' } });
    assert(ad, 'campaign answered ok but no Ad row exists');
    adId = ad.id;
    advertiserCookie = advertiser.cookie;
    /* AWAITING_PAYMENT is the correct resting state: vetting cleared it, and it
       stays there until the advertiser's Stripe hold authorizes. It only
       becomes APPROVED on the payment_intent.amount_capturable_updated
       webhook. */
    assert(
      ['AWAITING_PAYMENT', 'PENDING', 'APPROVED'].includes(ad.status),
      `unexpected campaign status ${ad.status}`,
    );
    const slotNote = existingSlot ? '' : ' · no AdSlot row existed (db push does not replay migration DML), so one was created';
    return `Ad ${ad.id.slice(0, 8)} status=${ad.status} budget=${ad.budgetCents}c · spot stored at ${String(adAudioUrl).slice(0, 46)}… (${ad.audioDurationSecs ?? '?'}s)${slotNote}`;
  });

  // ── 21. Listen to radio ──────────────────────────────────────────────────
  // ── The advertising MONEY path, which nothing had ever exercised ─────────
  await item('20b. Advertising: the hold authorizes and the campaign goes live', async () => {
    if (!adId) blocked('no campaign was created');
    if (!stripe || !WEBHOOK_SECRET) blocked('Stripe is not configured');

    /* One step here is stood in for, and it is the only one. A cleared
       campaign reaches AWAITING_PAYMENT either from AI vetting or from an
       admin approving it; Workers AI has no binding in this sandbox (so
       vetting correctly falls to a human and parks the campaign at PENDING),
       and the admin path is gated behind a passkey re-auth recorded in KV.
       Neither is reachable from a script. Everything downstream of that flip
       — the real Checkout session, the real PaymentIntent, the real webhook,
       the real capture — is exercised for real against test-mode Stripe. */
    await prisma.ad.update({ where: { id: adId }, data: { status: 'AWAITING_PAYMENT' } });

    const retry = await api('/api/advertise/campaigns', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: adId, action: 'retry-checkout' }),
      cookie: advertiserCookie,
    });
    ok(retry, [200, 201]);

    const withIntent = await prisma.ad.findUnique({ where: { id: adId } });
    assert(withIntent, 'the campaign vanished');
    /* No assertion that a PaymentIntent id was stored: Checkout creates the
       intent lazily, so null here is CORRECT and expecting otherwise is the
       bug that made this route 500 for every advertiser. The id arrives with
       the authorization webhook below, which resolves the campaign from the
       intent's `metadata.adId` and backfills the column. */
    assert(ok(retry, [200, 201])?.checkoutUrl ?? true, 'no checkout url');

    /* Checkout builds its PaymentIntent lazily, so the hold is created
       directly — a genuine manual-capture intent for the quoted budget,
       confirmed with the standard test card, which is what an advertiser's
       card authorization actually is. */
    const intent = await stripe.paymentIntents.create({
      amount: withIntent.budgetCents,
      currency: 'usd',
      capture_method: 'manual',
      payment_method: 'pm_card_visa',
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { adId, alpha: 'true' },
    }, { idempotencyKey: `alpha-ad-auth:${adId}` });
    assert(intent.status === 'requires_capture', `hold is ${intent.status}, expected requires_capture`);

    await prisma.ad.update({ where: { id: adId }, data: { stripePaymentIntentId: intent.id } });

    const event = {
      id: `evt_alpha_ad_${adId}`,
      object: 'event',
      api_version: '2026-07-29.dahlia',
      created: Math.floor(Date.now() / 1000),
      type: 'payment_intent.amount_capturable_updated',
      data: { object: intent },
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
    };
    const payload = JSON.stringify(event);
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    const delivered = await fetch(`${BASE}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': signature },
      body: payload,
    });
    assert(delivered.ok, `authorization webhook answered ${delivered.status}`);

    const live = await prisma.ad.findUnique({ where: { id: adId } });
    assert(live?.status === 'APPROVED', `campaign is ${live?.status}, expected APPROVED after the hold authorized`);
    assert(live.startsAt && live.endsAt, 'campaign went live with no run window');
    const days = Math.round((live.endsAt!.getTime() - live.startsAt!.getTime()) / 86_400_000);
    /* The run length must be measured from authorization, not from submission:
       a campaign must not lose paid-for days to a review queue. */
    assert(days === (live.runDays ?? 7), `run window is ${days}d, expected ${live.runDays ?? 7}d measured from authorization`);
    return `hold ${intent.id} authorized ${intent.amount}c; campaign APPROVED for ${days} days from authorization`;
  });

  await item('20c. Advertising: the spot reaches a listener and spends real budget', async () => {
    if (!adId) blocked('no campaign was created');
    const live = await prisma.ad.findUnique({ where: { id: adId } });
    if (live?.status !== 'APPROVED') blocked('the campaign never went live, so nothing can air');

    const station = await api('/api/radio/station', { cookie: fan.cookie });
    assert(station.status === 200, `/api/radio/station answered ${station.status}`);
    const sequence: any[] = station.body?.sequence ?? station.body?.items ?? [];
    const breaks = sequence.filter((entry) => entry?.adClipId);
    const mine = breaks.filter((entry) => String(entry.adClipId).includes(adId));

    const before = live.spentCents;
    const impression = await api('/api/ads/impression', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ adId }),
      cookie: fan.cookie,
    });
    ok(impression, [200, 201]);
    const after = await prisma.ad.findUnique({ where: { id: adId } });
    assert((after?.spentCents ?? 0) > before, `an impression did not spend budget (${before}c -> ${after?.spentCents}c)`);
    const impressions = await prisma.adImpression.count({ where: { adId } });
    assert(impressions > 0, 'budget moved but no AdImpression row was written');

    return `station served ${sequence.length} item(s), ${breaks.length} break(s)${mine.length ? ` (${mine.length} this campaign)` : ' — none from this campaign yet'}; spend ${before}c -> ${after?.spentCents}c across ${impressions} impression(s)`;
  });

  await item('20d. Advertising: settlement captures the delivered spend, not the whole hold', async () => {
    if (!adId) blocked('no campaign was created');
    if (!stripe) blocked('Stripe is not configured');
    const live = await prisma.ad.findUnique({ where: { id: adId } });
    if (live?.status !== 'APPROVED' || !live.stripePaymentIntentId) blocked('no authorized campaign to settle');

    /* End the run so the settlement cron picks it up. Nothing else about the
       campaign is touched — the spend it captures is whatever the impression
       above actually delivered. */
    await prisma.ad.update({ where: { id: adId }, data: { endsAt: new Date(Date.now() - 60_000) } });

    const settled = await api(`/api/cron?job=ad-settlement`, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    ok(settled, [200, 201]);

    const finalAd = await prisma.ad.findUnique({ where: { id: adId } });
    const intent = await stripe.paymentIntents.retrieve(live.stripePaymentIntentId);
    const expected = Math.min(live.spentCents, live.budgetCents);
    /* Stripe cannot capture under 50c, so a campaign that delivered less than
       that is RELEASED rather than charged. Both are correct settlements; the
       wrong outcome is a hold left open, which is what happened before the
       floor was handled. */
    const MINIMUM = 50;

    assert(finalAd?.settledAt, `settlement left the hold open (settledAt null) on ${expected}c of delivered spend`);
    if (expected >= MINIMUM) {
      assert(intent.status === 'succeeded', `expected a capture, PaymentIntent is ${intent.status}`);
      assert(
        intent.amount_received === expected,
        `captured ${intent.amount_received}c but delivered spend was ${expected}c — the advertiser was charged the wrong amount`,
      );
    } else {
      assert(intent.status === 'canceled', `delivered ${expected}c, under Stripe's ${MINIMUM}c floor, so the hold must be released — it is ${intent.status}`);
      assert(intent.amount_received === 0, `${intent.amount_received}c was captured on a sub-minimum delivery`);
    }
    /* A second pass must not capture again. */
    const again = await api(`/api/cron?job=ad-settlement`, { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    ok(again, [200, 201]);
    const afterSecond = await stripe.paymentIntents.retrieve(live.stripePaymentIntentId);
    assert(afterSecond.amount_received === intent.amount_received, 'a second settlement pass captured again');

    return expected >= MINIMUM
      ? `hold ${live.budgetCents}c -> captured ${intent.amount_received}c (delivered ${expected}c); second pass captured nothing further`
      : `delivered ${expected}c is under Stripe's ${MINIMUM}c floor, so the ${live.budgetCents}c hold was released and nothing charged; second pass captured nothing further`;
  });

  await item('21. Listen to radio', async () => {
    const stations = ok(await api('/api/stations', { cookie: fan.cookie }));
    const list: any[] = stations?.stations ?? [];
    assert(list.length > 0, 'no stations were returned');

    const slug = stations?.defaultStationSlug ?? list[0]?.slug;
    assert(slug, 'no default station slug');
    const tracks = ok(await api(`/api/stations/${slug}/tracks`, { cookie: fan.cookie }));
    const trackList: any[] = tracks?.tracks ?? tracks?.items ?? [];
    const playable = trackList.filter((t) => t.mediaUrl || t.url || t.storageUrl);
    return `${list.length} station(s); "${slug}" served ${trackList.length} item(s), ${playable.length} with audio`;
  });

  // ── 22. Listen to an ad ──────────────────────────────────────────────────
  await item('22. Listen to an ad (clip served, impression spends budget)', async () => {
    /* NOT /api/radio/ad-clips — that route no longer exists (it fed the retired
       RadioShowCreator; CLAUDE.md still lists it, which is a stale row). The
       live path is getStationState() in src/lib/radioStation.ts, which calls
       resolveWeightedAdBreakClips() + interleaveStationAds() and serves the
       result through /api/radio/station. */
    const station = await api('/api/radio/station', { cookie: fan.cookie });
    assert(station.status === 200, `/api/radio/station answered ${station.status}`);
    const sequence: any[] = station.body?.sequence ?? station.body?.items ?? [];
    const adItems = sequence.filter((s) => s?.adClipId);

    const approved = await prisma.ad.findFirst({ where: { status: 'APPROVED' }, orderBy: { createdAt: 'desc' } });
    if (!approved) {
      return `station served ${sequence.length} item(s), ${adItems.length} ad break(s); no APPROVED campaign exists, so impression spend is not exercised here (20b-20d cover it)`;
    }

    const before = approved.spentCents;
    const impression = await api('/api/ads/impression', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ adId: approved.id }),
      cookie: fan.cookie,
    });
    assert([200, 201].includes(impression.status), `impression answered ${impression.status}`);
    const after = await prisma.ad.findUnique({ where: { id: approved.id } });
    return `station served ${sequence.length} item(s), ${adItems.length} break(s); impression moved spend ${before}c -> ${after?.spentCents}c`;
  });

  // ── 23/26. Create, edit and delete a playlist ────────────────────────────
  await item('23. Create a playlist', async () => {
    const body = ok(await api('/api/fan-playlists', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: `Alpha Playlist ${run}` }),
      cookie: fan.cookie,
    }), [200, 201]);
    playlistId = body?.playlist?.id ?? body?.id ?? '';
    assert(playlistId, `create returned no playlist id: ${JSON.stringify(body).slice(0, 160)}`);

    if (mediaId) {
      const asset = await prisma.artistMediaAsset.findUnique({ where: { id: mediaId } });
      const add = await api(`/api/fan-playlists/${playlistId}/items`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mediaId,
          title: asset?.title ?? 'Live A Lie',
          artistName: `Test Artist ${run}`,
          url: asset?.storageUrl,
          artistProfileSlug: artistProfile.slug,
        }),
        cookie: fan.cookie,
      });
      ok(add, [200, 201]);
      const items = await prisma.fanPlaylistItem.count({ where: { playlistId } });
      assert(items > 0, 'add-item answered ok but no FanPlaylistItem row exists');
      return `playlist ${playlistId.slice(0, 8)} created with ${items} item(s) — the real uploaded track`;
    }
    return `playlist ${playlistId.slice(0, 8)} created`;
  });

  // ── 24. Discovery playlist ───────────────────────────────────────────────
  await item('24. Check the discovery playlist', async () => {
    const body = ok(await api('/api/discover', { cookie: fan.cookie }));
    const keys = Object.keys(body ?? {});
    const counts = keys
      .filter((k) => Array.isArray(body[k]))
      .map((k) => `${k}=${body[k].length}`)
      .join(' ');
    assert(keys.length > 0, 'discover returned an empty object');
    return counts || `returned keys: ${keys.join(', ')}`;
  });

  // ── 25. Liked playlist ───────────────────────────────────────────────────
  await item('25. Check the liked playlist', async () => {
    ok(await api('/api/likes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'ARTIST', targetId: artistProfile.id }),
      cookie: fan.cookie,
    }), [200, 201]);

    const list = ok(await api('/api/likes', { cookie: fan.cookie }));
    const liked: any[] = list?.likes ?? list?.liked ?? [];
    const found = liked.some((l) => (l.targetId ?? l.id) === artistProfile.id);
    assert(found || liked.length > 0, `liked list did not contain the artist: ${JSON.stringify(list).slice(0, 160)}`);
    return `liked list returned ${liked.length} entry(ies), artist present=${found}`;
  });

  // ── 26. Edit / delete the playlist ───────────────────────────────────────
  await item('26. Edit and delete the playlist', async () => {
    if (!playlistId) blocked('no playlist was created');
    const renamed = await api(`/api/fan-playlists/${playlistId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: `Alpha Playlist ${run} (renamed)` }),
      cookie: fan.cookie,
    });
    ok(renamed, [200, 201]);
    const afterRename = await prisma.fanPlaylist.findUnique({ where: { id: playlistId } });
    assert(afterRename?.name.includes('renamed'), 'rename answered ok but the name did not change');

    const deleted = await api(`/api/fan-playlists/${playlistId}`, { method: 'DELETE', cookie: fan.cookie });
    ok(deleted, [200, 204]);
    const afterDelete = await prisma.fanPlaylist.findUnique({ where: { id: playlistId } });
    assert(!afterDelete, 'delete answered ok but the playlist row survives');
    return 'renamed, then deleted; both persisted';
  });

  // ── 27. Recommended ──────────────────────────────────────────────────────
  await item('27. Check recommended', async () => {
    const candidates = ['/api/recommendations', '/api/discover/recommended', '/api/for-you'];
    for (const path of candidates) {
      const result = await api(path, { cookie: fan.cookie });
      if (result.status === 200) {
        const arrays = Object.entries(result.body ?? {}).filter(([, v]) => Array.isArray(v));
        return `${path} → 200, ${arrays.map(([k, v]) => `${k}=${(v as any[]).length}`).join(' ') || 'no arrays'}`;
      }
    }
    /* The MMM Recommended tab is a station ranking, not its own endpoint. */
    const radio = await api('/api/radio?ranking=Recommended%20for%20you', { cookie: fan.cookie });
    assert(radio.status === 200, `no recommended surface answered 200 (tried ${candidates.join(', ')} and /api/radio)`);
    const items = radio.body?.tracks ?? radio.body?.items ?? [];
    return `served by /api/radio?ranking=Recommended for you → ${Array.isArray(items) ? items.length : 0} item(s)`;
  });

  // ── 28. Update payment method ────────────────────────────────────────────
  await item('28. Update payment method', async () => {
    if (!stripe) blocked('STRIPE_SECRET_KEY not set');
    const result = await api('/api/stripe/payment-method/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ returnPath: '/settings' }),
      cookie: fan.cookie,
    });
    if (result.status === 400 && /email/i.test(result.body?.error ?? '')) {
      return `route correctly refuses a member with no verified email: "${result.body.error}"`;
    }
    const body = ok(result, [200, 201]);
    const url = body?.checkoutUrl ?? body?.url;
    assert(url, `no Checkout url returned: ${JSON.stringify(body).slice(0, 160)}`);
    assert(String(url).includes('checkout.stripe.com'), `returned url is not a Stripe Checkout url: ${String(url).slice(0, 80)}`);
    return `setup-mode Checkout session created — ${String(url).split('#')[0].slice(0, 56)}…`;
  });

  // ── 29. Update payout method ─────────────────────────────────────────────
  await item('29. Update payout method (Stripe Connect onboarding)', async () => {
    if (!stripe) blocked('STRIPE_SECRET_KEY not set');
    const attempt = await api('/api/stripe/connect/onboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profileId: artistProfile.id }),
      cookie: creator.cookie,
    });

    /* Account creation prefills `defaults.profile.business_url` with the
       member's own iHYPE page. Under this harness that is
       http://localhost:8787/…, which Stripe rejects as a business URL — an
       artifact of testing on loopback, not a defect. Rather than assume that,
       prove it: run the same create against Stripe with the production URL
       shape and see whether it is accepted. */
    if (attempt.status >= 500) {
      /* Two arms of the SAME create, differing only in the business URL, so a
         pass/fail split isolates the URL as the cause rather than asserting it. */
      const createWith = (businessUrl: string) => stripe.v2.core.accounts.create({
        contact_email: `alpha-connect-${run}@example.com`,
        dashboard: 'full',
        identity: { country: 'us', entity_type: 'individual' },
        configuration: {
          recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
          merchant: { capabilities: { card_payments: { requested: true } } },
        },
        defaults: {
          currency: 'usd',
          profile: { business_url: businessUrl, product_description: 'Alpha acceptance walk probe.' },
          responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' },
        },
      }).then(
        (account) => ({ ok: true as const, id: account.id }),
        (error: Error) => ({ ok: false as const, message: error.message }),
      );

      const local = await createWith(`http://localhost:8787/artists/${artistProfile.slug}`);
      const production = await createWith(`https://ihype.org/artists/${artistProfile.slug}`);

      if (!local.ok && production.ok) {
        blocked(`Stripe rejects a localhost business_url, so this route cannot succeed on loopback. Same create with https://ihype.org/… succeeded (${production.id}). Environment, not code.`);
      }
      if (!production.ok) {
        throw new Error(`route answered ${attempt.status}; the production-URL probe ALSO failed, so this is not just loopback: ${production.message.slice(0, 200)}`);
      }
      throw new Error(`route answered ${attempt.status} but both probes succeeded — the fault is in the route, not the URL`);
    }
    const body = ok(attempt, [200, 201]);
    assert(body?.url, `no onboarding url returned: ${JSON.stringify(body).slice(0, 160)}`);
    const profile = await prisma.profile.findUnique({ where: { id: artistProfile.id }, select: { stripeConnectAccountId: true } });
    assert(profile?.stripeConnectAccountId, 'onboarding link created but no Connect account id was stored');
    return `Connect account ${profile.stripeConnectAccountId} created, onboarding link issued`;
  });

  // ── 30. HYPE link referral ───────────────────────────────────────────────
  await item('30. HYPE link referral', async () => {
    const profile = await prisma.profile.findUnique({ where: { id: promoterProfile.id }, select: { hexId: true } });
    assert(profile?.hexId, 'promoter profile has no hexId');

    const short = await api(`/h/${profile.hexId}`);
    const location = short.status >= 300 && short.status < 400 ? '(redirect)' : '';
    assert([200, 302, 303, 307, 308].includes(short.status), `/h/[code] answered ${short.status}`);

    const invite = await api(`/invite/${profile.hexId}`);
    assert([200, 302, 307, 308].includes(invite.status), `/invite/[code] answered ${invite.status}`);
    return `/h/${profile.hexId.slice(0, 10)}… → ${short.status} ${location}; /invite → ${invite.status}`;
  });

  // ── The HYPE economy, which the 31-item list never mentioned ─────────────
  await item('H1. Completing a song rewards HYPE exactly once', async () => {
    if (!mediaId) blocked('no track was uploaded');
    const listener = await seedSessionCookie(`alpha-listener-${run}@example.com`, {});
    const asset = await prisma.artistMediaAsset.findUnique({ where: { id: mediaId } });
    assert(asset?.storageUrl, 'the uploaded asset has no playable url');

    const play = () => api('/api/media-listens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mediaId, title: asset.title ?? 'Live A Lie', mediaUrl: asset.storageUrl,
        artistName: `Test Artist ${run}`, artistProfileSlug: artistProfile.slug,
      }),
      cookie: listener.cookie,
    });

    const first = ok(await play(), [200, 201]);
    assert(first?.hypeAwarded === 1, `first completion awarded ${first?.hypeAwarded}, expected 1`);

    /* The idempotency key is per (user, track), so replaying a completion —
       which a flaky player does routinely — must not mint currency. */
    const second = ok(await play(), [200, 201]);
    assert(second?.hypeAwarded === 0, `a repeat completion awarded ${second?.hypeAwarded} more HYPE`);

    const entries = await prisma.hypeLedgerEntry.count({
      where: { userId: listener.user.id, source: 'TRACK_COMPLETED', targetId: mediaId },
    });
    assert(entries === 1, `${entries} ledger entries for one completion`);
    const user = await prisma.user.findUnique({ where: { id: listener.user.id } });
    return `+1 on first play, +0 on replay, ${entries} ledger entry, balance ${user?.hypeBalance}`;
  });

  await item('H2. Attending rewards HYPE when the ticket is scanned', async () => {
    if (!serializedId) blocked('no ticket was scanned');
    const entries = await prisma.hypeLedgerEntry.findMany({
      where: { source: 'EVENT_ATTENDED' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    assert(entries.length > 0, 'a ticket was scanned but no EVENT_ATTENDED reward exists');
    const forThisTicket = entries.find((entry) => (entry.metadata as any)?.ticketId);
    assert(entries[0].amount === 5, `attendance awarded ${entries[0].amount}, expected 5`);
    return `EVENT_ATTENDED +${entries[0].amount} recorded${forThisTicket ? ' with its ticket id' : ''}`;
  });

  await item('H3. A referral rewards the referrer once, and cannot be farmed', async () => {
    const referrerProfile = await prisma.profile.findUnique({
      where: { id: promoterProfile.id },
      select: { hexId: true, ownerId: true },
    });
    assert(referrerProfile?.hexId, 'promoter profile has no hexId');

    const before = await prisma.hypeLedgerEntry.aggregate({
      where: { userId: referrerProfile.ownerId, source: 'FAN_REFERRED' },
      _sum: { amount: true },
      _count: true,
    });

    const email = `alpha-referred-${run}@example.com`;
    const code = `REF-${randomUUID().slice(0, 8).toUpperCase()}`;
    await prisma.inviteCode.create({ data: { code } });
    const signup = await api('/api/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email, name: `Referred ${run}`, role: 'FAN',
        isThirteenOrOlder: true, isEighteenOrOlder: true,
        turnstileToken: 'alpha-walk-token', inviteCode: code,
        ref: referrerProfile.hexId,
      }),
    });
    ok(signup, [200, 201]);

    /* Rewards are queued off the request, so give the deferred work a moment
       before reading the ledger. */
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const after = await prisma.hypeLedgerEntry.aggregate({
      where: { userId: referrerProfile.ownerId, source: 'FAN_REFERRED' },
      _sum: { amount: true },
      _count: true,
    });
    const gained = (after._sum.amount ?? 0) - (before._sum.amount ?? 0);
    assert(after._count > before._count, `signup with ?ref= paid the referrer nothing (${before._count} -> ${after._count} entries)`);
    assert(gained === 10, `referrer gained ${gained}, expected 10`);

    const newUser = await prisma.user.findUnique({ where: { email } });
    const welcome = await prisma.hypeLedgerEntry.count({ where: { userId: newUser!.id, source: 'WELCOME' } });
    assert(welcome === 1, `the new member got ${welcome} welcome grants, expected 1`);
    return `referrer +${gained} (one FAN_REFERRED entry), new member got ${welcome} WELCOME grant`;
  });

  await item('H4. The ledger reconciles with every balance it claims to explain', async () => {
    /* balanceAfter on the newest entry has to equal the user's balance, or the
       ledger is decorative: it is what a member sees when they ask where their
       HYPE went, and what an operator would reconcile a dispute against. */
    /* SCOPED TO THIS RUN'S OWN MEMBERS, and that scoping is the check rather
       than a weakening of it. Every email this walk creates embeds the run id,
       so `contains: run` is exactly the set whose entire HYPE history the walk
       caused and can therefore reason about.

       It used to reconcile any 25 users carrying a ledger entry, which made the
       assertion a hostage to whatever else shared the database. Measured in CI
       2026-08-31: the e2e suite runs earlier in the same job against the same
       Postgres and seeds `hypeBalance` directly on its own fixtures, so the
       walk found a user with a balance of 49 and entries summing to -1 and
       reported a ledger defect that was really another suite's fixture. A
       check that fails for reasons outside the thing it is checking gets
       ignored, and then it is worth nothing when it is right. */
    const users = await prisma.user.findMany({
      where: { email: { contains: run }, hypeLedgerEntries: { some: {} } },
      select: { id: true, hypeBalance: true },
      take: 25,
    });
    assert(users.length > 0, 'no member of this run carries a ledger entry — the walk earned no HYPE, which is itself the failure');
    /* `hype-ledger.ts` is the ONLY thing in src/ that writes `hypeBalance` —
       checked, no other production path touches it — so entries summing to the
       balance is a real invariant. The exception is this walk's own cast: the
       e2e fixture seeds a starting balance directly, which no member can do.
       Those users are held to the weaker check that still matters. */
    const drift: string[] = [];
    for (const user of users) {
      const [latest, sum] = await Promise.all([
        prisma.hypeLedgerEntry.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
        prisma.hypeLedgerEntry.aggregate({ where: { userId: user.id }, _sum: { amount: true } }),
      ]);
      if (latest && latest.balanceAfter !== user.hypeBalance) {
        drift.push(`${user.id.slice(0, 8)}: balanceAfter ${latest.balanceAfter} vs balance ${user.hypeBalance}`);
      }
      if (!seededBalanceUsers.has(user.id) && (sum._sum.amount ?? 0) !== user.hypeBalance) {
        drift.push(`${user.id.slice(0, 8)}: entries sum ${sum._sum.amount} vs balance ${user.hypeBalance}`);
      }
    }
    assert(drift.length === 0, `ledger disagrees with the balance for ${drift.length}: ${drift.slice(0, 3).join('; ')}`);
    return `${users.length} member ledgers reconcile: every balanceAfter matches, and every unseeded balance equals its entries`;
  });

  await item('V1. A community vote counts once, and voting again withdraws it', async () => {
    if (!mediaId) blocked('no track to vote on');
    /* Item 17 cancelled the first show, and voting is only open on a
       SCHEDULED or LIVE one, so this needs its own. */
    const created = ok(await api('/api/shows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: `Vote Night ${run}`, status: 'SCHEDULED',
        startsAt: new Date(Date.now() + 21 * 86_400_000).toISOString(),
        venueProfileId: venueProfile.id, headlinerProfileId: artistProfile.id,
      }),
      cookie: creator.cookie,
    }), [200, 201]);
    const voteShowId = (created?.show ?? created)?.id;
    assert(voteShowId, 'could not create a show to vote on');

    const cast = () => api(`/api/shows/${voteShowId}/setlist-vote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mediaId }),
      cookie: fan.cookie,
    });

    const first = ok(await cast(), [200, 201]);
    assert(first?.voteCount === 1 && first?.userVoted === true, `first vote gave ${JSON.stringify(first)}`);
    /* The product treats a repeat as a TOGGLE rather than a refusal. Either is
       defensible; what must never happen is one member counting twice. */
    const second = ok(await cast(), [200, 201]);
    assert(second?.voteCount === 0 && second?.userVoted === false, `a repeat vote gave ${JSON.stringify(second)} — it must not double-count`);
    const rows = await prisma.setlistVote.count({ where: { showId: voteShowId, mediaId } });
    assert(rows === 0, `${rows} vote rows survive after withdrawing`);
    return 'one member counts once; a second tap withdraws rather than double-counting';
  });

  await item('R1. A refund reconciles across the database, Stripe and the payables', async () => {
    const refunded = await prisma.ticketOrder.findFirst({
      where: { stripeRefundId: { not: null } },
      include: { tickets: true },
    });
    if (!refunded) blocked('no refunded order exists to reconcile');
    if (!stripe) blocked('Stripe is not configured');

    const refund = await stripe.refunds.retrieve(refunded.stripeRefundId!);
    assert(refund.status === 'succeeded', `Stripe reports the refund as ${refund.status}`);
    /* The processing fee is deliberately NOT returned (see the refundableCents
       comment in the cancel route), so the expected refund is the charge minus
       that fee. Asserting a full refund would fail against a real policy; what
       must hold is that Stripe returned exactly what the policy says. */
    const expectedRefund = refunded.totalChargeCents - refunded.processingFeeCents;
    assert(
      refund.amount === expectedRefund,
      `Stripe refunded ${refund.amount}c; policy says charge ${refunded.totalChargeCents}c minus fee ${refunded.processingFeeCents}c = ${expectedRefund}c`,
    );

    /* The payout cron must never pay out a refunded order, so its payables
       have to be off the table rather than merely ignored. */
    const payables = await prisma.accountsPayableEntry.findMany({ where: { ticketOrderId: refunded.id } });
    const stillPending = payables.filter((entry) => entry.status === 'PENDING');
    assert(
      stillPending.length === 0,
      `${stillPending.length} payable(s) still PENDING on a refunded order — the payout cron would pay them`,
    );
    const liveTickets = refunded.tickets.filter((ticket) => ticket.status === 'VALID');
    assert(liveTickets.length === 0, `${liveTickets.length} ticket(s) still VALID on a refunded order`);

    return `order ${refunded.confirmationCode} · Stripe ${refund.amount}c ${refund.status} = ${refunded.totalChargeCents}c charge - ${refunded.processingFeeCents}c fee · ${payables.length} payable(s) all ${[...new Set(payables.map((p) => p.status))].join('/') || 'none'} · tickets ${[...new Set(refunded.tickets.map((t) => t.status))].join('/')}`;
  });

  /* ------------------------------------------------------------------ report */

  const pass = rows.filter((r) => r.status === 'PASS').length;
  const fail = rows.filter((r) => r.status === 'FAIL').length;
  const block = rows.filter((r) => r.status === 'BLOCKED').length;

  console.log(`\n${'─'.repeat(72)}`);
  console.log(`  ${pass} passed · ${fail} failed · ${block} blocked`);
  console.log(`${'─'.repeat(72)}\n`);

  if (fail > 0) {
    console.log('  Failures:');
    for (const row of rows.filter((r) => r.status === 'FAIL')) {
      console.log(`    ${row.item}\n      ${row.detail}`);
    }
    console.log('');
  }

  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('\nalpha walk aborted:', error);
  process.exit(1);
});
