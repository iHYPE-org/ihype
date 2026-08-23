/**
 * Live-verifies the ACRCloud integration — the check src/lib/acrcloud.ts has
 * carried as "NOT YET LIVE-VERIFIED" since it was written (2026-07-22).
 *
 * The client was written to ACRCloud's documented v1 identify contract
 * (HMAC-SHA1-signed multipart POST), but no ACRCloud project existed to
 * exercise it against, so the exact host and response shape have never been
 * confirmed. This script closes that gap the moment credentials exist, the
 * same way scripts/stripe-payout-rehearsal.mjs does for Stripe.
 *
 * Usage (with the three env vars from the ACRCloud console's Access tab):
 *
 *   ACRCLOUD_HOST=identify-us-west-2.acrcloud.com \
 *   ACRCLOUD_ACCESS_KEY=... ACRCLOUD_ACCESS_SECRET=... \
 *   npm run verify:acrcloud
 *
 *   npm run verify:acrcloud -- path/to/known-commercial-clip.mp3
 *
 * What it proves, in two stages:
 *
 *   1. No file argument: sends a synthesized sine-tone WAV. A healthy project
 *      answers "no-match" — which proves the host, the HMAC signature, the
 *      multipart shape and the response parsing end to end. An auth or
 *      contract failure surfaces as "error" with ACRCloud's own message.
 *      This is the plumbing check and it uses no copyrighted material.
 *
 *   2. With a file argument: pass a 15-30s clip of a KNOWN commercial
 *      recording and expect "match" naming that recording. This is the only
 *      way to prove the copyright filter actually filters — a no-match on a
 *      sine tone shows the pipe works, not that the catalog behind it does.
 *
 * Exit code 0 only when the round trip authenticated (no-match or match).
 * "not-configured" and "error" both exit 1, so this can gate a launch
 * checklist. Runs through the real identifyAudio() — the same code path the
 * upload scan (media-vetting.ts) and the ad-audio scan (ad-vetting.ts) use —
 * so a pass here is a pass for both consumers.
 */
import { readFileSync } from 'node:fs';
import { identifyAudio, isAcrCloudConfigured } from '../src/lib/acrcloud';

/** A 12s 440Hz mono 16-bit 44.1kHz WAV — comfortably over the ~10s ACRCloud
 * needs to fingerprint, and safely under the client's 1MB sample cap. */
function sineWav(): Uint8Array {
  const rate = 44100;
  const seconds = 12;
  const samples = rate * seconds;
  const data = new Int16Array(samples);
  for (let i = 0; i < samples; i += 1) {
    // Two detuned partials rather than a bare tone: some fingerprinters
    // reject inputs with no spectral movement at all as "not audio".
    data[i] = Math.round(
      8000 * Math.sin((2 * Math.PI * 440 * i) / rate) +
        4000 * Math.sin((2 * Math.PI * 554.37 * i) / rate) * Math.sin((2 * Math.PI * 0.5 * i) / rate),
    );
  }
  const bytes = new Uint8Array(44 + data.byteLength);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + data.byteLength, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, data.byteLength, true);
  bytes.set(new Uint8Array(data.buffer), 44);
  return bytes;
}

async function main() {
  console.log('\n=== ACRCloud live verification ===\n');

  if (!isAcrCloudConfigured()) {
    console.error('  NOT CONFIGURED  Set ACRCLOUD_HOST, ACRCLOUD_ACCESS_KEY and');
    console.error('                  ACRCLOUD_ACCESS_SECRET (ACRCloud console → your');
    console.error('                  project → Access). Until they are also set as');
    console.error('                  Worker secrets, the upload scan and the ad-audio');
    console.error('                  scan run without the fingerprint layer and say so.');
    process.exit(1);
  }

  const filePath = process.argv[2];
  const bytes = filePath ? new Uint8Array(readFileSync(filePath)) : sineWav();
  const label = filePath ? `file ${filePath}` : 'synthesized sine-tone WAV';
  console.log(`  Sending ${label} (${bytes.byteLength.toLocaleString()} bytes) to ${process.env.ACRCLOUD_HOST}\n`);

  const outcome = await identifyAudio(bytes);

  switch (outcome.status) {
    case 'no-match':
      if (filePath) {
        console.error('  UNEXPECTED  no-match for a supplied clip. If this clip really is');
        console.error('              a known commercial recording, the catalog bucket on the');
        console.error('              ACRCloud project is not the Music one — check the');
        console.error("              project's bucket configuration before trusting the filter.");
        process.exit(1);
      }
      console.log('  PASS  Authenticated round trip: ACRCloud answered "no result" for');
      console.log('        the synthetic tone. Host, HMAC signature, multipart shape and');
      console.log('        response parsing are all confirmed live.');
      console.log('\n  Next: rerun with a 15-30s clip of a known commercial recording and');
      console.log('        expect a match — that is the half a sine tone cannot prove.');
      break;
    case 'match':
      console.log(`  PASS  Matched: ${outcome.matchedSource}` + (outcome.score === null ? '' : ` (score ${outcome.score})`));
      console.log('        The copyright filter identifies commercial recordings end to end.');
      break;
    case 'error':
      console.error(`  FAIL  ${outcome.detail}`);
      console.error('        An auth failure here usually means the key/secret pair or the');
      console.error('        region host does not belong to this project.');
      process.exit(1);
      break;
    case 'not-configured':
      // isAcrCloudConfigured() passed above, so reaching this means the env
      // was cleared mid-run; report it rather than claiming a pass.
      console.error('  FAIL  Client reported not-configured after the config check passed.');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('  FAIL  ', error instanceof Error ? error.message : error);
  process.exit(1);
});
