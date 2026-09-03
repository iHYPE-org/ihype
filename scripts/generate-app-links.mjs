#!/usr/bin/env node
/**
 * Write the two universal-link files, from values only a human can supply.
 *
 * ## Why this is a generator and not two checked-in files
 *
 * `assetlinks.json` (Android App Links) and `apple-app-site-association` (iOS
 * Universal Links) are what make `https://ihype.org/…` open the installed app
 * instead of the browser. Both are verified by the OS against values that live
 * outside this repository: Apple's needs the **Team ID** from the developer
 * account, Android's needs the **SHA-256 fingerprint of the signing
 * certificate** — the upload key Play actually signs with, which is not
 * knowable from source.
 *
 * A placeholder is worse than an absent file, and this is the trap the whole
 * script exists to avoid: with no file, verification simply does not happen and
 * links open in the browser — a degraded but honest state. With a malformed file
 * present, iOS and Android both cache the failure, and the app looks broken in a
 * way that takes days to expire. So nothing is committed, and this refuses to
 * write anything it cannot verify the shape of.
 *
 * ## Getting the two values
 *
 *   Team ID       Apple Developer → Membership details → Team ID (10 chars).
 *   Fingerprint   Play Console → Test and release → App integrity → App
 *                 signing key certificate → SHA-256. If you have the keystore
 *                 instead:
 *                   keytool -list -v -keystore upload.jks -alias upload
 *                 Take the SHA-256 line, colon-separated hex.
 *
 * Both apps ship one bundle id, `com.ihype.app`, which this reads from
 * `capacitor.config.ts` rather than restating.
 *
 * Usage:
 *   node scripts/generate-app-links.mjs --team-id ABCDE12345 \
 *        --sha256 AA:BB:…:FF
 *   node scripts/generate-app-links.mjs --check     # verify what is on disk
 *
 * After writing, commit the two files and deploy: they must be served from
 * `https://ihype.org/.well-known/`, over HTTPS, with no redirect. `smoke:production`
 * checks that once they exist.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const WELL_KNOWN = 'public/.well-known';
const ANDROID = `${WELL_KNOWN}/assetlinks.json`;
const APPLE = `${WELL_KNOWN}/apple-app-site-association`;

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const CHECK = args.includes('--check');

/* 10 uppercase alphanumerics. Apple's own format, and worth asserting: a Team ID
   with a stray space verifies as absent, which looks identical to not having
   written the file at all. */
const TEAM_ID = /^[A-Z0-9]{10}$/;
/* 32 colon-separated hex octets. A SHA-1 fingerprint pasted here by mistake has
   20 — the commonest way this file is wrong, because both are on the same Play
   Console screen. */
const SHA256 = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

async function appId() {
  const config = await readFile(path.join(root, 'capacitor.config.ts'), 'utf8');
  const match = /appId:\s*'([^']+)'/.exec(config);
  if (!match) throw new Error('capacitor.config.ts: could not read appId — the app bundle id is the one value both files share.');
  return match[1];
}

function androidBody(id, sha256) {
  return `${JSON.stringify([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: id, sha256_cert_fingerprints: [sha256] },
    },
  ], null, 2)}\n`;
}

function appleBody(id, teamId) {
  /* `paths` is deliberately broad minus the paths that must stay in a browser:
     Stripe Checkout returns to /tickets and the magic-link and passkey flows
     complete in the browser that started them. Sending those into the app
     strands the member in a WebView with no session. */
  return `${JSON.stringify({
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.${id}`,
          paths: ['NOT /api/*', 'NOT /auth/*', 'NOT /login', 'NOT /register', '*'],
        },
      ],
    },
  }, null, 2)}\n`;
}

/*
 * `--check` reports TWO different states and they are not the same problem.
 *
 *   absent    Nobody has run the generator yet, because the Team ID and the
 *             signing fingerprint live in accounts outside this repository.
 *             Links open in the browser. Degraded, honest, and the state this
 *             project has been in since the workflow was written — so a caller
 *             that treats it as a failure fails every time, forever, and
 *             anything sequenced after it never runs. That happened: this check
 *             sat first in the nightly's gate step and the alpha acceptance
 *             walk behind it never executed once.
 *
 *   malformed A file IS present and the OS will reject it. Both platforms cache
 *             a verification failure for days, so this is worse than absent and
 *             is a real defect.
 *
 * So: exit 1 for malformed, exit 2 for merely absent, 0 for verified. A caller
 * that wants a gate checks for 1; a caller that wants a status line tolerates 2
 * and prints it. Same convention as `stripe-payout-rehearsal.mjs`, which exits
 * 2 when a mode could not be rehearsed rather than pretending it passed.
 */
async function check() {
  /* Present but wrong — fatal. */
  const broken = [];
  /* Not written yet — reportable, not fatal. */
  const missing = [];
  const id = await appId();

  const android = await readFile(path.join(root, ANDROID), 'utf8').catch(() => null);
  if (!android) missing.push(`${ANDROID} is absent — Android App Links are not verified, so https:// links open in the browser.`);
  else {
    try {
      const parsed = JSON.parse(android);
      const target = parsed?.[0]?.target;
      if (target?.package_name !== id) broken.push(`${ANDROID}: package_name is "${target?.package_name}", expected "${id}".`);
      const print = target?.sha256_cert_fingerprints?.[0] ?? '';
      if (!SHA256.test(print)) {
        broken.push(`${ANDROID}: "${print}" is not a SHA-256 fingerprint (32 colon-separated hex octets). A SHA-1 has 20 — both are on the same Play Console screen.`);
      }
    } catch {
      broken.push(`${ANDROID}: not valid JSON. Android caches the failure, so this is worse than an absent file.`);
    }
  }

  const apple = await readFile(path.join(root, APPLE), 'utf8').catch(() => null);
  if (!apple) missing.push(`${APPLE} is absent — iOS Universal Links are not verified.`);
  else {
    try {
      const parsed = JSON.parse(apple);
      const appID = parsed?.applinks?.details?.[0]?.appID ?? '';
      const [teamId, ...rest] = appID.split('.');
      if (!TEAM_ID.test(teamId)) broken.push(`${APPLE}: appID starts with "${teamId}", which is not a 10-character Team ID.`);
      if (rest.join('.') !== id) broken.push(`${APPLE}: appID names "${rest.join('.')}", expected "${id}".`);
    } catch {
      broken.push(`${APPLE}: not valid JSON. It must have no file extension and be served as application/json.`);
    }
  }

  const howToWrite = [
    '',
    'Both are generated, never hand-written:',
    '  node scripts/generate-app-links.mjs --team-id ABCDE12345 --sha256 AA:BB:...:FF',
    '',
  ].join('\n');

  if (broken.length) {
    console.error('App-link files are PRESENT AND WRONG — the OS will cache the rejection:\n');
    for (const problem of broken) console.error(`  ${problem}`);
    for (const problem of missing) console.error(`  ${problem}`);
    console.error(howToWrite);
    process.exit(1);
  }

  if (missing.length) {
    console.log('App-link files are not written yet (needs the Apple Team ID and the Play signing fingerprint):\n');
    for (const problem of missing) console.log(`  ${problem}`);
    console.log(howToWrite);
    process.exit(2);
  }

  console.log(`App-link files verified for ${id}: Android fingerprint present, Apple Team ID present.`);
}

if (CHECK) {
  await check();
} else {
  const teamId = (flag('team-id') ?? '').trim().toUpperCase();
  const sha256 = (flag('sha256') ?? '').trim().toUpperCase();
  const id = await appId();

  const bad = [];
  if (!TEAM_ID.test(teamId)) bad.push('--team-id must be the 10-character Apple Team ID (Membership details).');
  if (!SHA256.test(sha256)) bad.push('--sha256 must be 32 colon-separated hex octets (Play Console → App integrity → SHA-256).');
  if (bad.length) {
    console.error('Refusing to write a file the OS would reject and then cache:\n');
    for (const problem of bad) console.error(`  ${problem}`);
    console.error('\nA malformed app-link file is worse than none: with no file, links simply open in the browser.\n');
    process.exit(1);
  }

  await mkdir(path.join(root, WELL_KNOWN), { recursive: true });
  await writeFile(path.join(root, ANDROID), androidBody(id, sha256), 'utf8');
  await writeFile(path.join(root, APPLE), appleBody(id, teamId), 'utf8');
  console.log(`Wrote ${ANDROID} and ${APPLE} for ${id}.`);
  console.log('Commit both, deploy, then verify:');
  console.log('  npm run check:app-links');
  console.log(`  curl -sI https://ihype.org/.well-known/assetlinks.json   # 200, no redirect`);
  console.log(`  curl -s  https://ihype.org/.well-known/apple-app-site-association | head -1`);
}
