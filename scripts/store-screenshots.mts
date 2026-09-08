/**
 * Store screenshots, generated from the real product.
 *
 * WHY THIS EXISTS. `docs/store-submission.md` listed screenshots under "assets
 * still needed" with the line "none of them can be generated from this
 * repository". That was the last hard blocker on both store listings, and it
 * was not true: `measure-layout.mts` has been driving these exact signed-in
 * routes against a real workerd build since 2026-08-25. The same session
 * fixture, the same proxy handling, the same base URL — the only new part is
 * asking for a device-sized viewport and calling `screenshot()`.
 *
 * A store screenshot is not a debugging capture, and two differences matter.
 * **Exact pixel dimensions are a hard gate** — Apple rejects anything that is
 * not one of its listed sizes, so the viewport times the device scale factor
 * has to land on the number exactly. And **the frame must be full-bleed**: a
 * `fullPage` capture of a scrolling surface produces a tall image the store
 * refuses, so every shot is clipped to the viewport, which is what a phone
 * actually shows.
 *
 * WHAT IT CANNOT DO, stated because a screenshot of an empty product is worse
 * than no screenshot: it captures whatever the seeded database holds. A map
 * with no pins and a profile with no tracks are accurate pictures of an empty
 * fixture and would sell nobody anything. Seed real-looking content first
 * (`node scripts/make-alpha-fixtures.mjs`), then look at every frame before
 * uploading it. This script refuses a frame it can tell is empty; it cannot
 * judge one that is merely thin.
 *
 * Usage:
 *   node scripts/e2e-workerd.mjs --serve          # in another shell
 *   npm run store:screenshots -- --out=store-shots
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

process.env.PLAYWRIGHT_AUTH_COOKIE_SECURE ??= 'true';
const { seedSessionCookie, canSeedSession, sessionCookieName } = await import('../e2e/fixtures/session');

const arg = (name: string, dflt?: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const BASE = arg('base', 'http://localhost:8787')!;
const OUT = arg('out', 'store-screenshots')!;
const ONLY = arg('only');

/**
 * The two frames the stores actually require.
 *
 * Apple publishes 1290x2796 as the 6.7-inch iPhone size and rejects anything
 * else outright. Play takes a RANGE — between 16:9 and 9:16, short side
 * 320-3840 — and 1290x2796 is 1:2.17, TALLER than 9:16, so the Apple frame is
 * refused there. Hence two presets rather than one: 393x699 at 3x is 1179x2097
 * (1:1.779, within a thousandth of 9:16), and 393 is the width the dock and
 * every measurement in this repository already use.
 */
const DEVICES = [
  { id: 'appstore-6.7', width: 430, height: 932, scale: 3, note: '1290x2796 — Apple 6.7-inch iPhone' },
  { id: 'play-phone', width: 393, height: 699, scale: 3, note: '1179x2097 — Google Play phone, 9:16' },
];

/**
 * The five screens `docs/store-submission.md` names, in its order: "the map
 * with pins, an artist profile with the play control, the station playing, a
 * ticket with its QR, and the demand radar on a venue dashboard. That sequence
 * tells the whole product story without a word of marketing copy."
 *
 * `slug` entries are filled in once the fixture has run, the same way
 * measure-layout pushes its two profile panes.
 */
type Shot = { id: string; route: string; settle?: number; needs?: string };
const SHOTS: Shot[] = [
  { id: '1-map', route: '/app/map', settle: 4000 },
  { id: '3-radio', route: '/app/music/radio' },
  { id: '4-discover', route: '/app/music/discover' },
  { id: '5-tickets', route: '/app/tickets' },
];

if (!canSeedSession()) {
  console.error('Cannot seed a session. Set E2E_WORKERD_DATABASE_URL (or DATABASE_URL) and AUTH_SECRET,');
  console.error('then serve the built worker with: node scripts/e2e-workerd.mjs --serve');
  process.exit(2);
}

const { cookie, profiles } = await seedSessionCookie('store-shots@example.com', {
  profiles: [
    { type: 'ARTIST', name: 'Marsh Kings' },
    { type: 'VENUE', name: 'The Portland Room' },
  ],
});
/**
 * WHICH artist page to photograph, and why it is not the session's own.
 *
 * The first run of this script pointed at the profile the fixture creates for
 * the signed-in user, and the frame was unusable in a way no automated check
 * would catch: every counter read 0 and the page rendered the OWNER's "Upload
 * a track" form, because the viewer owned it. It passed the emptiness guard
 * easily — an upload form is plenty of text and controls. That is the exact
 * failure the header warns about, met on the first attempt.
 *
 * So: pass `--artist=` and `--venue=` with slugs from a populated database
 * (`npm run seed:preview` writes 13 profiles, 26 tracks and 8 shows). The
 * session's own profile is the fallback and is only right for proving the
 * harness runs, never for a listing.
 */
const ARTIST = arg('artist');
const VENUE = arg('venue');
if (ARTIST) SHOTS.splice(1, 0, { id: '2-artist', route: `/app/artists/${ARTIST}` });
if (VENUE) SHOTS.push({ id: '6-venue', route: `/app/venues/${VENUE}` });
for (const profile of profiles) {
  if (profile.type === 'ARTIST' && !ARTIST) SHOTS.splice(1, 0, { id: '2-artist', route: `/app/artists/${profile.slug}` });
  if (profile.type === 'VENUE' && !VENUE) SHOTS.push({ id: '6-venue-radar', route: `/app/me/venues/${profile.slug}/analytics` });
}

// Same reason as measure-layout and audit-mobile: Chromium does not read
// HTTPS_PROXY itself, and does NOT bypass loopback for a proxy handed to it
// explicitly — without `bypass` every localhost navigation answers 405.
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || '';
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  ...(PROXY ? { proxy: { server: PROXY, bypass: 'localhost,127.0.0.1,::1' } } : {}),
});

mkdirSync(OUT, { recursive: true });
const shots = ONLY ? SHOTS.filter((s) => s.id.includes(ONLY) || s.route.includes(ONLY)) : SHOTS;
let written = 0;
let thin = 0;
const manifest: Record<string, unknown>[] = [];

for (const device of DEVICES) {
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.scale,
    isMobile: true,
    hasTouch: true,
    // A store frame must not carry a scrollbar; a mobile context has none.
    reducedMotion: 'reduce',
  });
  /* `secure` must track the cookie NAME, not the scheme. The built worker
     serves production semantics, so the fixture mints `__Secure-authjs...`,
     and Chromium rejects a `__Secure-` cookie with `secure: false` outright —
     "Invalid cookie fields", which reads like a malformed object and is really
     the prefix contract. http://localhost is a secure context, so it is sent. */
  await context.addCookies([{
    name: sessionCookieName(),
    value: cookie,
    domain: new URL(BASE).hostname,
    path: '/',
    secure: process.env.PLAYWRIGHT_AUTH_COOKIE_SECURE === 'true',
  }]);
  /* Pre-accept cookie consent — not cosmetic here. The banner is bottom-pinned
     and would appear across the bottom of every store frame, which is both
     ugly and, on the map shot, covering the dock. measure-layout does the same
     for its own reasons (the banner's height feeds --mmm-dock-lift). */
  await context.addInitScript(() => {
    try { localStorage.setItem('ihype_cookie_consent', 'accepted'); } catch { /* private mode */ }
  });
  const page = await context.newPage();

  for (const shot of shots) {
    const file = join(OUT, `${device.id}--${shot.id}.png`);
    try {
      await page.goto(`${BASE}${shot.route}`, { waitUntil: 'load', timeout: 45_000 });
      // networkidle, not a fixed delay: the tabs that fetch rows settle at
      // different moments, and a fixed wait photographs a spinner.
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      if (shot.settle) await page.waitForTimeout(shot.settle);

      /* Refuse a frame that is obviously empty. A store screenshot of a blank
         surface is worse than none, and the failure is silent otherwise: the
         file is written, looks like a success, and is uploaded. This catches
         an error page and a dead route; it CANNOT judge a page that merely has
         thin content, which is why the header above says to look at every
         frame. */
      const text = (await page.evaluate(() => document.body?.innerText ?? '')).trim();
      const controls = await page.locator('button, a[href]').count();
      if (text.length < 40 || controls < 3) {
        console.log(`  THIN  ${device.id} ${shot.id.padEnd(14)} ${text.length} chars, ${controls} controls — look before using`);
        thin += 1;
      }

      await page.screenshot({ path: file, fullPage: false });
      manifest.push({ device: device.id, shot: shot.id, route: shot.route, px: `${device.width * device.scale}x${device.height * device.scale}`, chars: text.length });
      console.log(`  ok    ${device.id} ${shot.id.padEnd(14)} ${device.width * device.scale}x${device.height * device.scale}  ${shot.route}`);
      written += 1;
    } catch (error) {
      console.error(`  FAIL  ${device.id} ${shot.id.padEnd(14)} ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  await context.close();
}

await browser.close();
writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n${written} frames written to ${OUT}/ (${thin} flagged thin)`);
console.log('Look at every frame before uploading. A store listing is the one place');
console.log('an empty fixture is indistinguishable from an empty product.');
// Zero frames means the harness is broken, not that the product is empty.
process.exit(written === 0 ? 1 : 0);
