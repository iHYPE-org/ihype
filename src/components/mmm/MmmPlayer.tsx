'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The persistent player, rebuilt to Design System 8's `PlayerPill` contract
 * (`design/design-system-8/components/shell/PlayerPill.d.ts`) and the figures
 * in `SHELL_LOCK_2026-08-08.md`, which are signed off as final.
 *
 * The previous version of this file was a 42px circle, a title, one heart and a
 * play button. Every number below is from the lock, and several of them are
 * there because they fixed a specific bug — read the lock before changing one,
 * and re-derive the rest rather than nudging it in isolation.
 *
 * ## The five that are load-bearing
 *
 * 1. **One row, not a column of rows.** The artwork is the row's first child,
 *    so it centres against the pill's whole height and the scrub row aligns
 *    with the title *by construction*. The prototype used a hardcoded
 *    `paddingLeft: 58` that only happened to line up at one artwork size.
 * 2. **Artwork is a 64px SQUIRCLE, not a circle** — `anchorHeight - 24`, with
 *    radius `round(64 × 0.342)`, the same corner ratio as the logo trigger.
 *    The lock is explicit about why: the square holds the artist's *logo*, and
 *    a circle crops a mark. 64 in 88 leaves exactly 12px above and below, which
 *    is the pill's own `0 12px` padding, so the inset matches on every side.
 * 3. **Volume is a fixed 108px; seek takes the remainder.** Seek is scrubbed,
 *    volume is set once — but at 64px volume was unaimable.
 * 4. **A continuous accent hairline**, not a partial top bar. The bar competed
 *    with the scrub row for the same job and, measured against the pill's
 *    rectangular box, hung past the capsule at each end.
 * 5. **HYPE always reads HYPE.** State is the fill, the border, and the wait
 *    label *beside* the word — never a rename.
 *
 * ## HYPE and favourite are two controls because they are two acts
 *
 * HYPE spends from your balance and moves the artist up the local chart.
 * The heart saves the track to your library and nothing else. The lock records
 * that collapsing them into one heart "quietly removed the mechanic the product
 * is named after" — which is exactly the state this file was in. Both are
 * wired: HYPE through the shell's `/api/hype` call, favourite through
 * `/api/fan-favorites`, which already existed.
 *
 * ## Presentation only
 *
 * It owns no audio element. Every value is passed in and every control is a
 * callback, which is what lets it sit over the real `MediaPlayerProvider`.
 */

export type MmmPlayerTrack = {
  title: string;
  artist: string;
  /** Shown after the artist as "artist · album", as its own destination. */
  album?: string;
  /** Fallback when there is no artwork URL. */
  initial: string;
  artworkUrl?: string | null;
};

export function MmmPlayer({
  anchorHeight = 88,
  canFavourite,
  canHype,
  canTogglePlay,
  canGoBack,
  canGoForward,
  faved,
  hidden,
  hypeCount,
  hypeLabel,
  hypeLocked,
  hyped,
  idleMs = 10000,
  narrow,
  onNext,
  onPrev,
  onOpenAlbum,
  onOpenArtist,
  onSeek,
  onToggleFav,
  onToggleHype,
  onTogglePlay,
  onVolume,
  playing,
  progress,
  track,
  volume,
  wake = 0,
}: {
  anchorHeight?: number;
  canFavourite: boolean;
  canHype: boolean;
  canTogglePlay: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  faved: boolean;
  hidden: boolean;
  hypeCount?: string | number;
  hypeLabel?: string;
  hypeLocked?: boolean;
  hyped: boolean;
  /**
   * How long the pill waits before retiring to its disc. The design's own
   * default; exposed so a test does not have to wait ten seconds.
   */
  idleMs?: number;
  narrow: boolean;
  onNext: () => void;
  onPrev: () => void;
  /**
   * The artist name in the meta line. A SEPARATE destination from the release —
   * omit it and the name renders as plain text rather than a target that does
   * nothing.
   */
  onOpenArtist?: () => void;
  /** The release name in the meta line. Separate from the artist. */
  onOpenAlbum?: () => void;
  onSeek: (value: number) => void;
  onToggleFav: () => void;
  onToggleHype: () => void;
  onTogglePlay: () => void;
  onVolume: (value: number) => void;
  playing: boolean;
  /** 0–100. */
  progress: number;
  track: MmmPlayerTrack | null;
  /** 0–100. */
  volume: number;
  /**
   * Bump to bring the pill back from its retired disc and restart the idle
   * countdown. Any number will do — only a CHANGE is read. The shell bumps it
   * when the logo is tapped, because on a wide screen the player has usually
   * retired by then and the logo is the control that is always there.
   */
  wake?: number;
}) {
  /**
   * The pill retires to a disc after `idleMs` of nothing happening, and comes
   * back when it is touched or when `wake` changes.
   *
   * Two things about this are the design's and are easy to get backwards:
   *
   *  - **It is a WIDE-screen behaviour.** `PlayerPill.jsx` computes
   *    `mini = !narrow && !awake && !dimmed` and returns early from the timer
   *    on `narrow`, so a phone never retires. The `wake` prop's own comment
   *    says "wake the player on a phone", which is a summary that disagrees
   *    with the implementation — the implementation wins.
   *  - **One timer, not a CSS animation and not the document timeline.** That
   *    timeline does not advance in every context this runs in, and a
   *    both-filled animation then holds its from-state forever.
   */
  const [awake, setAwake] = useState(true);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const rouse = () => setAwake(true);

  useEffect(() => { setAwake(true); }, [wake]);

  useEffect(() => {
    if (narrow || hidden || !awake) return undefined;
    const timer = window.setTimeout(() => setAwake(false), idleMs);
    return () => window.clearTimeout(timer);
    // Every value that means "something is happening" restarts the countdown.
  }, [awake, hidden, idleMs, narrow, playing, progress, volume, hyped, faved, track?.title]);

  // null renders nothing. Never invent a placeholder track.
  if (!track) return null;

  const art = Math.max(40, anchorHeight - 24);
  /* Artist and release are separate destinations, so they are separate
     targets. One run of grey text that silently opens one of two different
     pages is the thing this replaces — and a name with no handler stays plain
     text rather than becoming a target that goes nowhere. */
  const nameLink = (text: string, onClick?: () => void) =>
    onClick
      ? <button className="mmm-player-name" onClick={onClick} type="button">{text}</button>
      : <span className="mmm-player-name" data-plain="">{text}</span>;

  // The retired disc. Same squircle ratio as the logo trigger and the artwork,
  // so the three read as one family.
  if (!narrow && !awake && !hidden) {
    const size = anchorHeight;
    const radius = Math.round(size * 0.342);
    const inset = 2;
    const pct = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
    return (
      <button
        aria-label={`Show the player — ${track.title} by ${track.artist}`}
        className="mmm-player-mini"
        onClick={rouse}
        style={{ width: size, height: size, borderRadius: radius }}
        type="button"
      >
        {/* `pathLength` normalises the rounded rectangle's perimeter to 100, so
            progress maps straight onto it with no arc-length maths — and stays
            correct if the corner radius changes. */}
        <svg aria-hidden="true" height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
          <rect
            fill="none"
            height={size - inset * 2}
            rx={radius - inset}
            stroke="var(--hair-100)"
            strokeWidth={2}
            width={size - inset * 2}
            x={inset}
            y={inset}
          />
          <rect
            fill="none"
            height={size - inset * 2}
            pathLength={100}
            rx={radius - inset}
            stroke="var(--accent)"
            strokeDasharray={100}
            strokeDashoffset={100 - pct}
            strokeLinecap="round"
            strokeWidth={2}
            width={size - inset * 2}
            x={inset}
            y={inset}
          />
        </svg>
        <span>{track.initial}</span>
      </button>
    );
  }

  return (
    <div
      aria-hidden={hidden}
      className="mmm-player"
      data-hidden={hidden}
      onPointerDown={rouse}
      ref={rootRef}
      style={{ minHeight: anchorHeight }}
    >
      {/* The continuous hairline. A pseudo-element would inherit the capsule's
          radius; this is a real child so it can span the pill's full width. */}
      <span aria-hidden="true" className="mmm-player-hairline" />

      <div
        className="mmm-player-art"
        style={{ width: art, height: art, borderRadius: Math.round(art * 0.342) }}
      >
        {track.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- artwork URLs are
          // R2/remote and already sized by the uploader; next/image would add a
          // loader round trip for a 64px square that is on screen constantly.
          <img alt="" height={art} src={track.artworkUrl} width={art} />
        ) : (
          <span aria-hidden="true">{track.initial}</span>
        )}
      </div>

      <div className="mmm-player-body">
        <Marquee className="mmm-player-track" text={track.title} />
        <div className="mmm-player-artist">
          {nameLink(track.artist, onOpenArtist)}
          {track.album ? <span aria-hidden="true"> · </span> : null}
          {track.album ? nameLink(track.album, onOpenAlbum) : null}
        </div>

        {!narrow && (
          <div className="mmm-player-scrub">
            <Track
              accent
              label="Seek"
              onChange={onSeek}
              value={progress}
            />
            {/* Fixed 108px, per the lock: seek is scrubbed and takes the
                remainder, volume is set once. Dropped on a phone — it does not
                fit beside the artwork at 393px and is reachable elsewhere. */}
            <Track
              label="Volume"
              onChange={onVolume}
              value={volume}
              width={108}
            />
          </div>
        )}
      </div>

      <div className="mmm-player-controls">
        {!narrow && (
          <IconButton
            disabled={!canGoBack}
            hidden={hidden}
            label="Previous track"
            onClick={onPrev}
            /* Single chevrons, not doubled — the lock says so outright. */
            glyph="‹"
          />
        )}

        {canTogglePlay && (
          <button
            aria-label={playing ? 'Pause' : 'Play'}
            className="mmm-player-play"
            onClick={onTogglePlay}
            tabIndex={hidden ? -1 : 0}
            type="button"
          >
            <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
          </button>
        )}

        {!narrow && (
          <IconButton
            disabled={!canGoForward}
            hidden={hidden}
            label="Next track"
            onClick={onNext}
            glyph="›"
          />
        )}

        {/* Two different acts, so two controls. */}
        {canFavourite && !narrow && (
          <IconButton
            active={faved}
            hidden={hidden}
            label={faved ? `Remove ${track.title} from your library` : `Save ${track.title} to your library`}
            onClick={onToggleFav}
            pressed={faved}
            glyph={faved ? '♥' : '♡'}
          />
        )}

        {/* No HYPE on a phone. `PlayerPill.jsx` gates it `canHype && !compact
            && !narrow`: at 393px the bar is search, artwork, title and play,
            and HYPE is reachable from the track and artist pages. */}
        {canHype && !narrow && (
          <button
            aria-label={
              hypeLocked
                ? `Already hyped ${track.artist}${hypeLabel ? `. Available again in ${hypeLabel}` : ''}`
                : `HYPE ${track.artist}`
            }
            aria-pressed={hyped}
            className="mmm-player-hype"
            data-hyped={hyped || undefined}
            data-locked={hypeLocked || undefined}
            disabled={hypeLocked}
            onClick={onToggleHype}
            tabIndex={hidden ? -1 : 0}
            type="button"
          >
            {/* The bolt from the mark, drawn as SVG. The obvious glyph is an
                emoji and the design system does not use emoji. */}
            <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 12 16" width="10">
              <path d="M7 0 0 9h4l-1 7 8-9.5H6.5L7 0Z" fill="currentColor" />
            </svg>
            {/* Always the word HYPE. The wait sits BESIDE it, never replacing
                it — a control that renames itself stops being the same control. */}
            <span>HYPE</span>
            {hypeLocked && hypeLabel ? <span className="mmm-player-hype-wait">{hypeLabel}</span> : null}
            {!hypeLocked && hypeCount !== undefined ? (
              <span className="mmm-player-hype-count">{hypeCount}</span>
            ) : null}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Click-to-seek. A range input rather than a div with pointer maths: it is
 * keyboard-operable and screen-reader-labelled for free, which a hand-rolled
 * bar is not, and the product ships an accessibility settings page.
 */
function Track({
  accent,
  label,
  onChange,
  value,
  width,
}: {
  accent?: boolean;
  label: string;
  onChange: (value: number) => void;
  value: number;
  width?: number;
}) {
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <input
      aria-label={label}
      className="mmm-player-range"
      data-accent={accent || undefined}
      max={100}
      min={0}
      onChange={(event) => onChange(Number(event.target.value))}
      step={1}
      style={{
        // A percentage-stop gradient rather than a second element, so the fill
        // cannot drift from the thumb.
        ['--fill' as string]: `${clamped}%`,
        ...(width ? { flex: `0 0 ${width}px`, width } : { flex: 1, minWidth: 0 }),
      }}
      type="range"
      value={clamped}
    />
  );
}

function IconButton({
  active,
  disabled,
  glyph,
  hidden,
  label,
  onClick,
  pressed,
}: {
  active?: boolean;
  disabled?: boolean;
  glyph: string;
  hidden: boolean;
  label: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      className="mmm-player-icon"
      data-active={active || undefined}
      disabled={disabled}
      onClick={onClick}
      tabIndex={hidden ? -1 : 0}
      type="button"
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}

/**
 * Scrolls only when the text overflows — a marquee on a short title is motion
 * for its own sake.
 *
 * Measures the FIRST copy, not the strip: the duplicate only exists once
 * `over` is already true, so halving `scrollWidth` on the first pass halves a
 * single copy and concludes nothing ever overflows. That is the bug the design
 * system's own implementation carries a comment about.
 *
 * `ih-marquee` is the one animation the shell keeps (SHELL_LOCK bans keyframed
 * reveals, because an unadvanced document timeline holds a from-state forever).
 * This one is safe: its from-state is the readable one and it never fills.
 */
function Marquee({ className, text }: { className: string; text: string }) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const w = wrap.current;
    const i = inner.current;
    if (!w || !i) return;
    const first = i.firstElementChild as HTMLElement | null;
    const one = first ? first.scrollWidth : i.scrollWidth;
    setOver(one > w.clientWidth + 1);
  }, [text]);

  // Duration scales with length so long and short titles travel at one speed.
  const duration = Math.max(6, text.length * 0.34);

  return (
    <div className={className} data-over={over || undefined} ref={wrap}>
      <div
        data-ih-marquee={over ? '' : undefined}
        ref={inner}
        style={over ? { animationDuration: `${duration}s` } : undefined}
      >
        <span>{text}</span>
        {over ? <span aria-hidden="true">{text}</span> : null}
      </div>
    </div>
  );
}
