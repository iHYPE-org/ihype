import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { MARK, MARK_I, MARK_LETTERS_PATH, iconSvg, markSvg, splashSvg } from '../brand-mark';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

/**
 * THE MARK, THE ICONS AND THE SHARE CARDS ALL DRAW ONE SHAPE IN THE PRODUCT'S
 * OWN COLOURS (2026-09-22).
 *
 * Before this the product carried three logos: the brush-type sticker on every
 * app icon, a serif `iH.` on a DS8-dark tile on every native splash, and a
 * white-`i`-orange-`HYPE` lockup on every shared-link image — none of them the
 * header's mark, and all three on grounds the product had left. Nothing could
 * see it: an icon is a PNG, a Satori card is a literal by necessity, and no
 * audit here reads either. These hold what `npm run brand:assets` writes and
 * what `src/app/api/og/palette.ts` declares to the stylesheet's `:root`, the
 * way `wiring-guards.test.ts` holds `sw.js`'s labelled literals — the only
 * kind of guard a literal that must be a literal can have.
 */
const ROOT = path.resolve(__dirname, '../../..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

function rootToken(name: string): string {
  const css = read('src/app/globals.css');
  const start = css.search(/^:root \{/m);
  const block = css.slice(start, css.indexOf('\n}\n', start));
  const m = new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm').exec(block);
  if (!m) throw new Error(`:root does not declare --${name}`);
  return m[1].trim().toLowerCase();
}

function png(rel: string) {
  const buf = readFileSync(path.join(ROOT, rel));
  expect(buf.subarray(1, 4).toString('ascii'), `${rel} is not a PNG`).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colourType: buf[25] };
}

describe('the mark geometry', () => {
  it('is Bricolage outlines placed after the i, not text', () => {
    expect(MARK_LETTERS_PATH.startsWith('M')).toBe(true);
    /* Four letters — H, Y and E one contour each, P two (its bowl) — so at least five subpaths. */
    expect((MARK_LETTERS_PATH.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(MARK_LETTERS_PATH).toContain('Z');
    /* The leftmost point of the letters sits just right of the i and its 130-unit gap
       (the H's own left sidebearing is 40). Every x in the path is checked, because a
       contour need not START at its leftmost point — the H's does not. */
    const moveTos = [...MARK_LETTERS_PATH.matchAll(/M(-?\d+(?:\.\d+)?) /g)].map((m) => Number(m[1]));
    expect(moveTos.length).toBeGreaterThanOrEqual(5);
    for (const x of moveTos) {
      expect(x).toBeGreaterThanOrEqual(MARK_I.width + 130);
      expect(x).toBeLessThanOrEqual(MARK.width);
    }
    /* The i spans exactly the cap height: dot on the cap line, stem foot on the baseline. */
    expect(MARK_I.stemY + MARK_I.stemHeight).toBe(MARK.height);
    expect(MARK_I.dot + MARK_I.gap).toBe(MARK_I.stemY);
  });

  it('builds icons, splashes and the wordmark from the same numbers', () => {
    const icon = iconSvg({ size: 512, ground: '#ffffff', accent: '#e0263e', ink: '#0a0a0a', markWidth: 0.74 });
    expect(icon).toContain('width="512"');
    expect(icon).toContain(MARK_LETTERS_PATH); // the icon is the whole wordmark (owner, 2026-09-23)
    expect(splashSvg({ width: 320, height: 480, ground: '#fff', accent: '#e0263e', ink: '#0a0a0a', markWidth: 0.34 })).toContain(MARK_LETTERS_PATH);
    expect(markSvg({ accent: '#e0263e', ink: '#0a0a0a' })).toContain(`viewBox="0 0 ${MARK.width} ${MARK.height}"`);
    /* A transparent canvas draws no ground rect at all. */
    expect(iconSvg({ size: 108, ground: null, accent: '#e0263e', ink: '#0a0a0a', markWidth: 0.56 })).not.toContain('<rect width="108"');
  });
});

describe('the rasterised assets', () => {
  const manifest = JSON.parse(read('public/manifest.json')) as { icons: Array<{ src: string; sizes: string }>; screenshots?: unknown };

  it('exist at every size the manifest declares, as RGBA (the 32-bit shape Play asks for)', () => {
    expect(manifest.icons.length).toBeGreaterThanOrEqual(9);
    for (const icon of manifest.icons) {
      const [w, h] = icon.sizes.split('x').map(Number);
      const info = png(`public/${icon.src}`);
      expect(info, icon.src).toEqual({ width: w, height: h, colourType: 6 });
    }
  });

  it('does not ship the stale serif mock as a store screenshot', () => {
    expect(manifest.screenshots).toBeUndefined();
    expect(existsSync(path.join(ROOT, 'public/icons/screenshot-mobile.png'))).toBe(false);
  });

  it('gives iOS an opaque 1024 with no alpha channel, and Android a transparent adaptive foreground', () => {
    expect(png('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')).toEqual({ width: 1024, height: 1024, colourType: 2 });
    const densities: Array<[string, number]> = [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]];
    for (const [d, scale] of densities) {
      const dir = `android/app/src/main/res/mipmap-${d}`;
      expect(png(`${dir}/ic_launcher_foreground.png`), d).toEqual({ width: 108 * scale, height: 108 * scale, colourType: 6 });
      expect(png(`${dir}/ic_launcher.png`), d).toEqual({ width: 48 * scale, height: 48 * scale, colourType: 6 });
      expect(png(`${dir}/ic_launcher_round.png`), d).toEqual({ width: 48 * scale, height: 48 * scale, colourType: 6 });
    }
  });

  it('keeps every splash at the size its density folder promises', () => {
    const portrait: Array<[string, number, number]> = [['mdpi', 320, 480], ['hdpi', 480, 800], ['xhdpi', 720, 1280], ['xxhdpi', 960, 1600], ['xxxhdpi', 1280, 1920]];
    for (const [d, w, h] of portrait) {
      expect(png(`android/app/src/main/res/drawable-port-${d}/splash.png`).width).toBe(w);
      expect(png(`android/app/src/main/res/drawable-port-${d}/splash.png`).height).toBe(h);
      expect(png(`android/app/src/main/res/drawable-land-${d}/splash.png`).width).toBe(h);
    }
    for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
      expect(png(`ios/App/App/Assets.xcassets/Splash.imageset/${name}`)).toEqual({ width: 2732, height: 2732, colourType: 2 });
    }
  });

  it('the sticker is gone', () => {
    for (const f of ['public/brand/logo-sticker-2026.png', 'public/brand/ihype-icon-master-2026.png', 'public/brand/ihype-menu-logo.webp']) {
      expect(existsSync(path.join(ROOT, f)), f).toBe(false);
    }
  });

  it('the builder reads its colours off :root and restates none', () => {
    const script = read('scripts/build-brand-assets.mts');
    expect(script).toMatch(/globals\.css/);
    expect(script).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});

describe('the Satori palette', () => {
  it('matches :root token for token, by the label each literal carries', () => {
    const src = read('src/app/api/og/palette.ts');
    const labelled = [...src.matchAll(/^\s*\w+:\s*'([^']+)',\s*\/\*\s*(--[\w-]+)\s*\*\//gm)];
    expect(labelled.length).toBeGreaterThanOrEqual(9);
    for (const [, value, token] of labelled) {
      expect(value.toLowerCase().replace(/\s/g, ''), token).toBe(rootToken(token.slice(2)).replace(/\s/g, ''));
    }
    /* Every literal in the palette is labelled — an unlabelled one has nothing holding it. */
    const literals = [...src.matchAll(/'(#[0-9a-fA-F]{6}|rgba?\([^)]*\))'/g)];
    expect(literals.length).toBe(labelled.length);
  });

  it('every image route draws the mark and none carries the old lockup or DS8 navy', () => {
    const routes = [
      'src/app/opengraph-image.tsx', 'src/app/artists/[slug]/opengraph-image.tsx', 'src/app/shows/[slug]/opengraph-image.tsx',
      'src/app/venues/[slug]/opengraph-image.tsx', 'src/app/fans/[slug]/opengraph-image.tsx',
      'src/app/shows/[slug]/poster/route.tsx', 'src/app/api/og/route.tsx', 'src/app/api/milestones/[profileId]/card/route.tsx',
    ];
    for (const r of routes) {
      /* Masked first: the milestone card's own comment names the `var(--role-venue)`
         it used to paint, which is exactly the scanner-reads-its-own-prose trap. */
      const src = maskComments(read(r));
      expect(src, r).toContain('BrandMarkImage');
      expect(src, r).not.toMatch(/>HYPE</);
      expect(src, r).not.toMatch(/#0b1220|#ff5029|#22e5d4|#b983ff|var\(--/);
    }
  });
});
