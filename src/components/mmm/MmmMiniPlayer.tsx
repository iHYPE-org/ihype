'use client';

import { useCallback, useRef, useState } from 'react';
import type { MmmPlayerTrack } from '@/components/mmm/MmmPlayer';

/**
 * The phone player: one button, the size and shape of the logo trigger, on the
 * opposite corner.
 *
 * What it replaces was a 56px pill stretching from the trigger to the right
 * inset with its body hidden — the title and artist were `display: none` at
 * this width, so the pill spent the full width of a phone showing four small
 * controls and no information. This shows the artwork of what is playing and
 * puts the controls in gestures, which is the trade the design asked for.
 *
 * The gestures, and why each one is the one it is:
 *
 *   tap            play/pause — the thing you do most, on the largest target
 *   drag left      previous, drag right next — direction matches the transport
 *   press-hold     HYPE, because it is the one irreversible action here and a
 *                  hold is the only gesture you cannot perform by accident
 *   drag up        the full player, matching every sheet in the app
 *
 * A hold has no affordance of its own, so the ring around the button fills as
 * you hold and completes at the moment it fires. Without it a long-press is
 * invisible until it happens, which teaches nobody.
 *
 * HYPE is once per artist per 24 hours (`src/lib/hype-window.ts`). When the
 * window is open the hold does not fire and the ring does not fill — it says
 * when instead, because a control that refuses without saying why reads as
 * broken. Nothing here can un-hype: the window is a spend, not a toggle.
 */

const HOLD_MS = 460;
/** Past this, a drag is a direction rather than a tap that wobbled. */
const SWIPE_PX = 40;
const PULL_UP_PX = 64;
/** Below this, the pointer has not moved enough to cancel the hold. */
const SLOP_PX = 8;

type Hint = null | 'prev' | 'next' | 'expand';

export function MmmMiniPlayer({
  canGoBack,
  canGoForward,
  canHype,
  canTogglePlay,
  hidden,
  hyped,
  hypeLabel,
  hypeLocked,
  onExpand,
  onNext,
  onPrev,
  onToggleHype,
  onTogglePlay,
  playing,
  track,
}: {
  canGoBack: boolean;
  canGoForward: boolean;
  canHype: boolean;
  canTogglePlay: boolean;
  hidden?: boolean;
  hyped: boolean;
  /** Remaining wait, already formatted — "7h", "40m". */
  hypeLabel?: string;
  hypeLocked?: boolean;
  onExpand: () => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleHype: () => void;
  onTogglePlay: () => void;
  playing: boolean;
  track: MmmPlayerTrack | null;
}) {
  const [hint, setHint] = useState<Hint>(null);
  const [holding, setHolding] = useState(false);
  const [burst, setBurst] = useState(0);
  const [refused, setRefused] = useState(false);

  const ref = useRef<HTMLButtonElement | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const held = useRef(false);
  const dragging = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hypeAvailable = canHype && !hypeLocked && !hyped;

  const settle = useCallback(() => {
    dragging.current = false;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHolding(false);
    setHint(null);
    const el = ref.current;
    if (el) {
      el.style.transition = '';
      el.style.transform = '';
    }
  }, []);

  const fireHype = useCallback(() => {
    held.current = true;
    settle();
    if (!canHype) return;
    if (!hypeAvailable) {
      // Say when, never just refuse. `hypeLabel` is the remaining wait.
      setRefused(true);
      window.setTimeout(() => setRefused(false), 1600);
      return;
    }
    setBurst((n) => n + 1);
    // A hype is a real spend, so it gets the one haptic in this component.
    navigator.vibrate?.(18);
    onToggleHype();
  }, [canHype, hypeAvailable, onToggleHype, settle]);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!track) return;
    ref.current?.setPointerCapture(event.pointerId);
    origin.current = { x: event.clientX, y: event.clientY };
    held.current = false;
    dragging.current = true;
    // The ring only fills when the hold can actually do something.
    if (hypeAvailable) setHolding(true);
    holdTimer.current = setTimeout(fireHype, HOLD_MS);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging.current || held.current) return;
    const dx = event.clientX - origin.current.x;
    const dy = event.clientY - origin.current.y;

    if (Math.abs(dx) > SLOP_PX || Math.abs(dy) > SLOP_PX) {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      setHolding(false);
    }

    const el = ref.current;
    if (el) {
      // Follows the finger at a fraction, so the control still reads as
      // anchored to its corner rather than being dragged off it.
      el.style.transition = 'none';
      el.style.transform = `translate(${dx * 0.55}px, ${Math.min(0, dy) * 0.55}px)`;
    }

    if (dy < -PULL_UP_PX / 2) setHint('expand');
    else if (dx < -SWIPE_PX / 2 && canGoBack) setHint('prev');
    else if (dx > SWIPE_PX / 2 && canGoForward) setHint('next');
    else setHint(null);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return;
    const dx = event.clientX - origin.current.x;
    const dy = event.clientY - origin.current.y;
    const wasHeld = held.current;
    settle();
    if (wasHeld) return; // the hold already resolved this gesture

    if (dy < -PULL_UP_PX) onExpand();
    else if (dx < -SWIPE_PX) { if (canGoBack) onPrev(); }
    else if (dx > SWIPE_PX) { if (canGoForward) onNext(); }
    else if (canTogglePlay) onTogglePlay();
  };

  // A gesture-only control is not a control. Every gesture has a key.
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (canTogglePlay) onTogglePlay();
    } else if (event.key === 'ArrowLeft' && canGoBack) onPrev();
    else if (event.key === 'ArrowRight' && canGoForward) onNext();
    else if (event.key === 'ArrowUp') onExpand();
    else if (event.key.toLowerCase() === 'h') fireHype();
  };

  if (!track) return null;

  const hintText =
    hint === 'expand' ? 'Full player' :
    hint === 'prev' ? 'Previous' :
    hint === 'next' ? 'Next' :
    refused ? (hypeLabel ? `Hyped · again in ${hypeLabel}` : 'Already hyped') :
    null;

  return (
    <>
      {hintText ? (
        <span aria-hidden="true" className="mmm-mini-hint" data-refused={refused || undefined}>
          {hintText}
        </span>
      ) : null}

      <button
        aria-label={
          `${playing ? 'Pause' : 'Play'} ${track.title} by ${track.artist}.` +
          ' Left and right arrows change track, up arrow opens the full player' +
          (canHype ? `, H hypes ${track.artist}` : '') +
          '.'
        }
        className="mmm-mini"
        data-burst={burst || undefined}
        data-holding={holding || undefined}
        data-hyped={hyped || undefined}
        data-playing={playing || undefined}
        hidden={hidden}
        key={burst /* restarts the burst animation on a repeat hype */}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={onKeyDown}
        onPointerCancel={settle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={ref}
        tabIndex={hidden ? -1 : 0}
        type="button"
      >
        <span aria-hidden="true" className="mmm-mini-ring" />
        <span aria-hidden="true" className="mmm-mini-art">
          {track.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- artwork is
            // an arbitrary remote storage URL; next/image would proxy every
            // track through the optimizer for a 56px square.
            <img alt="" src={track.artworkUrl} />
          ) : (
            <span className="mmm-mini-initial">{track.initial}</span>
          )}
        </span>
        <span aria-hidden="true" className="mmm-mini-glyph">
          {playing ? (
            <svg fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
            </svg>
          ) : (
            <svg fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
              <path d="M8 5l12 7-12 7z" />
            </svg>
          )}
        </span>
        {/* The bolt from the mark, same glyph the pill's HYPE button uses. */}
        <span aria-hidden="true" className="mmm-mini-burst">
          {Array.from({ length: 10 }, (_, index) => (
            <i key={index} style={{ ['--i' as string]: index }} />
          ))}
        </span>
      </button>
    </>
  );
}
