'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/**
 * A shelf: one named row of artwork tiles that scrolls sideways.
 *
 * Borrowed from Apple Music's structure by the MIDDLE ROAD (2026-09-04) and
 * the reason is breadth — a pane of stacked vertical lists shows one collection
 * at a time and buries the rest below the fold, so a member scrolls past
 * everything to find anything. A shelf spends one screen-height on four
 * collections instead of one.
 *
 * ## What is a shelf and what is not, because getting this wrong loses content
 *
 * **Collections shelve. Tracks do not.** A playlist, a station, an artist or a
 * venue is ONE object with an identity image, and three of them across a phone
 * is a reasonable glance. Fifty liked tracks behind a horizontal scroll is
 * strictly worse than a vertical list, because a list shows ten at a time and
 * scrolls the way a phone already scrolls. That is Apple's own split and it is
 * right; the liked-tracks list, the charts and the recommendation list are all
 * deliberately NOT shelves.
 *
 * Two more that stayed lists on purpose: the CHARTS rank is content — a tile
 * cannot carry "3" and mean it — and a RECOMMENDATION carries its reason ("You
 * asked a venue to book them"), which is the sentence that stops the row
 * reading as an advert and does not fit 104px.
 *
 * ## The fallback tile is the point at alpha
 *
 * Almost nothing has cover art yet, so the fallback IS the design rather than a
 * degradation of it. Each tile takes a deterministic treatment from the item's
 * own id — the same artist gets the same tile on every surface, every session —
 * alternating three dark cabinet tones with three light plate ones. The
 * alternation was not the first version: running all six between the three
 * walnut stops gave six near-identical dark browns, which reads as a bug rather
 * than as restraint, and was only visible by rendering it.
 *
 * Deliberately NOT invented brand colours. Every stop is a token whose ink is
 * already measured, the ROLE hues are semantic (a track tile coloured "venue"
 * states something false), and `--accent` fails outright at 2.70:1 under cream
 * ink. See the `.mmm-shelf-art[data-tone]` block for the arithmetic.
 */
export type MmmShelfTile = {
  id: string;
  title: string;
  sub?: string | null;
  artworkUrl?: string | null;
  /** A destination. Mutually exclusive with `onSelect`. */
  href?: string;
  /** An action — playing something, usually. Mutually exclusive with `href`. */
  onSelect?: () => void;
  /** Currently playing: lights the tile's edge. */
  active?: boolean;
  /** Overrides the derived one. Say what a tap does, not what the tile is. */
  label?: string;
};

/** Which of the six walnut treatments this item gets, stable across sessions. */
function toneFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return String(hash % 6);
}

export function MmmShelf({
  heading,
  count,
  seeAll,
  seeAllLabel = 'See all',
  tiles,
}: {
  heading: string;
  /** Shown beside the nameplate. Omit rather than passing 0 — a shelf with
   *  nothing in it renders nothing at all. */
  count?: number;
  seeAll?: string;
  seeAllLabel?: string;
  tiles: readonly MmmShelfTile[];
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  /* The edge fade is only honest when there IS more beyond the edge — the same
     rule and the same mechanism as `MmmSectionStrip`. Rendering it
     unconditionally fades the last tile of a shelf that fits, which says
     "truncated" about a complete collection. CSS cannot ask whether a box
     overflows, so the component measures and the stylesheet keys on the
     answer. */
  useEffect(() => {
    const node = railRef.current;
    if (!node) return undefined;
    const measure = () => setOverflowing(node.scrollWidth - node.clientWidth > 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [tiles]);

  if (tiles.length === 0) return null;

  return (
    <section aria-label={heading} className="mmm-shelf">
      <div className="mmm-shelf-head">
        <h3 className="mmm-eyebrow mmm-shelf-name">
          {heading}
          {typeof count === 'number' && <span className="mmm-shelf-count"> · {count}</span>}
        </h3>
        {seeAll && <Link className="mmm-shelf-more" href={seeAll}>{seeAllLabel}</Link>}
      </div>
      <div className="mmm-shelf-rail" data-overflow={overflowing} ref={railRef}>
        {tiles.map((tile) => {
          const art = (
            <>
              <span aria-hidden="true" className="mmm-shelf-art" data-tone={toneFor(tile.id)}>
                {tile.artworkUrl
                  // eslint-disable-next-line @next/next/no-img-element -- uploader-sized remote artwork, same as the full player
                  ? <img alt="" src={tile.artworkUrl} />
                  : (tile.title || '?').charAt(0).toUpperCase()}
              </span>
              <span className="mmm-shelf-title">{tile.title}</span>
              {tile.sub && <span className="mmm-shelf-sub">{tile.sub}</span>}
            </>
          );
          const shared = {
            className: 'mmm-shelf-tile',
            'data-active': tile.active ? 'true' : undefined,
            key: tile.id,
          };
          return tile.href
            ? <Link {...shared} aria-label={tile.label} href={tile.href}>{art}</Link>
            : (
              <button {...shared} aria-label={tile.label} onClick={tile.onSelect} type="button">
                {art}
              </button>
            );
        })}
      </div>
    </section>
  );
}
