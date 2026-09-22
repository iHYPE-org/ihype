import type { CSSProperties } from 'react';
import { MARK, MARK_I, MARK_LETTERS_PATH } from '@/lib/brand-mark';

/**
 * THE iHYPE MARK — the lowercase `i` as two blocks with a square dot, then
 * HYPE, drawn as ONE SVG from the geometry in `src/lib/brand-mark.ts`.
 *
 * It is all geometry and no text as of 2026-09-22. The first version typeset
 * HYPE in `var(--font-display)`, so the mark wore Anton on the street theme
 * and Playfair on classical while its own header said a mark may not change
 * shape on a font swap. The letters are Bricolage's own outlines now (see the
 * lib for how they were taken and placed), so the header, the launch screen,
 * every shared-link image and every app icon draw the same shape — the four
 * of them were three different logos before this.
 *
 * Paint comes from the stylesheet: `.ihype-mark-i` fills `--accent` and
 * `.ihype-mark-letters` fills `--ink`, so the six themes and `audit:retro`
 * are both satisfied, and the header's hover deepens the `i` through one
 * token. No container, so it sits on any ground.
 *
 * Every mount names the mark on its wrapper (`aria-label="iHYPE home"` on the
 * header links, `aria-hidden` on the splash), so the SVG itself is hidden from
 * the accessibility tree rather than announcing "HYPE" a second time.
 *
 * What it replaces, for the record: `public/brand/logo-sticker-2026.png`, a
 * 1MB raster carrying five ideas in one container (a rounded frame, a crowd
 * silhouette over embers, distressed brush type, the domain, a ruled "LOCAL
 * MUSIC" tagline) on a ground two conversions old. Illegible at header size,
 * the most generic live-music image there is, and — the testers' own words —
 * the AI look. The sticker and the icon set built from it are gone; the icons
 * are rendered from this same geometry by `npm run brand:assets`.
 */
type Props = {
  /** Cap height in px — the wordmark's height, since its viewBox IS the cap. */
  size?: number;
  className?: string;
};

export function IhypeMark({ size = 12, className }: Props) {
  const { width, dot, stemY, stemHeight, radius } = MARK_I;
  return (
    <svg
      aria-hidden="true"
      className={`ihype-mark${className ? ` ${className}` : ''}`}
      style={{ '--ihype-mark-size': `${size}px` } as CSSProperties}
      viewBox={`0 0 ${MARK.width} ${MARK.height}`}
    >
      {/* Square dot, not round: it is the one letterform decision that makes
          this an iHYPE `i` rather than any `i`, and it survives to 16px. */}
      <g className="ihype-mark-i">
        <rect height={dot} rx={radius} width={width} x="0" y="0" />
        <rect height={stemHeight} rx={radius} width={width} x="0" y={stemY} />
      </g>
      <path className="ihype-mark-letters" d={MARK_LETTERS_PATH} />
    </svg>
  );
}
