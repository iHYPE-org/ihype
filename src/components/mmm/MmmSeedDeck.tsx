'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * `useLayoutEffect` measures before paint, which is what keeps the deck from
 * showing a 436px card for one frame and then resizing. React warns when it
 * runs during server rendering, where there is nothing to measure — so on the
 * server it falls back to the effect that never runs there anyway.
 */
const useMeasureEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * The seed deck — Discover itself, not a section of it.
 *
 * Built to `design/design-system-8/components/shell/SeedDeck.jsx`. One card at
 * a time: the artist's graphic with their name, the track and the release over
 * it, a clip running underneath, and the reason the card is in the deck at all.
 * Drag left to skip, right to save, HYPE beneath. The deck IS the surface
 * because the decision is binary and the queue is infinite — a grid of six asks
 * you to compare when the product only wants a verdict.
 *
 * ## Four things here are load-bearing
 *
 * 1. **Every card states why it is in the deck** (`why`). ADHERENCE 36: a
 *    recommendation you cannot account for is indistinguishable from an ad.
 *    `/api/discover/seeds` has always returned this and the surface dropped it.
 * 2. **Skip and save commit synchronously.** Never through an animation or a
 *    transition callback: this shell runs where the document timeline may not
 *    advance, and a verdict that waits on a frame then never lands at all. The
 *    card leaves and the next arrives in the same tick, which is also what a
 *    fast swiper wants.
 * 3. **The clip meter runs on an interval, not rAF**, for the same reason —
 *    with `performance.now()` deltas, so it measures real elapsed time.
 * 4. **The deck measures the room it actually has** rather than being told, and
 *    sizes the card down to fit. A fixed height is how a deck comes to render
 *    440px inside a 380px slot, over the player and the home indicator.
 */

export type MmmSeedItem = {
  id: string;
  hexId: string;
  title: string;
  artistName: string;
  artistSlug: string;
  album: string;
  /** Why this card is here, from the API. Never fabricated on the client. */
  why: string;
  artworkUrl: string | null;
  initial: string;
};

/**
 * The two stops of the card's fallback gradient, derived from the artist name
 * so one artist always draws the same card. Hues only — saturation and
 * lightness are fixed, so no artist can land on an unreadable card. This is the
 * design's "falls back to the artist's palette — never a stock image".
 */
function palette(seed: string): { c1: string; c2: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  return {
    c1: `hsl(${hash} 62% 34%)`,
    c2: `hsl(${(hash + 48) % 360} 58% 22%)`,
  };
}

export function MmmSeedDeck({
  busy = false,
  clipSeconds = 22,
  hypeLocked = false,
  hypeLabel,
  hyped = false,
  index,
  items,
  onHype,
  onOpenArtist,
  onSave,
  onSkip,
  onTogglePlay,
  playing = false,
  savedCount = 0,
}: {
  /** A verdict is in flight. The controls stay visible and stop responding. */
  busy?: boolean;
  clipSeconds?: number;
  hypeLabel?: string;
  hypeLocked?: boolean;
  hyped?: boolean;
  index: number;
  items: MmmSeedItem[];
  onHype: (item: MmmSeedItem) => void;
  onOpenArtist: (item: MmmSeedItem) => void;
  onSave: (item: MmmSeedItem) => void;
  onSkip: (item: MmmSeedItem) => void;
  onTogglePlay: (item: MmmSeedItem) => void;
  playing?: boolean;
  savedCount?: number;
}) {
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [clip, setClip] = useState(0);
  const [room, setRoom] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const item = items[index];

  // The deck reads its own top against the chrome the shell publishes, so it
  // cannot drift when the copy above it changes height.
  useMeasureEffect(() => {
    const measure = () => {
      const node = rootRef.current;
      if (!node) return;
      const top = node.getBoundingClientRect().top;
      /* The geometry tokens are declared on `.mmm-frame`, not on `:root` — this
         read was against `document.documentElement`, where they resolve to the
         empty string, so the reservation silently collapsed to the +20 below and
         the deck has been sizing itself as though the dock were not there. */
      const frame = node.closest('.mmm-frame') ?? document.documentElement;
      const styles = getComputedStyle(frame);
      const px = (name: string) => parseFloat(styles.getPropertyValue(name)) || 0;
      /* `--mmm-chrome-top` is the dock's full height including its safe area
         and whatever it is riding on (the cookie banner lifts it), which is
         exactly "how much of the bottom of the screen is not mine". It replaced
         `--mmm-bottom + --mmm-chrome-size`, which was the old floating chrome's
         resting offset plus its height — two terms for one measurement, and
         `--mmm-bottom` no longer exists. */
      const reserved = px('--mmm-chrome-top') + 20;
      /* visualViewport follows the actually visible WebView when iOS browser
         chrome or the keyboard changes size; innerHeight can continue to
         report the larger layout viewport and put the actions behind it. */
      const viewport = window.visualViewport;
      const visibleBottom = viewport
        ? viewport.offsetTop + viewport.height
        : window.innerHeight;
      setRoom(Math.max(0, visibleBottom - top - reserved));
    };
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('scroll', measure);
    };
  }, [index]);

  // Interval, not rAF — see the header. Restarts on every card.
  useEffect(() => {
    setClip(0);
    if (!playing) return undefined;
    let last = performance.now();
    let value = 0;
    const id = window.setInterval(() => {
      const now = performance.now();
      value = (value + (now - last) / 1000 / clipSeconds) % 1;
      last = now;
      setClip(value);
    }, 100);
    return () => window.clearInterval(id);
  }, [clipSeconds, index, playing]);

  const fling = useCallback(
    (direction: number) => {
      setDx(0);
      setDy(0);
      if (!item || busy) return;
      if (direction > 0) onSave(item);
      else onSkip(item);
    },
    [busy, item, onSave, onSkip],
  );

  if (!item) {
    return (
      <div className="mmm-deck-empty">
        <p className="mmm-deck-empty-title">Deck empty</p>
        <p className="mmm-deck-empty-body">New seeds arrive as artists upload, and as you move.</p>
      </div>
    );
  }

  /* Counted from the real boxes below the card: 4 top padding, 34 of the
     behind-cards peeking, one 18 gap and the 56 control row. The floor is the
     card's own content height (~200px) — below that the card is not small, it
     is empty, and the pane scrolls instead. */
  const CHROME = 4 + 34 + 18 + 56;
  const available = room ?? 0;
  /* 480px is the desktop ceiling. At 560px the card itself fit a 900px
     viewport, but its verdict controls landed behind the persistent player
     and made the pane scroll for a few pixels. Narrow viewports still use the
     measured room below, so iOS and Android continue to size to their actual
     visible viewport. */
  const cardHeight = available ? Math.max(200, Math.min(480, available - CHROME)) : 480;
  const rotation = Math.max(-14, Math.min(14, dx / 14));
  const intent = Math.min(1, Math.abs(dx) / 108);
  const colors = palette(item.artistSlug || item.artistName || item.id);

  const behind = (offset: number) => {
    const next = items[index + offset];
    if (!next) return null;
    const step = offset - intent * 0.55;
    const shade = palette(next.artistSlug || next.artistName || next.id);
    return (
      <div
        aria-hidden="true"
        className="mmm-deck-behind"
        key={`behind-${index + offset}`}
        style={{
          height: cardHeight,
          transform: `translateY(${step * 16}px) scale(${1 - step * 0.045})`,
          opacity: 1 - step * 0.28,
        }}
      >
        <span style={{ background: `linear-gradient(150deg, ${shade.c1}, ${shade.c2})` }} />
      </div>
    );
  };

  return (
    <div className="mmm-deck" ref={rootRef}>
      <div className="mmm-deck-stack" style={{ height: cardHeight + 34 }}>
        {behind(2)}
        {behind(1)}

        <div
          className="mmm-deck-card"
          onPointerCancel={() => { drag.current = null; setDx(0); setDy(0); }}
          onPointerDown={(event) => {
            drag.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            setDx(event.clientX - drag.current.x);
            setDy((event.clientY - drag.current.y) * 0.35);
          }}
          onPointerUp={() => {
            if (!drag.current) return;
            drag.current = null;
            if (Math.abs(dx) > 108) fling(dx > 0 ? 1 : -1);
            else { setDx(0); setDy(0); }
          }}
          style={{
            height: cardHeight,
            transform: `translate(${dx}px, ${dy}px) rotate(${rotation}deg)`,
          }}
        >
          {item.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote R2 art,
            // drawn full-bleed at the card's own size; a loader round trip here
            // would delay the one image the card is made of.
            <img alt="" className="mmm-deck-art" src={item.artworkUrl} />
          ) : (
            <span
              aria-hidden="true"
              className="mmm-deck-art"
              style={{ background: `linear-gradient(150deg, ${colors.c1} 0%, ${colors.c2} 100%)` }}
            >
              <span className="mmm-deck-initial">{item.initial}</span>
            </span>
          )}
          <span aria-hidden="true" className="mmm-deck-veil" />

          {/* The clip meter, with the clip's length stated so 22 seconds is
              never mistaken for the whole track. */}
          <div className="mmm-deck-clip">
            <svg aria-hidden="true" height="34" viewBox="0 0 34 34" width="34">
              <circle className="mmm-deck-clip-track" cx="17" cy="17" r="15" strokeWidth="2" />
              <circle
                className="mmm-deck-clip-fill"
                cx="17"
                cy="17"
                fill="none"
                pathLength={100}
                r="15"
                strokeDasharray={100}
                strokeDashoffset={100 - clip * 100}
                strokeLinecap="round"
                strokeWidth="2"
                transform="rotate(-90 17 17)"
              />
            </svg>
            <span>{Math.round(clipSeconds)}s clip</span>
          </div>

          <button
            aria-label={playing ? 'Pause the clip' : 'Play the clip'}
            className="mmm-deck-play"
            data-paused={!playing || undefined}
            onClick={(event) => { event.stopPropagation(); onTogglePlay(item); }}
            onPointerDown={(event) => event.stopPropagation()}
            type="button"
          >
            <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
          </button>

          {/* The verdict the drag is about to commit, stated before release. */}
          <span aria-hidden="true" className="mmm-deck-verdict" data-side="save" style={{ opacity: dx > 0 ? intent : 0 }}>Save</span>
          <span aria-hidden="true" className="mmm-deck-verdict" data-side="skip" style={{ opacity: dx < 0 ? intent : 0 }}>Skip</span>

          <div className="mmm-deck-body">
            <button
              className="mmm-deck-artist"
              onClick={(event) => { event.stopPropagation(); onOpenArtist(item); }}
              onPointerDown={(event) => event.stopPropagation()}
              type="button"
            >
              {item.artistName}
            </button>
            <p className="mmm-deck-song">{item.title}</p>
            {item.album ? <p className="mmm-deck-album">{item.album}</p> : null}
            <p className="mmm-deck-why">{item.why}</p>
          </div>
        </div>
      </div>

      <div className="mmm-deck-controls">
        <button
          aria-label={`Skip ${item.artistName}`}
          className="mmm-deck-round"
          disabled={busy}
          onClick={() => fling(-1)}
          type="button"
        >
          <span aria-hidden="true">✕</span>
        </button>

        <button
          aria-label={
            hypeLocked
              ? `Already hyped ${item.artistName}${hypeLabel ? `. Available again in ${hypeLabel}` : ''}`
              : `HYPE ${item.artistName}`
          }
          aria-pressed={hyped}
          className="mmm-deck-hype"
          data-hyped={hyped || undefined}
          data-locked={hypeLocked || undefined}
          disabled={hypeLocked || busy}
          onClick={() => onHype(item)}
          type="button"
        >
          <span>HYPE</span>
          {hypeLocked && hypeLabel ? <span className="mmm-deck-hype-wait">{hypeLabel}</span> : null}
        </button>

        <button
          aria-label={`Save ${item.title} to your Discover playlist`}
          className="mmm-deck-round"
          disabled={busy}
          onClick={() => fling(1)}
          type="button"
        >
          <span aria-hidden="true">♡</span>
        </button>
      </div>

      <p className="mmm-deck-count">
        {savedCount > 0 ? `${savedCount} saved · ` : ''}
        {Math.max(0, items.length - index - 1)} more waiting
      </p>
    </div>
  );
}
