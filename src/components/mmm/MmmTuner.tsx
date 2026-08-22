'use client';

import { useEffect, useRef } from 'react';
import { TunerDial } from '@/components/ds/TunerDial';

/**
 * The design system's `TunerDial`, wrapped — never forked.
 *
 * `src/components/ds/TunerDial.tsx` is generated from the handoff and is
 * reverted by the next `npm run vendor:ds`, so everything this app knows and
 * the design system does not has to live outside it. Two such things, and both
 * were found by driving the built page rather than by reading it:
 *
 *  1. **The wheel gesture needs a non-passive listener.** The vendored dial
 *     calls `preventDefault()` inside React's `onWheel`, and React attaches
 *     wheel listeners passively — so the call does nothing, and the page scrolls
 *     out from under the gesture while the dial tunes. A native listener bound
 *     here with `{ passive: false }` is what makes the vendored handler's intent
 *     actually hold. It only prevents the default; the stepping stays the
 *     component's.
 *  2. **The dial needs to say WHICH sections.** The vendored dial hardcodes
 *     `aria-label="Sections"`, which is the same announcement on a profile, on
 *     MUSIC and on ME. The label is set on the mounted node here, after render,
 *     for the same reason: the attribute belongs to the design system's own
 *     element and cannot be passed in.
 *
 * Both are deliberately additive. If the design system grows either, this
 * wrapper gets shorter and nothing else changes.
 */
export function MmmTuner({
  active,
  label,
  onSelect,
  stations,
}: {
  active: string;
  label: string;
  onSelect: (id: string) => void;
  stations: readonly { id: string; label: string }[];
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dial = mountRef.current?.querySelector<HTMLElement>('.tuner-dial');
    if (!dial) return undefined;
    const onWheel = (event: WheelEvent) => event.preventDefault();
    dial.addEventListener('wheel', onWheel, { passive: false });
    return () => dial.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const dial = mountRef.current?.querySelector<HTMLElement>('.tuner-dial');
    if (dial) dial.setAttribute('aria-label', label);
  }, [label]);

  return (
    <div className="mmm-tuner-mount" ref={mountRef}>
      <TunerDial
        active={active}
        onChange={onSelect}
        stations={stations as { id: string; label: string }[]}
      />
    </div>
  );
}
