import { MARK, MARK_I, MARK_LETTERS_PATH, type MarkPaint } from '@/lib/brand-mark';

/**
 * The mark for Satori (`next/og` ImageResponse) — every opengraph-image, the
 * `/api/og` card, the show poster and QR sheet, the milestone card.
 *
 * Satori renders SVG geometry but has no stylesheet and cannot load a woff2,
 * so the same lockup that `IhypeMark` draws with tokens is drawn here with the
 * colours passed IN. It carries no literal of its own: each route hands it
 * the hex it paints with, because those routes are the surfaces
 * `audit:retro` exempts (a Satori canvas has no `:root` to read) and this
 * component is not.
 *
 * Before this the nine image routes typeset the name as a WHITE `i` and an
 * ORANGE `HYPE` — the mark's colours the other way round, in DS8's orange, on
 * DS8's navy — so every link shared from the product previewed a logo the
 * product no longer had.
 */
export function BrandMarkImage({ height, accent, ink }: MarkPaint & { height: number }) {
  const width = Math.round((MARK.width / MARK.height) * height);
  const { width: iw, dot, stemY, stemHeight, radius } = MARK_I;
  return (
    <svg height={height} viewBox={`0 0 ${MARK.width} ${MARK.height}`} width={width}>
      <rect fill={accent} height={dot} rx={radius} width={iw} x="0" y="0" />
      <rect fill={accent} height={stemHeight} rx={radius} width={iw} x="0" y={stemY} />
      <path d={MARK_LETTERS_PATH} fill={ink} />
    </svg>
  );
}
