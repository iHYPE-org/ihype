/**
 * THE iHYPE MARK, AS GEOMETRY.
 *
 * One lockup: the lowercase `i` drawn as two blocks with a SQUARE dot, then
 * HYPE. Every consumer draws from these numbers — the React component in the
 * header and on the launch screen, the Satori images behind every shared link,
 * and `scripts/build-brand-assets.mts`, which rasterises the app icons and the
 * native splash screens — so there is exactly one shape and it cannot drift
 * between a header and an icon the way the sticker, the `iH.` splash tile and
 * the OG cards' white-`i`-orange-HYPE lockup drifted from each other (three
 * logos in one product, 2026-09-22).
 *
 * WHY THE LETTERS ARE PATHS AND NOT TEXT. The first version of the component
 * typeset HYPE in `var(--font-display)`, which is Bricolage on the default
 * theme and Anton, Chakra Petch, Playfair or Instrument Serif on the four
 * character themes — so the mark changed typeface with the theme, which a mark
 * may not do, and its own header said so about the `i` while doing it to the
 * word. The outlines below are Bricolage Grotesque at wght 800 / opsz 96 (the
 * variable font's default instance, so nothing was interpolated), taken from
 * `src/app/fonts/BricolageGrotesque-Variable.woff2` with fontTools, y flipped
 * so the cap line is 0 and the baseline is 660 (the face's own cap height in
 * its 1000-unit em). Letter positions are the ones Chromium laid out for
 * "HYPE" at 1000px with the mark's -0.015em tracking — advance minus 15, no
 * kerning pairs in this face for these letters — so the drawn word matches
 * what the typeset one measured.
 *
 * The `i` is NOT the font's own glyph. Its dot is square — that is the one
 * letterform decision that makes this an iHYPE `i` rather than any `i`, and it
 * survives to 16px — and its stem is 130 units against the H's 121, because a
 * free-standing stem with nothing beside it reads lighter than one inside a
 * letter. Dot top sits on the cap line, stem foot on the baseline.
 *
 * No imports, on purpose: `tsconfig.scripts.json` compiles the asset builder
 * and the Satori routes run at the edge, and both need this to be plain data.
 */

/** The wordmark's viewBox. Height IS the cap height, so sizing by height sizes the caps. */
export const MARK = { width: 2545, height: 660 } as const;

/** The `i`: a square dot over a stem, both `width` wide, in the same units as MARK. */
export const MARK_I = {
  width: 130,
  dot: 130,
  gap: 90,
  stemY: 220,
  stemHeight: 440,
  /** rx on both blocks — 0.18 of the width, the proportion the first version drew. */
  radius: 23,
} as const;

/** H Y P E, already placed: the first path starts at x = 260 (the `i` plus a 130-unit gap). */
export const MARK_LETTERS_PATH =
  'M695 660V0H857V660ZM300 660V0H462V660ZM421 396V260H780V396Z M1099 660V440L884 0H1076L1180 294H1182L1285 0H1475L1261 440V660Z M1623 473V343H1746Q1807 343 1837 318.5Q1867 294 1867 237Q1867 183 1839.5 156.5Q1812 130 1756 130H1623V0H1765Q1822 0 1871 13.5Q1920 27 1956.5 56Q1993 85 2013.5 129Q2034 173 2034 235Q2034 314 1998.5 367Q1963 420 1896 446.5Q1829 473 1732 473ZM1502 660V0H1664V660Z M2073 660V0H2235V660ZM2194 660V525H2545V660ZM2194 388V267H2499V388ZM2194 135V0H2545V135Z';

export type MarkPaint = { accent: string; ink: string };

/** The two blocks of the `i` as SVG markup. */
export function markGlyphMarkup(accent: string): string {
  const { width, dot, stemY, stemHeight, radius } = MARK_I;
  return (
    `<rect x="0" y="0" width="${width}" height="${dot}" rx="${radius}" fill="${accent}"/>` +
    `<rect x="0" y="${stemY}" width="${width}" height="${stemHeight}" rx="${radius}" fill="${accent}"/>`
  );
}

/** The whole wordmark as an SVG document string, for anything that is not React. */
export function markSvg({ accent, ink }: MarkPaint): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK.width} ${MARK.height}">` +
    markGlyphMarkup(accent) +
    `<path fill="${ink}" d="${MARK_LETTERS_PATH}"/></svg>`
  );
}

export type IconSpec = MarkPaint & {
  /** Side of the square in px. */
  size: number;
  /** Ground colour, or null for a transparent canvas (the Android adaptive foreground). */
  ground: string | null;
  /** The glyph's height as a fraction of the side. */
  glyphHeight: number;
  /** Corner radius as a fraction of the side, applied to the ground only. 0.5 is a circle. */
  cornerRadius?: number;
};

/**
 * THE APP ICON IS THE `i` ALONE — red square dot, ink stem, on the ground.
 * The wordmark was rendered into a square at 48px and compared: the word
 * reads at 60px and is a smudge at 29px, while the glyph reads at every size,
 * and the home screen prints the app's name under the icon anyway. Two blocks
 * at 56% of the side is deliberately plain; a plain mark on a plain ground is
 * the opposite of the generated-icon look (gradient blob, glossy tile, letter
 * in a rounded square with a glow) the testers named.
 */
export function iconSvg({ size, ground, accent, ink, glyphHeight, cornerRadius = 0 }: IconSpec): string {
  const scale = (size * glyphHeight) / MARK.height;
  const w = MARK_I.width * scale;
  const h = MARK.height * scale;
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  const r = size * cornerRadius;
  const bg = ground ? `<rect width="${size}" height="${size}" rx="${r}" fill="${ground}"/>` : '';
  const { width, dot, stemY, stemHeight, radius } = MARK_I;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    bg +
    `<g transform="translate(${x} ${y}) scale(${scale})">` +
    `<rect x="0" y="0" width="${width}" height="${dot}" rx="${radius}" fill="${accent}"/>` +
    `<rect x="0" y="${stemY}" width="${width}" height="${stemHeight}" rx="${radius}" fill="${ink}"/>` +
    `</g></svg>`
  );
}

export type SplashSpec = MarkPaint & {
  width: number;
  height: number;
  ground: string;
  /** The wordmark's width as a fraction of the SHORTER side. */
  markWidth: number;
};

/** A launch screen: the ground, and the wordmark centred at a fraction of the short side. */
export function splashSvg({ width, height, ground, accent, ink, markWidth }: SplashSpec): string {
  const w = Math.min(width, height) * markWidth;
  const scale = w / MARK.width;
  const h = MARK.height * scale;
  const x = (width - w) / 2;
  const y = (height - h) / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${ground}"/>` +
    `<g transform="translate(${x} ${y}) scale(${scale})">` +
    markGlyphMarkup(accent) +
    `<path fill="${ink}" d="${MARK_LETTERS_PATH}"/>` +
    `</g></svg>`
  );
}
