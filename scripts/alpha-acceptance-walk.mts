Warning: truncated output (original token count: 38507)
Total output lines: 2613

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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { seedSessionCookie, sessionCookieName } from '../e2e/fixtures/session';
import { buildTicketVerificationUrl } from '../src/lib/tickets';
import { hashTicketCode } from '../src/lib/door-manifest';
import { exitCodeFor, renderBoard, rollUp } from '../src/lib/feature-health';

const BASE = (process.env.ALPHA_BASE_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const DATABASE_URL = process.env.DATABASE_URL ?? '';
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const CRON_SECRET = process.env.CRON_SECRET ?? '';
/* `--report=<path>` writes the run as JSON so the board can be re-rendered
   without driving the product again — the nightly reads it for its summary. */
const REPORT_PATH = (process.argv.find((a) => a.startsWith('--report=')) ?? '').slice('--report='.length);
const SONG_PATH = process.env.ALPHA_SONG ?? '';
const AUDIO_MIME_BY_EXT: Record<string, string> = {
  m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac',
};
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
    /* undici says "fetch failed" and puts the reason (ECONNRESET, ECONNREFUSED,
       a dead keep-alive socket) on `cause`; without it the line is useless. */
    const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : '';
    const message = (error instanceof Error ? error.message : String(error)) + cause;
    if (message.startsWith('BLOCKED:')) record(name, 'BLOCKED', message.slice(8).trim());
    else record(name, 'FAIL', message.slice(0, 280));
  }
}

function blocked(reason: string): never {
  throw new Error(`BLOCKED: ${reason}`);
}

/*
 * A 429 from `/api/register` says this SERVER has already run a walk, not that
 * signup is broken.
 *
 * The limiter is keyed per client IP and every request here arrives from
 * loopback, so a second walk against the same workerd process is one caller
 * hammering signup — exactly what the bucket is for. Reported as FAIL it looks
 * like the product refusing legitimate members, and it lands on the four items
 * that open the walk, so the run reads as catastrophic when nothing is wrong.
 * Restarting the worker clears it; the nightly starts a fresh one every time
 * and never sees this.
 */
function blockIfSignupThrottled(res: { status: number }): void {
  if (res.status === 429) {
    blocked('the signup rate limiter still holds from an earlier walk against this server — restart the worker to clear it');
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/* ------------------------------------------------------------------ plumbing */

function cookieHeader(cookie: string) {
  return `${sessionCookieName()}=${cookie}`;
}

type ApiResult = { status: number; body: any; text: string; location: string | null; setCookie: string | null };

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
  return {
    status: response.status,
    body,
    text,
    location: response.headers.get('location'),
    setCookie: response.headers.get('set-cookie'),
  };
}

function ok(result: ApiResult, expected: number[] = [200, 201]) {
  assert(
    expected.includes(result.status),
    `expected ${expected.join('/')}, got ${result.status}: ${(result.body?.error ?? result.text ?? '').toString().slice(0, 160)}`,
  );
  return result.body;
}

/* ------------------------------------------------------------ mail sink */

/**
 * "A notification actually leaves the building" was UNCOVERED because the only
 * exit was a live Resend call and the nightly has no key. `src/lib/mailer.ts`
 * now posts every message to `EMAIL_SINK_URL` instead — on LOOPBACK only, so
 * a production Worker cannot be pointed anywhere by it — and this is the other
 * end: a plain HTTP listener collecting what the worker sends, for items to
 * read back. The worker and the walk must agree on the URL, which is why it
 * is one env var set on both (see the nightly's walk step).
 */
type SunkEmail = { from: string; to: string | string[]; subject: string; text: string; html: string; receivedAt: number };
const EMAIL_SINK_URL = process.env.EMAIL_SINK_URL ?? '';

async function startEmailSink(inbox: SunkEmail[]): Promise<{ close: () => Promise<void>; error: string | null }> {
  if (!EMAIL_SINK_URL) return { close: async () => {}, error: 'EMAIL_SINK_URL is not set' };
  let url: URL;
  try { url = new URL(EMAIL_SINK_URL); } catch { return { close: async () => {}, error: `EMAIL_SINK_URL is not a URL: ${EMAIL_SINK_URL}` }; }
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Omit<SunkEmail, 'receivedAt'>;
        inbox.push({ ...parsed, receivedAt: Date.now() });
        res.writeHead(202).end();
      } catch {
        res.writeHead(400).end();
      }
    });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(Number(url.port || 80), url.hostname === 'localhost' ? '127.0.0.1' : url.hostname, () => resolve());
    });
  } catch (error) {
    return { close: async () => {}, error: error instanceof Error ? error.message : String(error) };
  }
  return { close: () => new Promise<void>((resolve) => server.close(() => resolve())), error: null };
}

async function waitFor<T>(probe: () => T | undefined | null, timeoutMs: number, everyMs = 250): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = probe();
    if (found) return found;
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
}

/**
 * Records an admin re-auth the way `POST /api/admin/reauth` does after a
 * passkey assertion — the same KV key `src/lib/admin-confirmation.ts` writes,
 * into the same store the worker reads. The walk cannot perform a passkey
 * ceremony (no authenticator), exactly as it cannot sign in and seeds a
 * session cookie instead; the item asserts the gate FIRST (401 without this)
 * so what is measured is the enforcement, not the shortcut. Reaching the
 * store needs the harness's persist directory, which `scripts/e2e-workerd.mjs`
 * publishes in a sidecar; against any other worker this BLOCKS with the reason.
 */
async function seedAdminReauth(userId: string): Promise<void> {
  const sidecar = '.wrangler-e2e-workerd.persist';
  if (!existsSync(sidecar)) {
    blocked(`no ${sidecar} — the worker is not scripts/e2e-workerd.mjs, so its KV cannot be reached to record the admin re-auth`);
  }
  const persist = readFileSync(sidecar, 'utf8').trim();
  if (!persist || !existsSync(persist)) blocked(`the harness's persist dir "${persist}" does not exist`);
  const wrangler = 'node_modules/wrangler/bin/wrangler.js';
  if (!existsSync(wrangler)) blocked('wrangler is not installed here, so the admin re-auth key cannot be written');
  /* The binding carries both an `id` and a `preview_id`, and wrangler refuses
     to guess which one a local put means. `wrangler dev` reads the preview
     namespace when one is configured; written to both, the key is there
     whichever store the worker opened, and a scratch store has no third party
     to mind the duplicate. */
  for (const preview of ['--preview', '--preview=false']) {
    /* Awaited, not spawnSync: each wrangler run takes seconds, and a blocked
       event loop cannot see the worker close an idle keep-alive socket in the
       meantime — the next PATCH then goes out on a dead socket and undici
       reports "fetch failed" for a request it will not retry. Measured. */
    const result = await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(process.execPath, [
        wrangler, 'kv', 'key', 'put', '--local', preview,
        '--persist-to', persist,
        '--config', '.wrangler-e2e-workerd.toml',
        '--binding', 'KV',
        `admin_reauth:${userId}`, String(Date.now()),
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });
      const timer = setTimeout(() => child.kill('SIGKILL'), 90_000);
      child.on('close', (status) => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
    });
    const said = `${result.stdout}\n${result.stderr}`;
    /* wrangler exits 0 on its own configuration errors, so the text is the
       verdict; the proxy notice it prints in this sandbox is not one. */
    const failed = result.status !== 0 || /ERROR/.test(said);
    if (failed) {
      const reason = said.split('\n').filter((line) => /ERROR|rror:/.test(line)).join(' ').replace(/\u001b\[[0-9;]*m/g, '').trim() || said.trim().slice(-400);
      blocked(`wrangler kv key put ${preview} failed (exit ${result.status}): ${reason}`);
    }
  }
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
  /*
   * A PLACEHOLDER key is not an absent one, and the difference has misled this
   * project before. The prefix check above passes `sk_test_…` — eight real
   * characters and a single non-ASCII ellipsis — which is exactly the value
   * this sandbox carries. With it set, every money item runs, Stripe refuses
   * the request ("An error occurred with our connection to Stripe", because
   * the client cannot even encode the header), and the item reports FAIL as
   * though the product were broken. Nine sibling items report BLOCK for the
   * same underlying condition, so the run contradicts itself.
   *
   * Refuse it loudly instead. Absent means BLOCK; present-but-unusable means
   * fix your configuration. Same distinction `generate-app-links.mjs --check`
   * draws between a missing file and a malformed one.
   */
  if (STRIPE_KEY) {
    const printableAscii = /^[\x21-\x7e]+$/.test(STRIPE_KEY);
    if (!printableAscii || STRIPE_KEY.length < 30) {
      throw new Error(
        `Refusing to run: STRIPE_SECRET_KEY is ${STRIPE_KEY.length} characters` +
          `${printableAscii ? '' : ' and contains a non-ASCII character'} — that is a placeholder, not a key. ` +
          'Unset it to have the money items report BLOCKED, or set a real sk_test_ key to run them.',
      );
    }
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

  const sinkInbox: SunkEmail[] = [];
  const sink = await startEmailSink(sinkInbox);

  const song = readFileSync(SONG_PATH);
  /* The song is whatever ALPHA_SONG points at — the real m4a on an operator's
     machine, a generated WAV in the nightly — so the upload describes the file
     it has rather than the one this script was written against. Item 7's label
     used to say "real 4.7 MB m4a" over a 3.9 MB WAV every night. The route
     sniffs magic bytes and ignores both name and type, so neither ever changed
     the result; they changed what a reader of the log believed was uploaded. */
  const songExt = (extname(SONG_PATH).slice(1) || 'bin').toLowerCase();
  const songMime = AUDIO_MIME_BY_EXT[songExt] ?? 'application/octet-stream';
  const songLabel = `${(song.length / 1024 / 1024).toFixed(1)} MB ${songExt.toUpperCase()}`;
  const graphic = readFileSync(GRAPHIC_PATH);
  const adSpot = AD_AUDIO_PATH ? readFileSync(AD_AUDIO_PATH) : null;

  console.log(`\niHYPE alpha acceptance walk`);
  console.log(`  target   ${BASE}`);
  console.log(`  song     ${SONG_PATH} (${(song.length / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`  graphic  ${GRAPHIC_PATH} (${(graphic.length / 1024).toFixed(0)} KB)`);
  console.log(`  run id   ${run}`);
  console.log(`  mail     ${sink.error ? `no sink (${sink.error})` : `sink listening at ${EMAIL_SINK_URL}`}\n`);

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

  /* ── Ad delivery helpers, shared by items 20c, 22 and 33 ────────────────
     A break is never placed first or last, so a one-track station has nowhere
     to put one — two is the minimum rotation that can carry an ad at all. The
     walk's artist uploads one track, so a second is seeded on demand, once per
     run, rather than by each item that needs it. */
  let stationRotationSeeded = false;
  /* The second track's public id, so the recommendation items can accept
     EITHER of the act's tracks — see item 32f. */
  let secondMediaHexId = '';
  async function ensureStationRotation(): Promise<void> {
    if (stationRotationSeeded) return;
    if (!song.length) return;
    const second = new FormData();
    second.set('profileId', artistProfile.id);
    second.set('title', 'Live A Lie (Reprise)');
    second.set('notes', 'TEST ARTIST SONG 2 — gives the station a rotation');
    second.set('freeUseEnabled', 'false');
    second.set('file', new Blob([song], { type: songMime }), `test-artist-song-2.${songExt}`);
    const upload = await api('/api/artist-media', { method: 'POST', body: second, cookie: creator.cookie });
    /* Flagged only once the track really landed, so a transient upload failure
       is retried by the next caller rather than leaving every later item
       measuring a one-track station and blaming the product for it. */
    if (upload.status === 200 || upload.status === 201) {
      stationRotationSeeded = true;
      secondMediaHexId = String((upload.body as any)?.asset?.hexId ?? (upload.body as any)?.hexId ?? '');
    }
  }

  /* This run must own the inventory it asserts on. The scratch database
     accumulates campaigns across runs and `resolveWeightedAdBreakClips` orders
     by `impressions: asc`, so a never-served campaign from last night outranks
     the one under test and the assertion fails on a fixture rather than on the
     product. Close every other window instead of widening the assertion. */
  async function ownAdInventory(adId: string): Promise<void> {
    await prisma.ad.updateMany({
      where: { id: { not: adId }, status: 'APPROVED' },
      data: { endsAt: new Date(Date.now() - 60_000) },
    });
  }

  /* The play token is the only thing that can bill a campaign: the impression
     route reads the ad out of it and refuses a bare id (src/lib/ad-play-token.ts).
     So the walk has to be SERVED one, exactly as a listener is — minting one
     here would prove nothing about the wiring under test. */
  async function findServedAdPlayToken(adId: string, cookie: string): Promise<{ token: string; where: string } | null> {
    const stations = await api('/api/stations', { cookie });
    const slugs: string[] = ((stations.body as any)?.stations ?? []).map((entry: any) => entry?.slug).filter(Boolean);
    for (const slug of slugs) {
      const page = await api(`/api/stations/${slug}/tracks?limit=40`, { cookie });
      const rows: any[] = (page.body as any)?.tracks ?? [];
      const hit = rows.find((row) => row?.adClipId === `mkt_${adId}` && row?.adPlayToken);
      if (hit) return { token: String(hit.adPlayToken), where: `station "${slug}"` };
    }
    const radio = await api('/api/radio/station', { cookie });
    const body = radio.body as any;
    const seq: any[] = [body?.nowPlaying, ...(body?.upNext ?? [])].filter(Boolean);
    const hit = seq.find((row) => row?.adClipId === `mkt_${adId}` && row?.adPlayToken);
    return hit ? { token: String(hit.adPlayToken), where: '/api/radio/station' } : null;
  }

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

    blockIfSignupThrottled(gated);

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
    blockIfSignupThrottled(first);
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
      blockIfSignupThrottled(result);
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
    const probe = await api('/api/me', { cookie: fan.cookie });
    /* The one wrong-environment failure that reads as a product bug. A
       production build (any workerd target) names its session cookie
       __Secure-authjs.session-token, and the fixture mints under the name
       sessionCookieName() returns — so without PLAYWRIGHT_AUTH_COOKIE_SECURE=true
       every authenticated item answers 401 and nothing else in the walk means
       anything. Measured 2026-09-01: 17 failures, all this. */
    assert(
      probe.status !== 401 || process.env.PLAYWRIGHT_AUTH_COOKIE_SECURE === 'true',
      '/api/me answered 401 with the seeded cookie. If the target is a production build (workerd), set PLAYWRIGHT_AUTH_COOKIE_SECURE=true so the fixture mints and sends __Secure-authjs.session-token.',
    );
    const me = ok(probe);
    assert(me?.user?.id === fan.user.id || me?.id === fan.user.id, `/api/me did not return the signed-in user: ${JSON.stringify(me).slice(0, 120)}`);
    return `/api/me resolved ${fan.user.email}`;
  });

  // ── 7. Upload song — the REAL file ALPHA_SONG names ──────────────────────
  await item('7. Upload song (the real file ALPHA_SONG names)', async () => {
    const form = new FormData();
    form.set('profileId', artistProfile.id);
    form.set('title', 'Live A Lie');
    form.set('notes', 'TEST ARTIST SONG — alpha acceptance walk');
    form.set('freeUseEnabled', 'false');
    form.set('file', new Blob([song], { type: songMime }), `test-artist-song.${songExt}`);
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
    return `${songLabel} as asset ${asset.id.slice(0, 8)} · ${asset.fileSizeBytes ?? '?'} bytes · ${layers} scan layers · ${artwork}`;
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

    /* Counted by HEXID, because that is the name every reader of this table
       uses (profile-insights, profile-stat-board, the artist analytics page,
       the track page) — the route stored the row id until 2026-09-14, so a
       count by row id here passed while every one of those read 0 (row 436). */
    const listens = await prisma.mediaListen.count({ where: { mediaId: mediaHexId, userId: fan.user.id } });
    assert(listens > 0, 'play answered ok but no MediaListen row was written under the track\'s hexId');
    const byRowId = await prisma.mediaListen.count({ where: { mediaId, userId: fan.user.id } });
    assert(byRowId === 0, `${byRowId} listen row(s) stored under the ROW id — nothing that counts listens reads that name`);

    /* The PLAYER's shape. `toQueue` addresses a track by hexId and the
       completion POST carries that, not the row id this item sends above —
       and the route looked the row up by id, so every completion a real
       browser ever sent answered 404 while this item passed (row 436). Same
       listen, second name: it must answer ok and land on the SAME row. */
    ok(await api('/api/media-listens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mediaId: mediaHexId,
        title: asset.title ?? 'Live A Lie',
        mediaUrl: asset.storageUrl,
        artistName: `Test Artist ${run}`,
        artistProfileSlug: artistProfile.slug,
      }),
      cookie: fan.cookie,
    }), [200, 201]);
    const listensByEitherName = await prisma.mediaListen.count({ where: { userId: fan.user.id, mediaId: { in: [mediaId, mediaHexId] } } });
    assert(listensByEitherName === 1, `the hexId-shaped completion made ${listensByEitherName} row(s) for one track — the route must resolve both names to one listen`);

    /* And a READER sees it: the artist's own stats board, which is what the
       owner opens to learn whether anyone listened. A raw count proves a row
       exists; only a reader proves the row is under the name the product
       looks for. `GET /api/profile/stats` is owner-gated, so the creator asks. */
    const board = ok(await api(`/api/profile/stats?profileId=${encodeURIComponent(artistProfile.id)}`, { cookie: creator.cookie }));
    const tiles: any[] = Array.isArray(board?.stats) ? board.stats : [];
    const listensTile = tiles.find((tile) => tile?.key === 'listens');
    assert(listensTile, `the stats board answered without a Listens tile: ${JSON.stringify(board).slice(0, 200)}`);
    assert(Number(listensTile.value) >= 1, `the artist's Listens tile reads ${listensTile.value} after a fan finished the track — the count and the write disagree about the track's name`);

    /* The row is what the MUSIC tab's "Recently played" rail reads back, through
       GET /api/media-listens -> { recents } — hexId and cover hydrated from the
       asset, because the row itself stores neither and the rail addresses a
       track by hexId. This used to read `history.listens`, a key the route has
       never answered, and printed "history endpoint returned 0 row(s)" on
       every run without asserting on it: a number reported and not measured. */
    const history = ok(await api('/api/media-listens', { cookie: fan.cookie }));
    const recents: any[] = Array.isArray(history?.recents) ? history.recents : [];
    const mine = recents.find((row) => row.hexId === mediaHexId);
    assert(mine, `the fan just finished the track and GET /api/media-listens lists ${recents.length} recent(s), none of them this one`);
    assert(recents[0]?.hexId === mediaHexId, 'the track just finished is not the FIRST recent — the rail orders by completedAt desc');
    assert(mine.hexId === mediaHexId, `the recent carries hexId ${mine.hexId}, the asset's is ${mediaHexId}`);
    assert(mine.artworkUrl, 'the recent carries no artworkUrl, though item 7 stored a cover on the asset');
    assert(mine.mediaUrl, 'the recent carries no mediaUrl, so the rail could list it and not play it');
    return `MediaListen written under the hexId (${listens}), by row id and again by hexId onto the same row; the artist's Listens tile reads ${listensTile.value}; the Recently played rail lists it first, with its hexId, cover and audio`;
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
        /* On sale from now. `isTicketingOpen()` reads this column and the
           purchase route refuses a closed sale, so a ticketed show created
           without it can be published and never sold — which is exactly the
           state the product shipped in until the creator form started sending
           this. The walk sends what the form sends. */
        ticketingOpensAt: new Date().toISOString(),
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
    assert(promoterEntry, `no promoter payable — the HYPE-link 10% was dropped (payables: ${payables.map((p) => `${p.category}:${p.amountCents}`).join(', ')})`);

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
        /* A sponsorship is a TERM (2026-09-10). `spotsPerDay`/`runDays` are
           refused now, and this item is what would have caught the storefront
           and the walk drifting apart. */
        months: 1,
        city: 'Portland',
        region: 'ME',
      }),
      cookie: advertiser.cookie,
    });
    const created = ok(campaign, [200, 201]);
    const ad = await prisma.ad.findFirst({ where: { adverti…8507 tokens truncated…stringify(engine.signals)})`);
    return `station + deck carry "${mine.reason}", deck leads with it, engine ready with signals ${JSON.stringify(engine.signals)}`;
  });

  await item('32g. A fan who follows the venue hears what other fans want there', async () => {
    await prisma.follow.create({ data: { followerId: friend.user.id, followeeProfileId: venueProfile.id } });
    // Artist-level, for the same reason as 32f above.
    const byTheAct = (hexId: unknown) => hexId === mediaHexId || (secondMediaHexId !== '' && hexId === secondMediaHexId);
    const station = ok(await api('/api/stations/friends/tracks?limit=25', { cookie: friend.cookie }));
    const row = (station.tracks as any[]).find((t) => byTheAct(t.hexId));
    assert(row, 'the wanted act is not in the follower\'s Recommended-by-friends station');
    assert(row.reason === `Fans want them at ${venueProfile.name}`, `reason was "${row.reason}"`);
    const engine = ok(await api('/api/recommend', { cookie: friend.cookie }));
    assert(engine.ready === true, `a fan with one follow got ready=${engine.ready}`);
    const rec = (engine.tracks as any[]).find((t) => byTheAct(t.hexId));
    assert(rec, 'the engine did not recommend the act fans want at the followed venue');
    assert(rec.reason === `Fans want them at ${venueProfile.name}`, `engine reason was "${rec.reason}"`);
    return `follower's station and engine both say "${row.reason}"`;
  });

  await item('32h. The venue books the act; every ask is answered and the fan is told', async () => {
    const patched = await api(`/api/venue-requests/${askId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      cookie: creator.cookie,
      body: JSON.stringify({ status: 'BOOKED' }),
    });
    ok(patched);
    const row = await prisma.venueConnectionRequest.findUnique({ where: { id: askId }, select: { status: true } });
    assert(row?.status === 'BOOKED', `ask status is ${row?.status}`);
    const told = await prisma.notification.count({ where: { userId: asker.user.id, type: 'ask-booked' } });
    assert(told === 1, `the asker got ${told} "ask-booked" notification(s), expected 1`);
    const board = ok(await api(`/api/profile/stats?profileId=${artistProfile.id}`, { cookie: creator.cookie }));
    const recs = (board.stats as any[]).find((s) => s.key === 'recommendations')?.value;
    assert(recs === 0, `a booked ask should leave the live ranking; artist Recommendations = ${recs}`);
    const fanPage = await api(`/app/fans/${(await prisma.profile.findFirst({ where: { ownerId: asker.user.id }, select: { slug: true } }))?.slug ?? '-'}?section=asks`, { cookie: asker.cookie });
    return `BOOKED · asker notified once · artist Recommendations back to 0 · fan Asks page ${fanPage.status}`;
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
    const checkoutUrl = new URL(String(url));
    assert(
      checkoutUrl.protocol === 'https:' && checkoutUrl.hostname === 'checkout.stripe.com',
      `returned url is not a Stripe Checkout url: ${checkoutUrl.origin}`,
    );
    return `setup-mode Checkout session created — ${checkoutUrl.origin}${checkoutUrl.pathname.slice(0, 28)}…`;
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
    blockIfSignupThrottled(signup);
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

  /* ── 33. The paid spot actually airs on the surface members listen on ──
     Last on purpose, because it changes the fixture: a second track and a
     re-opened campaign window would move the recommendation items above, and
     those assert exact reasons. */
  await item('33. A paid spot airs on the MUSIC station a member actually listens to', async () => {
    /* The gap this measures: ad interleaving lived only behind
       `getStationState()` → `GET /api/radio/station`, and nothing calls that
       route — `src/app/radio` went with the show creator, and the MMM shell
       reads `/api/stations/[slug]/tracks`, which served music only. An
       advertiser could be vetted, charged, and heard by nobody. */
    if (!song.length) blocked('ALPHA_SONG not set, so no second track can be uploaded');

    // A break is never placed first or last, so one track has nowhere to put
    // one. Two is the minimum rotation that can carry an ad at all.
    await ensureStationRotation();

    /* Item 20d deliberately expires the campaign to exercise settlement, so
       by here nothing is in flight. Re-open the window rather than buying a
       second campaign: what is under test is the airing, not the purchase. */
    const campaign = await prisma.ad.findFirst({
      where: { status: 'APPROVED', audioUrl: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    /* Item 20 buys the campaign through Stripe Checkout, so on a runner with
       no key there is nothing APPROVED to air. Blocking says that plainly;
       failing would report a product gap that is really a missing secret. */
    if (!campaign) blocked('no APPROVED campaign with audio exists here — item 20 needs a Stripe key to create one');
    await prisma.ad.update({
      where: { id: campaign.id },
      data: { startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 86_400_000) },
    });
    await ownAdInventory(campaign.id);

    const stations = ok(await api('/api/stations', { cookie: fan.cookie }));
    const slugs: string[] = (stations?.stations ?? []).map((entry: any) => entry?.slug).filter(Boolean);
    assert(slugs.length > 0, 'no stations to check');

    /* `null as ...`, not `: ... | null = null` — TypeScript narrows a `null`
       initialiser to `null` and never widens it for an assignment it cannot
       see in the same flow, so a later `best?.slug` read as `never`. */
    let best = null as { slug: string; rows: any[] } | null;
    for (const slug of slugs) {
      const page = ok(await api(`/api/stations/${slug}/tracks?limit=40`, { cookie: fan.cookie }));
      const pageRows: any[] = page?.tracks ?? [];
      if (!best || pageRows.length > best.rows.length) best = { slug, rows: pageRows };
    }
    const stationRows = best?.rows ?? [];
    assert(stationRows.length >= 2, `longest station "${best?.slug}" served ${stationRows.length} row(s); a break needs two`);

    const breaks = stationRows.filter((row) => row?.adClipId);
    assert(breaks.length > 0, `station "${best?.slug}" served ${stationRows.length} rows and no ad break with a live campaign`);
    assert(breaks.every((row) => String(row.adClipId).startsWith('mkt_')),
      'a break carried a placeholder clip, which bills nobody');
    assert(breaks.some((row) => String(row.adClipId) === `mkt_${campaign.id}`),
      'the live campaign is not the one airing');
    // Never first, never last — a listener opening a station hears music.
    assert(!stationRows[0]?.adClipId && !stationRows[stationRows.length - 1]?.adClipId,
      'a break was placed at the head or tail of the rotation');
    assert(breaks.every((row) => row.mediaUrl), 'a break was served with no audio to play');
    /* Airing is only half of it: without the server's own receipt the player
       can report nothing and the spot is delivered but unbilled. */
    assert(breaks.every((row) => typeof row.adPlayToken === 'string' && row.adPlayToken.length > 0),
      'a break was served with no play token, so it can air and never bill');

    return `station "${best?.slug}" served ${stationRows.length} row(s) including ${breaks.length} paid break(s), all mkt_, all playable, all carrying a play token, none at head or tail`;
  });

  /* ── 34-36. The surfaces that were built and mounted nowhere ────────────
     Ten components shipped with a live route behind them and no page rendering
     them (2026-09-03). `audit:mounts` catches the static half — a component no
     route can reach — but it cannot tell a mounted component from a working
     one. These drive the real worker. */

  await item('34. Every surface that was mounted nowhere now renders', async () => {
    /* `getSimilarArtists` narrows to acts sharing a genre, and the fixture
       profiles have none — so the row correctly renders nothing and asserting
       on it would be asserting the fixture, not the wiring. Give this artist a
       genre and one neighbour who shares it. */
    await prisma.profile.update({ where: { id: artistProfile.id }, data: { genres: ['walk-genre'] } });
    await prisma.profile.upsert({
      where: { slug: `walk-neighbour-${run}` },
      update: { genres: ['walk-genre'] },
      create: {
        slug: `walk-neighbour-${run}`,
        // `hexId` is required and has no default — it is the public address
        // every embed and short link uses, so nothing may invent one lazily.
        hexId: `0x${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        name: `Walk Neighbour ${run}`,
        type: 'ARTIST',
        genres: ['walk-genre'],
        ownerId: creator.user.id,
      },
    });

    const checks: Array<[string, string, string, string | undefined]> = [
      // [what, path, a string only that component puts on the page, cookie]
      // The landing page is LOGGED OUT on purpose: a session on `/` redirects
      // to the workbench, so fetching it with a cookie measures the redirect.
      ['NearbyShowsWidget (logged out)', '/', 'Turn on precise location', undefined],
      ['SimilarArtistsRow', `/app/artists/${artistProfile.slug}?tab=bio`, 'Sounds like', creator.cookie],
      ['NewsletterSignup · artist', `/app/artists/${artistProfile.slug}?tab=contact`, 'Get updates by email', creator.cookie],
      ['NewsletterSignup · venue', `/app/venues/${venueProfile.slug}?tab=contact`, 'Get updates by email', creator.cookie],
      ['FanMailButton · artist', `/app/me/artists/${artistProfile.slug}/dashboard`, 'Email my followers', creator.cookie],
      ['FanMailButton · venue', `/app/me/venues/${venueProfile.slug}/dashboard`, 'Email my followers', creator.cookie],
      ['CommunityVoteBoard', '/app/me/info/community', 'Community roadmap', creator.cookie],
    ];

    const missing: string[] = [];
    for (const [what, path, marker, cookie] of checks) {
      const response = await api(path, cookie ? { cookie } : {});
      if (response.status !== 200) { missing.push(`${what}: ${path} answered ${response.status}`); continue; }
      /* The marker is copy only that component emits. A page that renders but
         has quietly lost the mount answers 200 with the marker gone — which is
         precisely the failure this whole item exists for. */
      if (!(response.text ?? '').includes(marker)) missing.push(`${what}: "${marker}" is not on ${path}`);
    }
    assert(missing.length === 0, missing.join(' · '));

    /* The ticket page's holder actions. The block is deliberately gated on
       `status !== 'SCANNED'` — transfer and resale are both meaningless once
       the code has been used at the door — and item 19 scans the walk's only
       ticket, so reading it as-is measures the gate rather than the mount.
       Buying a fresh one is not open either: item 32 cancels the show to
       exercise refunds, and a cancelled show sells nothing. So restore the
       precondition the block is written for, assert, and put the scan back
       so nothing downstream reads a door record that never happened. */
    let ticketNote = 'no ticket was sold here, so the holder actions were not checked';
    if (serializedId) {
      const scanned = await prisma.ticket.findFirst({ where: { serializedId } });
      if (scanned?.status === 'SCANNED') {
        await prisma.ticket.update({ where: { id: scanned.id }, data: { status: 'VALID' } });
      }
      const page = await api(`/app/me/tickets/${serializedId}`, { cookie: fan.cookie });
      if (scanned?.status === 'SCANNED') {
        await prisma.ticket.update({ where: { id: scanned.id }, data: { status: 'SCANNED' } });
      }
      assert(page.status === 200, `the ticket page answered ${page.status}`);
      assert((page.text ?? '').includes('What you can do with this ticket'),
        'TicketCardActions is not on the ticket page');
      assert((page.text ?? '').includes('List for resale') || (page.text ?? '').includes('Resend confirmation'),
        'the ticket page renders the actions block with neither resale nor resend in it');
      ticketNote = 'ticket page carries the holder actions';
    }
    return `${checks.length} surface(s) render their component; ${ticketNote}`;
  });

  await item('35. Free use can be withdrawn, and the crate lists published tracks only', async () => {
    if (!mediaHexId) blocked('no track was uploaded');

    /* The gap this closes: the tick was write-once. `TrackUploadPanel` set it
       and the only control that could clear it was mounted on no page. */
    const on = await api(`/api/artist-media/${mediaHexId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ freeUseEnabled: true }),
      cookie: creator.cookie,
    });
    ok(on);
    const listed = ok(await api('/api/artist-media/free-use?limit=50'));
    const inCrate = (listed.tracks as any[]).some((track) => track.hexId === mediaHexId);
    assert(inCrate, 'a track marked free-use is not in the crate');

    const off = await api(`/api/artist-media/${mediaHexId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ freeUseEnabled: false }),
      cookie: creator.cookie,
    });
    ok(off);
    const after = ok(await api('/api/artist-media/free-use?limit=50'));
    assert(!(after.tracks as any[]).some((track) => track.hexId === mediaHexId),
      'a withdrawn track is still in the crate — consent that cannot be withdrawn is not consent');

    /* A HELD upload is `isPublished: false` with no `publishAt`. It must never
       appear in a public crate with a playable stream url, free-use or not. */
    await prisma.artistMediaAsset.update({
      where: { hexId: mediaHexId },
      data: { freeUseEnabled: true, isPublished: false, publishAt: null },
    });
    const withHeld = ok(await api('/api/artist-media/free-use?limit=50'));
    const heldLeaked = (withHeld.tracks as any[]).some((track) => track.hexId === mediaHexId);
    await prisma.artistMediaAsset.update({
      where: { hexId: mediaHexId },
      data: { freeUseEnabled: false, isPublished: true },
    });
    assert(!heldLeaked, 'a HELD track marked free-use is listed publicly with a playable stream url');

    return 'free use goes on and comes back off; a held track never enters the crate';
  });

  await item('36. Fan mail reaches a confirmed newsletter subscriber', async () => {
    /* `NewsletterSubscription` was collected, double-opt-in confirmed, and read
       by nothing but the privacy export — a confirmation email that led to no
       email. The broadcast now counts subscribers alongside followers. */
    const address = `alpha-subscriber-${run}@example.com`;
    await prisma.newsletterSubscription.create({
      data: { email: address, profileId: artistProfile.id, confirmedAt: new Date() },
    });
    // An UNCONFIRMED row must never be written to.
    await prisma.newsletterSubscription.create({
      data: { email: `alpha-unconfirmed-${run}@example.com`, profileId: artistProfile.id },
    });
    await prisma.profile.update({ where: { id: artistProfile.id }, data: { fanMailLastSentAt: null } });

    const sendResult = await api(`/api/profile/${artistProfile.id}/fan-mail`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: `Walk ${run}`, content: 'A new track is up.' }),
      cookie: creator.cookie,
    });
    const body = ok(sendResult);
    /* `recipients` is the list; `sent` is what the provider accepted. This
       runner has no mail provider, so `sent` is 0 and asserting on it would be
       measuring the absence of a secret. The list is the thing under test —
       before this change a confirmed subscriber was never on it at all. */
    assert(typeof body?.recipients === 'number',
      `fan-mail did not report a recipient count: ${JSON.stringify(body).slice(0, 120)}`);
    assert(body.recipients >= 1,
      `fan mail resolved ${body.recipients} recipients with one confirmed subscriber on the list`);

    const again = await api(`/api/profile/${artistProfile.id}/fan-mail`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'Twice', content: 'Again.' }),
      cookie: creator.cookie,
    });
    assert(again.status === 429, `a second broadcast inside 7 days answered ${again.status}, expected 429`);

    return `${body.recipients} recipient(s) resolved including the confirmed subscriber (${body.sent} delivered — no mail provider here); a second send inside 7 days is refused 429`;
  });

  // ── 37-41. The journeys the health board called UNCOVERED ─────────────────
  const json = { 'Content-Type': 'application/json' };

  /* PageEditor PATCHes its ENTIRE state back on every save, and the route's
     emptyToNull reads an omitted field as "unchanged" but a null one as
     "cleared" — so an item that sent only the field it changed would be
     exercising a request the product never makes. Mirror the client: read,
     change, write everything back.

     NOTHING IS STRIPPED HERE, AND THAT IS THE POINT. This used to delete
     `capacity`, `fanShareEnabled`, `discoverable` and `pinnedStats` when they
     came back null, under a sentence claiming the schema typed them as
     absent-or-value. Three of the four are non-nullable columns and can never
     arrive null; the fourth, `capacity`, is null on every profile that is not
     a venue with a stated room size — so the one line of the harness that
     could have caught the defect was the line that removed it. Every ARTIST
     and LISTENER save was refused in production while item 37 passed here.
     Send what the browser sends. */
  const editorPayload = (current: Record<string, unknown>, changes: Record<string, unknown>) => {
    const { id: _id, slug: _slug, type: _type, ownerId: _ownerId, ...fields } = current;
    return { ...fields, ...changes, profileId: current.id };
  };

  await item('37. An artist edits their page and the public pane shows it', async () => {
    const editor = ok(await api(`/api/profile-editor?profileId=${artistProfile.id}`, { cookie: creator.cookie }));
    const current = (editor.profile ?? editor) as Record<string, unknown>;
    assert(current?.id === artistProfile.id, 'the editor GET did not return the artist profile');
    const bio = `Walk bio ${run}. Three piece from Portland Maine.`;
    ok(await api('/api/profile-editor', {
      method: 'PATCH', cookie: creator.cookie, headers: json,
      body: JSON.stringify(editorPayload(current, { bio, hometown: 'Portland, ME' })),
    }));
    const publicJson = ok(await api(`/api/profile/${artistProfile.slug}`, { cookie: fan.cookie }));
    const publicProfile = publicJson.profile ?? publicJson;
    assert(publicProfile.bio === bio, `the public profile JSON reads bio "${publicProfile.bio}" after the save`);
    const pane = await api(`/app/artists/${artistProfile.slug}?tab=bio`, { cookie: fan.cookie });
    assert(pane.status === 200, `the artist pane answered ${pane.status}`);
    assert(pane.text.includes(bio), 'the saved bio is not on the public artist pane');

    /* And nobody else can: a fan holding the profile id is refused, not
       silently ignored. */
    const stranger = await api('/api/profile-editor', {
      method: 'PATCH', cookie: fan.cookie, headers: json,
      body: JSON.stringify({ profileId: artistProfile.id, bio: 'vandalised' }),
    });
    assert(stranger.status === 403, `a non-owner's edit answered ${stranger.status}, not 403`);
    const untouched = ok(await api(`/api/profile/${artistProfile.slug}`, { cookie: fan.cookie }));
    assert((untouched.profile ?? untouched).bio === bio, "the refused edit still changed the bio");

    /* The venue's page is the same editor with a different section set. */
    const venueEditor = ok(await api(`/api/profile-editor?profileId=${venueProfile.id}`, { cookie: creator.cookie }));
    const hours = `Doors at seven, walk ${run}`;
    ok(await api('/api/profile-editor', {
      method: 'PATCH', cookie: creator.cookie, headers: json,
      body: JSON.stringify(editorPayload((venueEditor.profile ?? venueEditor) as Record<string, unknown>, { hoursText: hours })),
    }));
    const venuePane = await api(`/app/venues/${venueProfile.slug}?tab=info`, { cookie: fan.cookie });
    assert(venuePane.status === 200, `the venue pane answered ${venuePane.status}`);
    assert(venuePane.text.includes(hours), 'the saved hours are not on the public venue pane');
    return 'artist bio and venue hours saved, read back as JSON and on both public panes; a non-owner is refused 403 and changes nothing';
  });

  await item('38. Search finds the seeded act, venue, track and show by name', async () => {
    type Hit = { type: string; id: string; slug?: string; name: string };
    const find = async (q: string) => (ok(await api(`/api/search?q=${encodeURIComponent(q)}&limit=60`, { cookie: fan.cookie })).results ?? []) as Hit[];
    const misses: string[] = [];
    const byArtist = await find(`Test Artist ${run}`);
    if (!byArtist.some((r) => r.type === 'artist' && r.slug === artistProfile.slug)) misses.push(`artist "Test Artist ${run}"`);
    /* The track query matches on the ARTIST's name too, which is how a fan who
       remembers the band and not the song finds it — and how this item finds
       ours among every other run's copy of the same title. */
    if (mediaHexId && !byArtist.some((r) => r.type === 'song' && r.id === mediaHexId)) misses.push(`the uploaded track under "Test Artist ${run}"`);
    const byVenue = await find(`Test Venue ${run}`);
    if (!byVenue.some((r) => r.type === 'venue' && r.slug === venueProfile.slug)) misses.push(`venue "Test Venue ${run}"`);
    const byShow = await find(`Vote Night ${run}`);
    if (!byShow.some((r) => r.type === 'show' && r.name === `Vote Night ${run}`)) misses.push(`show "Vote Night ${run}"`);
    assert(misses.length === 0, `search returned nothing for: ${misses.join(' · ')}`);
    const nothing = ok(await api(`/api/search?q=${encodeURIComponent(`zqx-${run}-nothing-here`)}`));
    assert(Array.isArray(nothing.results) && nothing.results.length === 0, `a nonsense query returned ${nothing.results?.length} result(s)`);
    return `artist, its track, venue and show all found by name${mediaHexId ? '' : ' (no track to look for)'}; a nonsense query returns []`;
  });

  await item('39. A notification leaves the building: the magic-link email reaches the sink and signs in', async () => {
    if (!EMAIL_SINK_URL) blocked('set EMAIL_SINK_URL (a loopback URL, e.g. http://127.0.0.1:8791/emails) and EMAIL_FROM on BOTH the worker and the walk — the worker posts each email there instead of Resend');
    if (sink.error) blocked(`the walk could not listen at ${EMAIL_SINK_URL}: ${sink.error}`);
    const fanEmail = fan.user.email;
    assert(fanEmail, 'the fan has no email address');
    const before = sinkInbox.length;
    const asked = await api('/api/auth/magic-link', { method: 'POST', headers: json, body: JSON.stringify({ email: fanEmail }) });
    assert(asked.status === 200 && asked.body?.ok === true, `the magic-link request answered ${asked.status}: ${asked.text.slice(0, 160)}`);
    const mail = await waitFor(
      () => sinkInbox.slice(before).find((m) => [m.to].flat().includes(fanEmail) && /\/api\/auth\/magic\?token=/.test(m.text ?? '')),
      15_000,
    );
    assert(mail, `no magic-link email for ${fanEmail} reached the sink within 15s (${sinkInbox.length - before} other message(s) did; ${sinkInbox.length} in total so far) — the route answered ok:true either way, which is exactly why this item exists`);
    const link = mail.text.match(/https?:\/\/\S+\/api\/auth\/magic\?token=[A-Za-z0-9_-]+/)?.[0];
    assert(link, 'the email carries no magic link in its text');
    const target = new URL(link);

    /* A GET must SPEND NOTHING. Corporate mail security fetches every link in
       a message before the recipient sees it, and while this route consumed on
       GET that scanner burned the token — so the member clicked, was told the
       link had expired, and asking for another produced another one the same
       scanner burned. Twice, because once could be a fluke and the whole
       property is that looking is repeatable. */
    const looked = await api(`${target.pathname}${target.search}`);
    assert([302, 303, 307].includes(looked.status), `following the link answered ${looked.status}`);
    assert(!/error=/.test(looked.location ?? ''), `following the link redirected to an error: ${looked.location}`);
    assert(
      !(looked.setCookie ?? '').includes(sessionCookieName()),
      'a GET of the magic link signed somebody in — a mail scanner would spend the token before the member reads the message',
    );
    const lookedAgain = await api(`${target.pathname}${target.search}`);
    assert(!/error=/.test(lookedAgain.location ?? ''), `a second look burned the link: ${lookedAgain.location}`);

    // The POST the confirm page makes is the half that signs in.
    const confirmBody = new URLSearchParams({ token: new URL(looked.location ?? link, BASE).searchParams.get('token') ?? '' });
    const signIn = () => api('/api/auth/magic', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: confirmBody.toString(),
    });
    const signedIn = await signIn();
    assert([302, 303, 307].includes(signedIn.status), `posting the token answered ${signedIn.status}`);
    assert(!/error=/.test(signedIn.location ?? ''), `posting the token redirected to an error: ${signedIn.location}`);
    assert((signedIn.setCookie ?? '').includes(sessionCookieName()), 'posting the token set no session cookie');
    const replay = await signIn();
    assert(/error=/.test(replay.location ?? ''), `the same token worked twice (${replay.status} → ${replay.location})`);
    return `email to ${fanEmail} ("${mail.subject}") reached the sink; two GETs of its link spent nothing, the posted token signed the fan in once and was refused on replay; ${sinkInbox.length} email(s) left the worker during this walk`;
  });

  await item('40. A member exports their data, deletes their account, and nobody else loses a row', async () => {
    const leaver = await seedSessionCookie(`alpha-leaver-${run}@example.com`, {
      profiles: [{ type: 'ARTIST', name: `Leaving Act ${run}` }],
    });
    const leaverEmail = leaver.user.email!;
    const ticketsBefore = await prisma.ticket.count();
    const showsBefore = await prisma.show.count();
    const creatorProfilesBefore = await prisma.profile.count({ where: { ownerId: creator.user.id } });

    const anonymous = await api('/api/privacy/export');
    assert(anonymous.status === 401, `an anonymous export answered ${anonymous.status}`);
    const exported = await api('/api/privacy/export', { cookie: leaver.cookie });
    assert(exported.status === 200, `the export answered ${exported.status}: ${exported.text.slice(0, 160)}`);
    assert(exported.body && typeof exported.body === 'object', 'the export is not JSON');
    assert(exported.text.includes(leaverEmail), "the export does not carry the member's own email");
    assert(exported.text.includes(`Leaving Act ${run}`), "the export does not carry the member's profile");

    const wrongWord = await api('/api/settings/delete-account', { method: 'POST', cookie: leaver.cookie, headers: json, body: JSON.stringify({ confirm: 'yes' }) });
    assert(wrongWord.status === 400, `deletion without the exact confirmation answered ${wrongWord.status}`);
    const deleted = await api('/api/settings/delete-account', { method: 'POST', cookie: leaver.cookie, headers: json, body: JSON.stringify({ confirm: 'DELETE' }) });
    assert(deleted.status === 200, `deletion answered ${deleted.status}: ${deleted.text.slice(0, 200)}`);

    const after = await prisma.user.findUnique({ where: { id: leaver.user.id }, select: { email: true, name: true } });
    assert(!after || (after.email === null && after.name === null), `the erased member still carries ${after?.email ? 'an email' : 'a name'}`);
    const survivors = await prisma.profile.findMany({ where: { ownerId: leaver.user.id }, select: { name: true } });
    assert(survivors.every((p) => p.name !== `Leaving Act ${run}`), `the erased member's profile still carries its name (${survivors.length} row(s))`);
    /* The 2026-09-02 sweep found delete-account CASCADING every buyer's ticket
       and every payable on the organiser's shows. This is the row-count proof
       that erasing one member is erasing ONE member. */
    assert(await prisma.ticket.count() === ticketsBefore, 'erasing one member changed how many tickets other members hold');
    assert(await prisma.show.count() === showsBefore, 'erasing one member changed how many shows exist');
    assert(await prisma.profile.count({ where: { ownerId: creator.user.id } }) === creatorProfilesBefore, "erasing one member touched another member's profiles");
    const ghost = await api('/api/me', { cookie: leaver.cookie });
    assert(!(ghost.status === 200 && ghost.text.includes(leaverEmail)), 'the erased account still answers /api/me with its email');
    return `export 200 with email and profile (401 anonymous); delete refused without DELETE, then 200; member anonymised, ${survivors.length} profile row(s) left without the name; tickets ${ticketsBefore}, shows ${showsBefore} and the creator's profiles unchanged`;
  });

  await item('41. An admin acts on a report and the track comes down', async () => {
    assert(mediaHexId, 'no uploaded track to report (item 7 did not produce one)');
    ok(await api('/api/content-reports', {
      method: 'POST', cookie: fan.cookie, headers: json,
      body: JSON.stringify({ targetType: 'media', targetId: mediaHexId, reason: `walk ${run}: this is a rip` }),
    }));
    const report = await prisma.contentReport.findFirst({ where: { targetType: 'media', targetId: mediaHexId }, orderBy: { createdAt: 'desc' } });
    assert(report, 'no ContentReport row was written for the filed report');
    const approve = (cookie: string) => api(`/api/admin/moderation/${report.id}`, { method: 'PATCH', cookie, headers: json, body: JSON.stringify({ action: 'approve' }) });

    const asFan = await approve(fan.cookie);
    assert(asFan.status === 403, `a fan approving a report answered ${asFan.status}`);
    /* The real admin address: auth()'s jwt callback clamps role to ADMIN only
       for an allowlisted email, so any other seeded "admin" lands as a fan. */
    const admin = await seedSessionCookie('admin@ihype.org', { role: 'ADMIN' });
    const cold = await approve(admin.cookie);
    assert(cold.status === 401 && cold.body?.requiresReauth === true, `an admin without a recent passkey check answered ${cold.status} (${cold.text.slice(0, 120)}) — the step-up gate is gone`);

    await seedAdminReauth(admin.user.id);
    const approved = await approve(admin.cookie);
    assert(approved.status === 200, `approve answered ${approved.status}: ${approved.text.slice(0, 200)}`);
    const track = await prisma.artistMediaAsset.findUnique({ where: { hexId: mediaHexId }, select: { isPublished: true, freeUseEnabled: true } });
    assert(track && track.isPublished === false, 'the report was approved and the track is still published — enforcement did not run for a member-filed media report');
    assert(track.freeUseEnabled === false, 'the track came down but is still offered in the free-use crate');
    const row = await prisma.contentReport.findUnique({ where: { id: report.id }, select: { status: true } });
    assert(row?.status === 'ACTIONED', `the report reads ${row?.status}, not ACTIONED`);
    /* Put the track back so a later run of this walk against the same scratch
       database is not measuring this one's enforcement. */
    await prisma.artistMediaAsset.update({ where: { hexId: mediaHexId }, data: { isPublished: true } });
    return 'fan refused 403, cold admin refused 401 requiresReauth, re-authed admin approved: track unpublished and out of the crate, report ACTIONED';
  });

  await item('42. A player can seek: the CDN serves byte ranges, and levelling survives the round trip', async () => {
    assert(mediaHexId, 'no uploaded track to range-request (item 7 did not produce one)');
    const stored = await prisma.artistMediaAsset.findUnique({
      where: { hexId: mediaHexId },
      select: { storageUrl: true, fileSizeBytes: true, profile: { select: { ownerId: true } } },
    });
    /* Only an object really in R2 is served by /cdn. When the harness falls
       back to database storage there is no object to range at all, and
       measuring the fallback would prove nothing about the route. */
    const url = stored?.storageUrl;
    if (!url || !url.includes('/cdn/')) blocked('the uploaded track is not stored in R2, so /cdn has no object to range');
    const path = url.slice(url.indexOf('/cdn/'));

    const whole = await fetch(`${BASE}${path}`);
    assert(whole.status === 200, `the whole object answered ${whole.status}`);
    assert(
      whole.headers.get('accept-ranges') === 'bytes',
      'the CDN does not advertise Accept-Ranges, so a media element will never ask for one and every seek re-downloads the file',
    );
    const body = new Uint8Array(await whole.arrayBuffer());
    assert(body.length > 8, `the whole object came back as ${body.length} bytes`);

    /* The SIZE comes from the 206's Content-Range, not from Content-Length on
       the 200 — the first draft of this item read the latter and failed here,
       because the route serves a stream and the runtime frames a streamed
       response itself rather than honouring a Content-Length we set. The
       total in Content-Range is the authoritative figure either way, and it
       is the one a media element reads to size its seek bar. */
    const head = await fetch(`${BASE}${path}`, { headers: { range: 'bytes=0-3' } });
    assert(head.status === 206, `an opening probe answered ${head.status}, not 206`);
    const contentRange = head.headers.get('content-range') ?? '';
    const total = Number(contentRange.split('/')[1]);
    assert(Number.isFinite(total) && total > 0, `no usable total in Content-Range (${contentRange || 'absent'})`);
    assert(total === body.length, `Content-Range says ${total} bytes; the whole object is ${body.length}`);
    const size = total;
    assert(contentRange === `bytes 0-3/${size}`, `Content-Range read ${contentRange}`);
    const first = new Uint8Array(await head.arrayBuffer());
    assert(first.length === 4, `a four-byte range returned ${first.length} bytes`);
    assert(first.every((byte, i) => byte === body[i]), 'the opening probe did not return the first four bytes');

    /* The suffix form, which is the one that is easy to serve backwards: it
       must be the LAST bytes. A wrong reading here is audible as a glitch and
       looks like a working 206 from the outside. */
    const tail = await fetch(`${BASE}${path}`, { headers: { range: 'bytes=-4' } });
    assert(tail.status === 206, `a suffix range answered ${tail.status}`);
    const last = new Uint8Array(await tail.arrayBuffer());
    assert(
      last.length === 4 && last.every((byte, i) => byte === body[size - 4 + i]),
      'bytes=-4 did not return the last four bytes — the suffix range is being read from the start',
    );

    const past = await fetch(`${BASE}${path}`, { headers: { range: `bytes=${size + 10}-` } });
    assert(past.status === 416, `a range past the end answered ${past.status}, not 416`);
    assert(past.headers.get('content-range') === `bytes */${size}`, `the 416 carried ${past.headers.get('content-range')}`);

    /* The levelling half: a measurement the artist's browser would send has
       to be accepted, clamped, and readable back by the surface that plays
       the track. A nonsense one is refused rather than stored. */
    const owner = await seedSessionCookie(`alpha-level-${run}@example.com`);
    const asStranger = await api(`/api/artist-media/${mediaHexId}`, {
      method: 'PATCH', cookie: owner.cookie, headers: json, body: JSON.stringify({ loudnessLufs: -9.5 }),
    });
    assert(asStranger.status === 403, `a stranger levelling someone else's track answered ${asStranger.status}`);

    const artistOwner = await prisma.user.findUnique({ where: { id: stored!.profile.ownerId }, select: { email: true } });
    assert(artistOwner?.email, 'the track owner has no address to sign in as');
    const artist = await seedSessionCookie(artistOwner.email);
    const junk = await api(`/api/artist-media/${mediaHexId}`, {
      method: 'PATCH', cookie: artist.cookie, headers: json, body: JSON.stringify({ loudnessLufs: 42 }),
    });
    assert(junk.status === 400, `a loudness of +42 LUFS was accepted with ${junk.status} — the clamp is gone`);

    ok(await api(`/api/artist-media/${mediaHexId}`, {
      method: 'PATCH', cookie: artist.cookie, headers: json, body: JSON.stringify({ loudnessLufs: -8.25, peakDbfs: -0.5, truePeakDbtp: -0.2 }),
    }));
    const levelled = await prisma.artistMediaAsset.findUnique({ where: { hexId: mediaHexId }, select: { loudnessLufs: true, peakDbfs: true, truePeakDbtp: true } });
    assert(
      levelled?.loudnessLufs === -8.25 && levelled.peakDbfs === -0.5 && levelled.truePeakDbtp === -0.2,
      `the reading came back as ${JSON.stringify(levelled)}`,
    );

    return `Accept-Ranges served, 0-3 and the suffix byte-compared against the whole ${size}-byte object, 416 past the end, and a -8.25 LUFS reading stored (stranger 403, +42 refused 400)`;
  });

  // ── 43. The door, with and without signal ────────────────────────────────
  await item('43. The door list carries no ticket code, the venue can scan, and an offline scan syncs at the time it happened', async () => {
    if (!serializedId) blocked('no ticket was sold');
    /* A second, still-VALID ticket on the order item 16 paid for, so the
       manifest has one row to admit beside the one item 19 already used.
       Written directly: this item is about the door, not about selling. */
    const paid = await prisma.ticket.findFirst({ where: { serializedId }, select: { ticketOrderId: true, holderEmail: true, venueProfileId: true } });
    assert(paid, 'the sold ticket is gone');
    const doorCode = `0x${randomBytes(12).toString('hex')}`;
    await prisma.ticket.create({
      data: { serializedId: doorCode, ticketOrderId: paid.ticketOrderId, showId, venueProfileId: paid.venueProfileId, holderName: `Door Guest ${run}`, holderEmail: paid.holderEmail },
    });

    const asFan = await api(`/api/shows/${showId}/door-manifest`, { cookie: fan.cookie });
    assert(asFan.status === 403, `a fan downloading the door list answered ${asFan.status}`);

    /* The creator here also owns the venue (the walk's seed gives one account
       both profiles), so this proves the list and not the widened gate; the
       venue-owner-who-is-not-the-creator case is the route's own unit test. */
    const list = await api(`/api/shows/${showId}/door-manifest`, { cookie: creator.cookie });
    assert(list.status === 200, `the organiser downloading the door list answered ${list.status}: ${list.text.slice(0, 160)}`);
    assert(!list.text.includes(doorCode) && !list.text.includes(serializedId), 'THE DOOR LIST CARRIES A TICKET CODE — a stolen door phone would hold every ticket to the show');
    assert(!list.text.includes(doorCode.slice(2)), 'the door list carries a ticket code without its prefix');
    const expectValid = await hashTicketCode(showId, doorCode);
    const expectUsed = await hashTicketCode(showId, serializedId);
    assert(Array.isArray(list.body?.valid) && list.body.valid.some((row: { h: string; name: string }) => row.h === expectValid && row.name === `Door Guest ${run}`), 'the unscanned ticket is not on the list under its hash and name');
    assert(Array.isArray(list.body?.scanned) && list.body.scanned.includes(expectUsed), 'the ticket item 19 scanned is not listed as already used');
    assert(list.body.valid.every((row: { h: string }) => row.h !== expectUsed), 'a used ticket is still listed as admissible');

    /* The phone was offline when the fan walked in and posts the scan later,
       carrying the time it happened. The record must hold that time. */
    const walkedInAt = new Date(Date.now() - 10 * 60_000);
    walkedInAt.setMilliseconds(0);
    const synced = await api(`/api/shows/${showId}/scan`, {
      method: 'POST', cookie: creator.cookie, headers: json,
      body: JSON.stringify({ ticketId: doorCode, scannedAt: walkedInAt.toISOString() }),
    });
    ok(synced);
    const row = await prisma.ticket.findUnique({ where: { serializedId: doorCode }, select: { status: true, scannedAt: true } });
    assert(row?.status === 'SCANNED', `the synced ticket reads ${row?.status}`);
    assert(row.scannedAt?.getTime() === walkedInAt.getTime(), `the synced scan was recorded at ${row.scannedAt?.toISOString()}, not the ${walkedInAt.toISOString()} the door reported`);

    const again = await api(`/api/shows/${showId}/scan`, {
      method: 'POST', cookie: creator.cookie, headers: json,
      body: JSON.stringify({ ticketId: doorCode, scannedAt: walkedInAt.toISOString() }),
    });
    assert(again.status === 409, `a second door syncing the same ticket answered ${again.status}, expected 409 so the operator is told`);
    return `fan refused 403; list of ${list.body.valid.length} valid + ${list.body.scanned.length} used carries hashes only; offline scan recorded at the door's time; replay 409`;
  });

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

  /*
   * The same run, said in the member's words. "20c failed" does not tell
   * anyone whether a ticket can still be bought; "advertising: BROKEN" does.
   * The board also names the journeys NOTHING here touches, which a list of
   * items structurally cannot do.
   */
  const health = rollUp(rows);
  console.log(renderBoard(health));

  if (REPORT_PATH) {
    writeFileSync(
      REPORT_PATH,
      `${JSON.stringify({ at: new Date().toISOString(), target: BASE, rows }, null, 2)}\n`,
      'utf8',
    );
    console.log(`  report written to ${REPORT_PATH}\n`);
  }

  await sink.close();
  await prisma.$disconnect();
  /* Identical to the old `fail > 0` — a journey is BROKEN exactly when one of
     its items failed. Stated through the board so there is one rule, not two
     that could drift. */
  process.exit(exitCodeFor(health));
}

main().catch((error) => {
  console.error('\nalpha walk aborted:', error);
  process.exit(1);
});
