'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The slide-rule tuning dial, as a section switcher.
 *
 * ## Why this replaces a tab strip
 *
 * A horizontal tab strip costs a full row at the top of the page and gets
 * *narrower* per tab as you add tabs — which is why every strip in this
 * codebase had drifted down to 10-13px labels, and why the two tabs that did
 * not fit 393px were simply off the edge. The dial spends the SAME row on one
 * destination set large: the engraved station name is 1.625rem (26px), roughly
 * double what a six-tab strip could afford, and it does not shrink when a
 * seventh section is added because only one is ever shown.
 *
 * That is the whole trade: a strip shows you every option and can name none of
 * them legibly; the dial names one at a reading size and moves.
 *
 * ## Why the scale can be infinite for free
 *
 * The graduations are two `repeating-linear-gradient`s whose horizontal
 * `background-position` is driven by the drag. A repeating gradient has no
 * end, so the scale runs forever in both directions with no cloned strip to
 * keep in sync and no seam to hide. Stations wrap: past the last is the first,
 * in either direction, which is what a receiver's dial actually does.
 *
 * ## The accessibility model, and why it is a tablist and not a slider
 *
 * The prototype used `role="slider"`, which is right for a value and wrong for
 * navigation — a screen reader would announce a number where a member needs a
 * destination. This renders a real `role="tablist"` of real `role="tab"`
 * buttons with **roving tabindex**: exactly one tab is in the tab order and
 * arrow keys move between them. That is the standard tabs pattern, and it
 * happens to describe the dial exactly — one station is current, the arrows
 * tune. So the semantics and the visual are the same model rather than two
 * controls layered on each other.
 *
 * Only the current tab is visible, which is consistent: with roving tabindex
 * only the current tab was ever tabbable. Pointer users get drag, wheel, and
 * the two step buttons.
 */
export type TunerStop = { id: string; label: string };

/** px of drag per station — matches the major graduation spacing in CSS. */
const PITCH = 46;

const wrap = (i: number, n: number) => ((i % n) + n) % n;

export function TunerDial({
  stops,
  active,
  label,
  onSelect,
}: {
  stops: readonly TunerStop[];
  active: string;
  label: string;
  onSelect: (id: string) => void;
}) {
  const activeIndex = Math.max(0, stops.findIndex((s) => s.id === active));
  const dialRef = useRef<HTMLDivElement>(null);
  const ticksRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /* The dial's own position, in "stations", kept across laps. It is a REF and
     not state on purpose: it changes on every pointermove, and re-rendering
     React 60 times a second to move a background-position is the wrong tool.
     The scale is painted imperatively; only the selection is state. */
  const offset = useRef(activeIndex * PITCH);
  const [tuning, setTuning] = useState(false);

  const paint = useCallback((pos: number) => {
    const ticks = ticksRef.current;
    if (!ticks) return;
    const px = `${-pos * PITCH}px`;
    ticks.style.backgroundPositionX = `${px}, ${px}`;
  }, []);

  /* Keep the scale under the needle when the section changes from OUTSIDE the
     dial — a link into `?tab=merch`, a back button. Without this the engraved
     name and the graduations disagree, which is the one thing a physical dial
     cannot do. Re-homed to the nearest equivalent station on the current lap
     so arriving by link does not spin the scale through six turns. */
  useEffect(() => {
    const laps = Math.round((offset.current / PITCH - activeIndex) / stops.length);
    offset.current = (activeIndex + laps * stops.length) * PITCH;
    paint(offset.current / PITCH);
  }, [activeIndex, stops.length, paint]);

  const settle = useCallback((next: number) => {
    const id = stops[wrap(Math.round(next), stops.length)]?.id;
    if (id && id !== active) onSelect(id);
  }, [stops, active, onSelect]);

  /* A NATIVE wheel listener, not React's `onWheel`.
     Two reasons, and the first is simply that the synthetic one did not fire
     here — verified by driving the built page, not by reading. The second is
     that React attaches wheel listeners passively, so a synthetic handler
     cannot `preventDefault`, and without that the page scrolls away under the
     gesture while the dial tunes. `stepRef` keeps the listener stable so it is
     bound once rather than re-bound on every selection change. */
  const stepRef = useRef<(by: number) => void>(() => {});
  useEffect(() => {
    const el = dialRef.current;
    if (!el) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      stepRef.current(event.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function step(by: number) {
    offset.current += by * PITCH;
    paint(offset.current / PITCH);
    settle(offset.current / PITCH);
  }
  stepRef.current = step;

  /* Set only by the keyboard handler, so arriving at a section by link or by
     drag never yanks focus out from under the reader. */
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    tabRefs.current[activeIndex]?.focus();
  }, [activeIndex]);

  const drag = useRef<{ x: number; from: number } | null>(null);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    /* No "is the target a button" guard here, and that was a real bug: the
       engraved station IS a button and it covers most of the dial face, so
       guarding on it made the majority of the control undraggable while
       looking, in the source, like it protected something. The step buttons
       are siblings OUTSIDE the dial, so nothing inside needs protecting —
       and clicking the current station is a no-op step(0) anyway. */
    drag.current = { x: event.clientX, from: offset.current };
    setTuning(true);
    dialRef.current?.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    // No clamp: dragging past the last station comes back round to the first,
    // the way a tuning scale runs past its end.
    offset.current = drag.current.from - (event.clientX - drag.current.x);
    const pos = offset.current / PITCH;
    paint(pos);
    settle(pos);
  }

  function endDrag() {
    if (!drag.current) return;
    drag.current = null;
    setTuning(false);
    // Snap to the nearest graduation, keeping whichever lap we are on.
    offset.current = Math.round(offset.current / PITCH) * PITCH;
    paint(offset.current / PITCH);
    settle(offset.current / PITCH);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = {
      ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1,
    };
    let next: number | null = null;
    if (event.key in moves) next = wrap(activeIndex + moves[event.key], stops.length);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = stops.length - 1;
    else return;
    event.preventDefault();
    /* Focus follows selection — but it CANNOT be moved here.
       Only the current station is `display: block`; the rest are `display:
       none`, and a hidden element cannot take focus. Focusing the next tab
       synchronously therefore failed silently and dropped focus to <body> on
       every single arrow press, which strands a keyboard user completely.
       Found by driving the built page and reading document.activeElement, not
       by reading the code — it looks correct.
       The effect below does it after the re-render, when the new station is
       actually visible. */
    refocus.current = true;
    step(next - activeIndex);
  }

  return (
    <div className="tuner-mount">
      <button
        aria-label={`Previous section in ${label}`}
        className="tuner-step"
        onClick={() => step(-1)}
        type="button"
      >
        ‹
      </button>

      <div
        aria-label={label}
        className={`tuner-dial${tuning ? ' is-tuning' : ''}`}
        onKeyDown={onKeyDown}
        onLostPointerCapture={endDrag}
        onPointerCancel={endDrag}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        ref={dialRef}
        role="tablist"
      >
        {/* Every stop is a real tab. Only the current one is painted — with
            roving tabindex it is also the only one in the tab order, so the
            visual and the keyboard model agree rather than merely coexist. */}
        {stops.map((stop, i) => (
          <button
            /* Only when current: the panels are rendered one at a time, and
               aria-controls pointing at an id that is not in the document is
               worse than not claiming a relationship at all. */
            aria-controls={i === activeIndex ? `tunerpanel-${stop.id}` : undefined}
            aria-selected={i === activeIndex}
            className="tuner-station"
            data-current={i === activeIndex}
            id={`tunertab-${stop.id}`}
            key={stop.id}
            onClick={() => step(i - activeIndex)}
            ref={(el) => { tabRefs.current[i] = el; }}
            role="tab"
            tabIndex={i === activeIndex ? 0 : -1}
            type="button"
          >
            {stop.label}
          </button>
        ))}

        <span aria-hidden="true" className="tuner-scale">
          <span className="tuner-ticks" ref={ticksRef} />
          <span className="tuner-needle" />
        </span>
      </div>

      <button
        aria-label={`Next section in ${label}`}
        className="tuner-step"
        onClick={() => step(1)}
        type="button"
      >
        ›
      </button>
    </div>
  );
}
