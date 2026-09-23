/**
 * RASTERISES EVERY APP ICON AND LAUNCH SCREEN FROM THE MARK'S GEOMETRY.
 *
 *   npm run brand:assets
 *
 * Writes, from `src/lib/brand-mark.ts` and nothing else:
 *   · public/icons/icon-{72..1024}.png          the PWA set `public/manifest.json` declares
 *   · ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png (1024, RGB — Apple
 *     refuses an alpha channel on the store icon, so it is flattened and the channel dropped)
 *   · android/app/src/main/res/mipmap-<density>/ic_launcher.png, ic_launcher_round.png (the legacy
 *     launcher icons, rounded/circled with transparent corners, API < 26)
 *   · android/app/src/main/res/mipmap-<density>/ic_launcher_foreground.png (the adaptive icon's
 *     foreground: a 108dp canvas of which the launcher shows the centre 72dp and guarantees
 *     only a 66dp circle, so the glyph is drawn at 44dp — 41% of the canvas — and the rest is
 *     TRANSPARENT; the ground is `@color/ic_launcher_background`, which a guard in
 *     wiring-guards.test.ts already holds to `--bg`)
 *   · android/app/src/main/res/drawable-<orientation>-<density>/splash.png (eleven sizes; the window background,
 *     which Android STRETCHES to the window, so each orientation keeps its own aspect)
 *   · ios/App/App/Assets.xcassets/Splash.imageset/*.png (three copies of one 2732 square, which
 *     LaunchScreen.storyboard shows scaleAspectFill — a 19.5:9 phone sees the middle 46% of
 *     its width, so the wordmark is 34% of the side and stays inside that on every device)
 *
 * THE COLOURS ARE READ OFF `:root` IN globals.css, never restated here. A harness that copies
 * a token is the same defect as one that copies geometry (CLAUDE.md, the measure:dock row):
 * the launch colour already lives in five places outside the stylesheet, and this script is
 * how the icons stop being a sixth. If `--bg`, `--accent` or `--ink` move, re-run this.
 *
 * WHY sharp AND NOT A BROWSER. The mark is pure geometry — no text, so no font to load — and
 * librsvg renders paths exactly; Chromium was used ONCE, to measure where the browser lays
 * the letters out, and that measurement is baked into the lib. A browser here would be a
 * second renderer to keep in agreement with the first.
 *
 * Every file's dimensions and PNG colour type are read back from disk and printed; the test
 * in `src/lib/__tests__/brand-assets.test.ts` holds the same facts on every push.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { iconSvg, splashSvg } from '../src/lib/brand-mark';

const ROOT = path.resolve(import.meta.dirname, '..');

/** `--bg`, `--accent`, `--ink` from the `:root` block — the default theme, the store icon's theme. */
function rootTokens(): { bg: string; accent: string; ink: string } {
  const css = readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');
  /* The block that STARTS a line, closed by the first `}` at column 0 after it. The comments
     inside `:root` name `[data-theme="light"]` and `:root` itself, so a text search for either
     lands inside a comment and slices the block short — the first draft did exactly that and
     reported `--accent` undeclared. */
  const start = css.search(/^:root \{/m);
  const end = start < 0 ? -1 : css.indexOf('\n}\n', start);
  if (start < 0 || end < 0) throw new Error('globals.css: could not find the :root block');
  const block = css.slice(start, end);
  const read = (name: string) => {
    const m = new RegExp(`^\\s*--${name}:\\s*(#[0-9a-fA-F]{6})\\b`, 'm').exec(block);
    if (!m) throw new Error(`globals.css :root does not declare --${name} as a 6-digit hex`);
    return m[1].toLowerCase();
  };
  return { bg: read('bg'), accent: read('accent'), ink: read('ink') };
}

const tokens = rootTokens();
const paint = { accent: tokens.accent, ink: tokens.ink };
/* The wordmark's width as a fraction of the icon's side. The mark is 2545x660, so a width w
   needs a circle of diameter ~1.033w to clear its corners: 0.74 survives the PWA maskable safe
   zone (a centred circle of 80%), the iOS squircle and the round legacy launcher. */
const MARK_W = 0.74;
/* The Android adaptive foreground: the launcher guarantees only a 66dp circle of the 108dp
   canvas, so the wordmark may be at most 66/108/1.033 = 0.59 of it. */
const MARK_W_ADAPTIVE = 0.56;

type Out = { file: string; width: number; height: number; colourType: number };
const written: Out[] = [];

async function write(rel: string, svg: string, opts: { opaque?: boolean } = {}) {
  const abs = path.join(ROOT, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  let img = sharp(Buffer.from(svg));
  if (opts.opaque) img = img.flatten({ background: tokens.bg }).removeAlpha();
  const buf = await img.png().toBuffer();
  writeFileSync(abs, buf);
  written.push({ file: rel, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colourType: buf[25] });
}

/* PWA: full-bleed square; `purpose: any maskable` needs the glyph inside the central 80%. */
for (const size of [72, 96, 128, 144, 152, 180, 192, 512, 1024]) {
  await write(`public/icons/icon-${size}.png`, iconSvg({ size, ground: tokens.bg, markWidth: MARK_W, ...paint }));
}

/* iOS store icon: square, opaque, no alpha channel. iOS masks its own corners. */
await write(
  'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
  iconSvg({ size: 1024, ground: tokens.bg, markWidth: MARK_W, ...paint }),
  { opaque: true },
);

/* Android. */
const DENSITIES: Array<[string, number]> = [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]];
for (const [density, scale] of DENSITIES) {
  const dir = `android/app/src/main/res/mipmap-${density}`;
  const legacy = 48 * scale;
  await write(`${dir}/ic_launcher.png`, iconSvg({ size: legacy, ground: tokens.bg, markWidth: MARK_W, cornerRadius: 0.18, ...paint }));
  await write(`${dir}/ic_launcher_round.png`, iconSvg({ size: legacy, ground: tokens.bg, markWidth: MARK_W, cornerRadius: 0.5, ...paint }));
  await write(`${dir}/ic_launcher_foreground.png`, iconSvg({ size: 108 * scale, ground: null, markWidth: MARK_W_ADAPTIVE, ...paint }));
}
const SPLASH_PORTRAIT: Array<[string, number, number]> = [
  ['mdpi', 320, 480], ['hdpi', 480, 800], ['xhdpi', 720, 1280], ['xxhdpi', 960, 1600], ['xxxhdpi', 1280, 1920],
];
for (const [density, w, h] of SPLASH_PORTRAIT) {
  await write(`android/app/src/main/res/drawable-port-${density}/splash.png`, splashSvg({ width: w, height: h, ground: tokens.bg, markWidth: 0.34, ...paint }), { opaque: true });
  await write(`android/app/src/main/res/drawable-land-${density}/splash.png`, splashSvg({ width: h, height: w, ground: tokens.bg, markWidth: 0.34, ...paint }), { opaque: true });
}
await write('android/app/src/main/res/drawable/splash.png', splashSvg({ width: 480, height: 320, ground: tokens.bg, markWidth: 0.34, ...paint }), { opaque: true });

/* iOS launch image: one square, three scales of the same file. */
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await write(`ios/App/App/Assets.xcassets/Splash.imageset/${name}`, splashSvg({ width: 2732, height: 2732, ground: tokens.bg, markWidth: 0.34, ...paint }), { opaque: true });
}

const TYPE = { 2: 'RGB', 6: 'RGBA' } as Record<number, string>;
for (const o of written) console.log(`${o.file.padEnd(78)} ${String(o.width).padStart(4)}x${String(o.height).padEnd(4)} ${TYPE[o.colourType] ?? `type ${o.colourType}`}`);
console.log(`\n${written.length} files from --bg ${tokens.bg} · --accent ${tokens.accent} · --ink ${tokens.ink}`);
