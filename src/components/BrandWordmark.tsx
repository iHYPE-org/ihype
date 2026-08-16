/**
 * The iHYPE wordmark, drawn as type + one inline path.
 *
 * ## Why this exists
 *
 * Three pieces of chrome — the legacy shell's menu tile, the marketing
 * header's menu tile and the landing header's home link — rendered the brand
 * as `/brand/ihype-menu-logo.webp`: the pre-DS8 **app-icon sticker**, a raster
 * of a crowd photograph carrying ".ORG" and a "LOCAL MUSIC" strapline, shown
 * inside a 48–54px box where neither line is legible. Design System 8 gives
 * that role a wordmark in two places — `guidelines/brand-wordmark-svg.card.html`
 * (the standalone mark: `i` in ink, `HYPE` in accent) and
 * `components/shell/LogoTrigger.jsx` (the same word with the bolt standing in
 * for the Y) — and the Music · Map · Me shell has shipped the LogoTrigger form
 * since row 282. The other three surfaces never got it.
 *
 * A raster is not merely off-brand here. It cannot take `currentColor`, so
 * each host had to paint a dark matte behind it to stop the sticker's own
 * black edge showing — `#000` on `.shell-logo-tile`, `#070605` on
 * `.app-menu-logo` — two theme-inverting literals that stayed dark on a light
 * page, and that existed only because of the asset.
 *
 * ## Sizing
 *
 * Everything is `em`, so a host sets `font-size` and nothing else. The ratios
 * are `LogoTrigger`'s own: the bolt is 1.24× the cap height and 0.61× that
 * wide, with a .06em gap. That is why `.mmm-logo-mark` could drop its
 * `--mmm-chrome-size` arithmetic and keep the identical rendered box —
 * 0.235 × 0.756 = 0.1777 and 0.235 × 1.24 = 0.2914, the two figures that were
 * hand-computed in `mmm.css`.
 *
 * `variant="brand"` splits the colour the way the wordmark card does: `i` in
 * `currentColor`, `HYPE` — bolt included, since the bolt IS the Y — in the
 * accent. Use it where the mark sits on the page ground. `variant="mono"`
 * (the default) is one colour throughout, for a trigger whose square already
 * carries the accent as its fill.
 */
export function BrandWordmark({
  className,
  variant = 'mono',
}: {
  className?: string;
  variant?: 'mono' | 'brand';
}) {
  const bolt = (
    <svg aria-hidden="true" viewBox="148 92 200 328">
      {/* Cropped to its own ink: the 512 artboard is mostly air, which at
          wordmark scale opens a gap either side and breaks the word into three
          pieces. Cropped, it sets as a letter between the H and the P. */}
      <path d="M280 96L152 288h96l-16 128 144-192h-96l16-128z" fill="currentColor" />
    </svg>
  );
  return (
    <span className={['brand-wordmark', className].filter(Boolean).join(' ')}>
      {variant === 'brand' ? (
        <>
          <span>i</span>
          <span className="brand-wordmark-accent">H{bolt}PE</span>
        </>
      ) : (
        <>
          <span>iH</span>
          {bolt}
          <span>PE</span>
        </>
      )}
    </span>
  );
}
