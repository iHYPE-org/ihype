/**
 * THE iHYPE MARK.
 *
 * What it replaces, and why the old one had to go. `public/brand/
 * logo-sticker-2026.png` is a 1MB raster sticker carrying five competing
 * ideas in one container: a rounded-square frame, a crowd-with-raised-hands
 * silhouette over orange embers, a distressed brush wordmark, the domain
 * `.ORG`, and a ruled "LOCAL MUSIC" tagline. Four measured problems with it:
 *
 *  1. It does not scale. At the 54px it rendered at in the header, the
 *     tagline and the TLD are illegible, so most of the file is paying for
 *     detail nobody can resolve.
 *  2. Distressed brush type over a crowd silhouette with orange sparks is
 *     the most generic "live music" image there is — which is the opposite
 *     of what this change set is for.
 *  3. Its colour is two grounds out of date: DS8 orange on near-black, while
 *     the product has been Apple Music red on white since row 346. Same drift
 *     this file's own memory records for `sw.js` and the launch colours.
 *  4. A domain inside a mark spends its most valuable space on something the
 *     address bar already says.
 *
 * What this is instead: the lowercase `i` as an accent block with a square
 * dot, then HYPE set tight in the display face. One idea — the product's own
 * name, in the product's own typeface — and no container, so it sits on any
 * ground. It is drawn rather than typeset for the `i` because a glyph's stem
 * width is a property of whichever font actually loaded, and a mark may not
 * change shape on a font swap.
 *
 * Everything paints from tokens, so it follows the six themes and `audit:retro`
 * stays at zero. The sticker is NOT deleted: the shipped iOS and Android app
 * icons are built from it and are already in review, so replacing those is a
 * store-asset change with a build attached, deliberately not made here.
 */
type Props = {
  /** Cap height of the wordmark in px. The `i` scales from it. */
  size?: number;
  /** `mark` drops the wordmark, for square spaces that already say iHYPE. */
  variant?: 'full' | 'mark';
  className?: string;
};

export function IhypeMark({ size = 20, variant = 'full', className }: Props) {
  return (
    <span
      className={`ihype-mark${className ? ` ${className}` : ''}`}
      data-variant={variant}
      style={{ '--ihype-mark-size': `${size}px` } as React.CSSProperties}
    >
      <svg aria-hidden="true" className="ihype-mark-i" viewBox="0 0 12 34">
        {/* Square dot, not round: it is the one letterform decision that makes
            this an iHYPE `i` rather than any `i`, and it survives to 16px. */}
        <rect height="8" rx="1.6" width="9" x="1.5" y="0" />
        <rect height="22" rx="1.6" width="9" x="1.5" y="12" />
      </svg>
      {variant === 'full' ? (
        /* Not wrapped in `t()`, and deliberately NOT carrying an
           `i18n-exempt:` marker either. A brand name is the same word in every
           locale — CLAUDE.md's Brand constants allow exactly one — and
           `audit:untranslated` already declines to flag a single all-caps
           token, verified against a controlled probe rather than assumed: a
           sentence in this same file IS reported, `HYPE` is not. A marker here
           would read as the thing holding the gate down while doing nothing,
           which is the shape this repository has been bitten by before. */
        <span className="ihype-mark-word">HYPE</span>
      ) : null}
    </span>
  );
}
