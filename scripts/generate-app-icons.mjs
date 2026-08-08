#!/usr/bin/env node
/**
 * Render the app-icon PNGs in public/icons/ from public/brand/ihype-logo-mark.svg.
 *
 *   npm run icons:generate
 *
 * Why a script and not a one-off export: the icons are a DERIVED artifact. Every
 * previous set was hand-produced, which is why public/ ended up holding three
 * unrelated marks (a raster sticker for the nav, a lightning bolt for the
 * favicon, and a bolt-less signal mark nothing referenced) with no way to tell
 * which was current. Redrawing the mark should be one edit and one command.
 *
 * ## Full-bleed on purpose
 *
 * The SVG rounds its own corners, which is right for a nav tile and wrong for
 * an app icon: iOS and Android both apply their OWN mask, so a pre-rounded,
 * transparent-cornered source gets rounded twice and shows the launcher
 * background through the gaps. This overrides `.ihype-tile-shape` to a square
 * and hides the `.ihype-tile-edge` hairline, which is why those two class hooks
 * exist in the SVG. Everything the mark has to say stays inside the maskable
 * safe circle (r=205 about 256,256) except the crowd, which is meant to be
 * cropped.
 *
 * ## No dependencies
 *
 * It drives a Chromium binary directly rather than going through Playwright's
 * API, so it runs before `npm install` and in a bare container. Set CHROMIUM_BIN
 * to choose one explicitly.
 *
 * `headless_shell` is preferred over a full `chrome`, and not as a style
 * preference: in a full Chrome build, `--window-size=N,N` yields a layout
 * viewport about 60px SHORTER than the screenshot canvas, under both --headless
 * and --headless=new. The PNG comes out the right size with the bottom ~60px
 * blank — the crowd silently missing from every icon, at no error. Playwright
 * installs `chromium_headless_shell` next to `chromium`, so the preferred
 * binary is present wherever the e2e suite can run. Falling back to a full
 * Chrome warns, because the output then has to be eyeballed.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const SOURCE = join(ROOT, 'public/brand/ihype-logo-mark.svg');
const OUT_DIR = join(ROOT, 'public/icons');

/** Kept in step with the `icons` array in public/manifest.json. */
const SIZES = [72, 96, 128, 144, 152, 180, 192, 512, 1024];

function findChromium() {
  if (process.env.CHROMIUM_BIN) return { bin: process.env.CHROMIUM_BIN, exact: true };

  // Playwright's browser store, which is where CI and the dev containers have
  // one. Both passes walk the whole store before the next runs, so a
  // headless_shell anywhere in it beats a full chrome — see the header comment.
  const store = process.env.PLAYWRIGHT_BROWSERS_PATH || join(process.env.HOME || '', '.cache/ms-playwright');
  const entries = existsSync(store) ? readdirSync(store) : [];

  for (const entry of entries) {
    const candidate = join(store, entry, 'chrome-linux/headless_shell');
    if (existsSync(candidate)) return { bin: candidate, exact: true };
  }

  for (const entry of entries) {
    for (const rel of ['chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const candidate = join(store, entry, rel);
      if (existsSync(candidate)) return { bin: candidate, exact: false };
    }
  }

  for (const candidate of [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]) {
    if (existsSync(candidate)) return { bin: candidate, exact: false };
  }

  throw new Error('No Chromium found. Install one, or set CHROMIUM_BIN to its path.');
}

const { bin: chromium, exact } = findChromium();
if (!exact) {
  process.stderr.write(
    `WARNING: falling back to ${chromium}, which is not a headless_shell build.\n` +
      'Full Chrome builds lay out a viewport shorter than the screenshot canvas, which\n' +
      'silently blanks the bottom of every icon. Check the output before committing it,\n' +
      'or run `npx playwright install chromium` and try again.\n',
  );
}
const svg = readFileSync(SOURCE, 'utf8');
const work = mkdtempSync(join(tmpdir(), 'ihype-icons-'));

for (const size of SIZES) {
  const page = join(work, `icon-${size}.html`);
  writeFileSync(
    page,
    `<!doctype html><meta charset="utf-8"><style>
      *{margin:0;padding:0}
      html,body{overflow:hidden;background:transparent}
      svg{display:block;width:${size}px;height:${size}px}
      /* See the header comment: square the tile so the OS mask is the only
         one applied, and drop the hairline that would be clipped by it. */
      .ihype-tile-shape{rx:0;ry:0}
      .ihype-tile-edge{display:none}
    </style>${svg}`,
  );

  execFileSync(
    chromium,
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      `--screenshot=${join(OUT_DIR, `icon-${size}.png`)}`,
      `--window-size=${size},${size}`,
      `file://${page}`,
    ],
    { stdio: 'ignore' },
  );

  process.stdout.write(`icon-${size}.png\n`);
}

process.stdout.write(`\n${SIZES.length} icons written to public/icons/ from ${SOURCE.replace(ROOT, '.')}\n`);
