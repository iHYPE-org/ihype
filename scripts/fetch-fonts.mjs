#!/usr/bin/env node
/**
 * Refreshes the vendored web fonts in `src/app/fonts/`.
 *
 * ## This is a MANUAL step, on purpose
 *
 * Do not wire it into `prebuild`, `build`, or CI. The whole reason these files
 * are committed is that `next/font/google` fetched them from `fonts.gstatic.com`
 * at build time — three retries, then a hard failure that fails the build. That
 * blocked a production deploy on 2026-08-13, because `deploy-production.yml`
 * re-runs the Cloudflare build before it ships. A fetch script running during
 * the build would restore the exact dependency this removed.
 *
 * Run it when a family is added, a weight is added, or you deliberately want
 * newer outlines:
 *
 *     npm run fonts:fetch
 *
 * then commit whatever changed, with the diff reviewed like any other asset.
 *
 * ## What it downloads
 *
 * The **latin** subset only, matching the `subsets: ['latin']` that the
 * `next/font/google` configuration used to request — so this is the same
 * coverage, not a narrowing.
 *
 * Three families are taken as VARIABLE faces. Bricolage must be: its `opsz`
 * axis is what `font-variation-settings: 'opsz' N` on the display ramp drives,
 * and a static instance has no axis to set. Work Sans and JetBrains Mono are
 * variable because it is smaller — one 49 KB and one 39 KB file against the
 * 196 KB and 92 KB of static weights they replace. Instrument Serif publishes
 * no variable face and stays two static files.
 *
 * A browser User-Agent is required: the CSS2 endpoint serves woff2 only to
 * clients it believes support it, and returns older formats otherwise.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'src', 'app', 'fonts');
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * `spec` is the CSS2 `family=` value. `want` selects which @font-face block to
 * keep, by style and by the exact `font-weight` the endpoint declares — a
 * variable face declares a range ("200 800"), a static one a single value.
 */
const JOBS = [
  {
    spec: 'Bricolage+Grotesque:opsz,wght@12..96,200..800',
    files: [{ out: 'BricolageGrotesque-Variable.woff2', style: 'normal', weight: '200 800' }],
  },
  {
    spec: 'Work+Sans:wght@100..900',
    files: [{ out: 'WorkSans-Variable.woff2', style: 'normal', weight: '100 900' }],
  },
  {
    spec: 'JetBrains+Mono:wght@100..800',
    files: [{ out: 'JetBrainsMono-Variable.woff2', style: 'normal', weight: '100 800' }],
  },
  {
    spec: 'Instrument+Serif:ital@0;1',
    files: [
      { out: 'InstrumentSerif-400.woff2', style: 'normal', weight: '400' },
      { out: 'InstrumentSerif-400italic.woff2', style: 'italic', weight: '400' },
    ],
  },
];

async function get(url, asText) {
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return asText ? response.text() : Buffer.from(await response.arrayBuffer());
}

/**
 * Splits the stylesheet into (subset, block) pairs.
 *
 * The subset comes from the `/* latin *\/` comment the endpoint emits before
 * each block. Matching on the comment rather than on `unicode-range` is
 * deliberate: the ranges change as Google re-subsets, and a hardcoded range
 * would start silently selecting nothing.
 */
function blocks(css) {
  const found = [];
  const pattern = /\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  let match;
  while ((match = pattern.exec(css)) !== null) found.push({ subset: match[1], body: match[2] });
  return found;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let total = 0;
  let failures = 0;

  for (const job of JOBS) {
    const css = await get(`https://fonts.googleapis.com/css2?family=${job.spec}&display=swap`, true);
    const latin = blocks(css).filter((entry) => entry.subset === 'latin');

    for (const file of job.files) {
      const hit = latin.find((entry) => {
        const style = /font-style:\s*(\w+)/.exec(entry.body)?.[1];
        const weight = /font-weight:\s*([\d ]+)/.exec(entry.body)?.[1]?.trim();
        return style === file.style && weight === file.weight;
      });
      if (!hit) {
        // Loud rather than silent: a missed block means the endpoint changed
        // shape, and writing nothing while exiting 0 would leave a stale file
        // in place looking fresh.
        console.error(`  MISS ${file.out} — no latin block for ${file.style} ${file.weight}`);
        failures += 1;
        continue;
      }
      const url = /url\((https:\/\/[^)]+\.woff2)\)/.exec(hit.body)?.[1];
      if (!url) {
        console.error(`  MISS ${file.out} — block had no woff2 url`);
        failures += 1;
        continue;
      }
      const bytes = await get(url, false);
      await writeFile(join(OUT_DIR, file.out), bytes);
      total += bytes.length;
      console.log(`  ${file.out}  ${Math.round(bytes.length / 1024)} KB`);
    }
  }

  console.log(`\n[fetch-fonts] ${Math.round(total / 1024)} KB into src/app/fonts/`);
  if (failures > 0) {
    console.error(`[fetch-fonts] ${failures} file(s) not written — see above.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[fetch-fonts]', error);
  process.exit(1);
});
