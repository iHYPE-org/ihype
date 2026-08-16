'use client';

import Link from 'next/link';
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
  artistOpen = false,
  canFavourite,
  canHype,
  canTogglePlay,
  canGoBack,
  canGoForward,
  faved,
  hidden,
  history = [],
  hypeCount,
  hypeLabel,
  hypeLocked,
  hyped,
  idleMs = 10000,
  narrow,
  onExpand,
  onNext,
  onPickTrack,
  onPrev,
  onOpenAlbum,
  onOpenArtist,
  onSearch,
  onSeek,
  onToggleFav,
  onToggleHype,
  onTogglePlay,
  onToggleQueue,
  onVolume,
  playing,
  progress,
  queue = [],
  queueOpen = false,
  track,
  volume,
  wake = 0,
}: {
  anchorHeight?: number;
  /**
   * The artist highlight is open for this track. Marks the artist name as the
   * active target and, with the queue, holds the pill awake — retiring to a
   * 56px disc while a 340px dialog points at it leaves the dialog anchored to
   * nothing.
   */
  artistOpen?: boolean;
  canFavourite: boolean;
  canHype: boolean;
  canTogglePlay: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  faved: boolean;
  hidden: boolean;
  /** Already played, most recent first. See `queue`. */
  history?: MmmPlayerTrack[];
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
  /**
   * Phone only: the artwork opens the full-screen player. Omitted, the artwork
   * is not a button — an inert control is worse than none, and until this
   * existed the phone bar had no route to seek, volume, the heart or the queue
   * at all.
   */
  onExpand?: () => void;
  onNext: () => void;
  /**
   * Jump to a row in the queue panel. `list` says which half it came from, so
   * the caller can resolve it against the one array both halves are cut from.
   */
  onPickTrack?: (track: MmmPlayerTrack, list: 'queue' | 'history', index: number) => void;
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
  /**
   * Phone only, per `PlayerPill`: search rides at the bar's left edge. Omitted,
   * it is not drawn — a search control with nowhere to go is worse than none.
   */
  onSearch?: () => void;
  onToggleFav: () => void;
  onToggleHype: () => void;
  onTogglePlay: () => void;
  /** Omitted, the queue control is not drawn. */
  onToggleQueue?: () => void;
  onVolume: (value: number) => void;
  playing: boolean;
  /** 0–100. */
  progress: number;
  /**
   * What follows the current track. Queue and history are ONE list split at the
   * current index — "up next" is what follows, "played" is what precedes — so
   * both of these are cut from the same array by the caller. Two independently
   * maintained arrays drift apart.
   */
  queue?: MmmPlayerTrack[];
  queueOpen?: boolean;
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
    // An open queue or artist panel holds the pill awake. Both are anchored to
    // the pill's box, so retiring to a 56px disc underneath them would leave a
    // 340px dialog pointing at nothing — the design system's own guard.
    if (narrow || hidden || !awake || queueOpen || artistOpen) return undefined;
    const timer = window.setTimeout(() => setAwake(false), idleMs);
    return () => window.clearTimeout(timer);
    // Every value that means "something is happening" restarts the countdown.
  }, [artistOpen, awake, hidden, idleMs, narrow, playing, progress, queueOpen, volume, hyped, faved, track?.title]);

  /**
   * Idle. The bar stays docked with nothing loaded — explicit product decision,
   * 2026-08-16, and a DEPARTURE from the design source. Do not "correct" it.
   *
   * `PlayerPill.d.ts` documents `track: null` as "renders nothing — never
   * invent a placeholder track", and `PlayerPill.jsx:199` returns null. That
   * rule is kept where it actually bites: nothing below fabricates a title, an
   * artist, artwork, a duration or a progress position, and there are no
   * transport controls, because there is genuinely nothing to transport. An
   * idle bar states that it is idle; a placeholder track would claim something
   * false, and those are different things.
   *
   * What returning null cost: `SHELL_LOCK` opens by describing the trigger and
   * the player as the same height on the same baseline, "one piece of
   * furniture" bottom-left. On a platform with no playable audio yet — which is
   * every pre-launch environment — half that furniture was simply missing, so
   * the shell read as broken chrome rather than as an empty library. It was
   * reported that way twice.
   *
   * `PlayerPill.jsx` should gain this state in Claude Design so the two stop
   * disagreeing; until it does, this comment is the record of why they do.
   */
  if (!track) {
    if (hidden) return null;
    const idleArt = narrow ? 40 : Math.max(40, anchorHeight - 24);
    return (
      <div
        className="mmm-player"
        data-idle=""
        ref={rootRef}
        style={{ minHeight: anchorHeight }}
      >
        <div
          aria-hidden="true"
          className="mmm-player-art"
          data-empty=""
          style={{ width: idleArt, height: idleArt, borderRadius: narrow ? 14 : Math.round(idleArt * 0.342) }}
        >
          {/* A Unicode glyph, not an emoji — DS8 §29. It takes `currentColor`,
              so it dims with the rest of the idle bar instead of shipping a
              second asset. */}
          ♪
        </div>
        <div className="mmm-player-body">
          <div className="mmm-player-idle-title">Nothing playing</div>
          {/* The one thing worth offering here is a way out of the empty state,
              so the bar is a route rather than a readout. */}
          <Link className="mmm-player-idle-link" href="/app/music/discover">
            Find something to play
          </Link>
        </div>
      </div>
    );
  }

  // 64 in an 88px pill leaves exactly 12px above and below, which is the pill's
  // own padding. On a phone the bar also carries search at its left edge, so the
  // artwork drops to the design's 40px with a 14px corner — a 64px square there
  // leaves the title about a word wide.
  const art = narrow ? 40 : Math.max(40, anchorHeight - 24);
  const artRadius = narrow ? 14 : Math.round(art * 0.342);
  /* Artist and release are separate destinations, so they are separate
     targets. One run of grey text that silently opens one of two different
     pages is the thing this replaces — and a name with no handler stays plain
     text rather than becoming a target that goes nowhere. */
  const nameLink = (text: string, onClick?: () => void, active?: boolean) =>
    onClick
      ? (
        <button className="mmm-player-name" data-active={active || undefined} onClick={onClick} type="button">
          {text}
        </button>
      )
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
    <>
      {/* A SIBLING of the pill, never a child: the pill is a capsule with
          `overflow: hidden` and a 9999px radius, so a 320px panel nested inside
          it is clipped to a curve. Wide screens only — on a phone the same list
          is in the full player, which has room to show it. */}
      {queueOpen && !hidden && !narrow && (
        <div aria-label="Queue and history" className="mmm-player-queue" role="dialog">
          <p className="mmm-queue-eyebrow">Now playing</p>
          <div className="mmm-queue-now">
            <span aria-hidden="true" className="mmm-queue-now-bar" />
            <span className="mmm-queue-now-body">
              <span className="mmm-queue-now-title">{track.title}</span>
              <span className="mmm-queue-now-meta">
                {[track.artist, track.album].filter(Boolean).join(' · ')}
              </span>
            </span>
          </div>

          {queue.length > 0 && <p className="mmm-queue-eyebrow">Up next</p>}
          {queue.map((item, position) => (
            <button
              className="mmm-queue-row"
              key={`q${position}-${item.title}`}
              onClick={() => onPickTrack?.(item, 'queue', position)}
              type="button"
            >
              <span className="mmm-queue-index">{String(position + 1).padStart(2, '0')}</span>
              <span className="mmm-queue-title">{item.title}</span>
              <span className="mmm-queue-artist">{item.artist}</span>
            </button>
          ))}

          {/* Played sits below a rule and greyed: already heard, still
              reachable. Same list, cut at the current index. */}
          {history.length > 0 && (
            <div className="mmm-queue-played">
              <p className="mmm-queue-eyebrow">Played</p>
              {history.map((item, position) => (
                <button
                  className="mmm-queue-row"
                  key={`h${position}-${item.title}`}
                  onClick={() => onPickTrack?.(item, 'history', position)}
                  type="button"
                >
                  <span aria-hidden="true" className="mmm-queue-index">·</span>
                  <span className="mmm-queue-title">{item.title}</span>
                  <span className="mmm-queue-artist">{item.artist}</span>
                </button>
              ))}
            </div>
          )}

          {queue.length === 0 && history.length === 0 && (
            <p className="mmm-queue-empty">Nothing queued. Play an album or a station to fill this.</p>
          )}
        </div>
      )}

    <div
      aria-hidden={hidden}
      className="mmm-player"
      data-hidden={hidden}
      onPointerDown={rouse}
      ref={rootRef}
      style={{ minHeight: anchorHeight }}
    >
      {/* Phone only: search rides at the bar's LEFT EDGE, divided off by a
          hairline so it plainly is not a transport control. Floating between
          the trigger and the bar it read as part of the nav trigger and cost
          the row the 52px the title needs. Omitted when there is nowhere to
          send it — a search button that does nothing is worse than none. */}
      {narrow && onSearch && (
        <button
          aria-label="Search artists, venues and shows"
          className="mmm-player-search"
          onClick={onSearch}
          type="button"
        >
          <svg aria-hidden="true" height={18} viewBox="0 0 24 24" width={18}>
            <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={1.9}>
              <circle cx={10.6} cy={10.6} r={6.4} />
              <path d="m15.4 15.4 4.3 4.3" />
            </g>
          </svg>
        </button>
      )}

      {/* On a phone the artwork IS the way into the full player — that is the
          design's own route to seek, volume, the heart and the queue, none of
          which fit in a 393px bar. With no handler it stays a plain div rather
          than becoming a button that does nothing. */}
      {narrow && onExpand ? (
        <button
          aria-label="Open the full player"
          className="mmm-player-art"
          data-expand=""
          onClick={onExpand}
          style={{ width: art, height: art, borderRadius: artRadius }}
          tabIndex={hidden ? -1 : 0}
          type="button"
        >
          {track.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- see below.
            <img alt="" height={art} src={track.artworkUrl} width={art} />
          ) : (
            <span aria-hidden="true">{track.initial}</span>
          )}
        </button>
      ) : (
        <div
          className="mmm-player-art"
          style={{ width: art, height: art, borderRadius: artRadius }}
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
      )}

      <div className="mmm-player-body">
        <Marquee className="mmm-player-track" text={track.title} />
        <div className="mmm-player-artist">
          {nameLink(track.artist, onOpenArtist, artistOpen)}
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

        {/* Wide only, same gate as the rest of the transport: on a phone the
            queue lives in the full player. */}
        {!narrow && onToggleQueue && (
          <IconButton
            active={queueOpen}
            hidden={hidden}
            label={queueOpen ? 'Close the queue' : 'Open the queue'}
            onClick={onToggleQueue}
            pressed={queueOpen}
            glyph="≡"
          />
        )}
      </div>
    </div>
    </>
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
