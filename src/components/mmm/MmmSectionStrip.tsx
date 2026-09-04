'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRegisteredStations } from '@/components/mmm/MmmStations';
import { MMM_NAV, moduleForPath, stationsForPath } from '@/lib/mmm-nav';

/**
 * A screen's own sections, drawn on the screen.
 *
 * ## This is the rule that reversed, and it reversed for a reason
 *
 * The console handoff forbade exactly this: "**one dial per screen, and it is
 * the dock's** — an in-page tab strip alongside it puts two identical-looking
 * dials on screen meaning different things." That was not theoretical. A
 * profile really did draw its own `TunerDial` ten pixels above the dock's, and
 * `PagesHome` shipped a pair that disagreed about where you were — the in-page
 * one read "Creator" while the dock's read "Info" (reported 2026-09-01 as
 * "duplicated nav").
 *
 * The MIDDLE ROAD (2026-09-04) retires the dial from the chrome. The hazard the
 * rule protected against is a consequence of a section control EXISTING in the
 * dock; with none there, a page drawing its own strip is the only way a member
 * can see their sections at all. **Before re-deriving the old rule from the old
 * reasoning, check whether the chrome still carries one. It does not** — see
 * `MmmDock.tsx`.
 *
 * ## Why this reads the same registry the dial did
 *
 * `MmmStations` is untouched, and so is every call site: `ProfileTabs`,
 * `PagesHome` and `MmmMe` register the same `{stations, active, onChange,
 * label}` they always did. Only the consumer moved. That is deliberate — those
 * three keep the state where the panels are (`?tab=` for a profile, so it is
 * shareable and Back walks it), and rewriting them to own a strip each would
 * have forked one contract into three and made this change unreviewable.
 *
 * Screens that register nothing fall back to `stationsForPath`, which is how
 * MUSIC gets its five tabs and MAP its three layers with no code of their own.
 *
 * ## Two things it refuses to draw
 *
 * A set of fewer than two: one pill is not a choice, it is a label that looks
 * tappable. And the empty set TICKETS returns — a strip there would have to
 * invent sections for a wallet.
 *
 * ## The objection the dial had to this, and what answers it
 *
 * The retired dial's own notes make a measured case against a strip: "a strip
 * divides one row by the number of tabs, so every strip in this codebase had
 * drifted to 10-13px labels and two of the artist profile's six started
 * off-screen at 393px." Both halves are real and both are answered here rather
 * than argued with. The labels do not shrink — they are a fixed 13px and the
 * row SCROLLS, so five sections at 375px overflow instead of compressing. And
 * an item off the right edge is only a bug if nothing says so, which is what
 * the two mechanisms below are for: the active section is scrolled into view on
 * arrival, and a row that actually overflows is masked at its RIGHT edge, so
 * the last visible pill fades rather than ending flush. (Right only — a left
 * fade would have to know the live scroll position, which means a scroll
 * listener on a row that is mostly not scrolled; the right edge is where the
 * unseen sections are on arrival, which is the moment that matters. And only
 * when it overflows, or the fade tells the same lie in reverse: a complete set
 * that looks cut off.) Do not remove either and leave
 * the scroll: a strip that hides sections silently is the failure the dial was
 * right about.
 */
export function MmmSectionStrip({
  variant = 'pane',
}: {
  /** `brass` is the map's: an engraved segmented control over the chart, where
   *  a translucent pane pill would be unreadable on printed ground. */
  variant?: 'pane' | 'brass';
}) {
  const registered = useRegisteredStations();
  const pathname = usePathname() ?? '';
  const params = useSearchParams();

  const fallback = stationsForPath(pathname, { layer: params?.get('layer') ?? null });
  const stations = registered?.stations ?? fallback.stations;
  const active = registered?.active ?? fallback.active;
  /* "Sections in MUSIC", not a bare "Sections": this is the strip's accessible
     name and a screen reader announces it before the pills, so it has to say
     which screen's sections these are. A registered set brings its own — a
     profile's is "Sections in Half Waif". */
  const label = registered?.label
    ?? `Sections in ${MMM_NAV.find((module) => module.id === moduleForPath(pathname))?.label ?? 'this screen'}`;

  /* Bring the lit section into view on arrival. A member landing on
     `?tab=merch` with Merch fourth of four would otherwise see three pills and
     no indication that the one they followed a link to exists. `nearest` and
     never `center`: on a set that already fits, centring scrolls a row that had
     no reason to move. */
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = stripRef.current?.querySelector<HTMLElement>('[data-on="true"]');
    node?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
  }, [active]);

  /* The edge fade is only honest when there IS more beyond the edge. Rendering
     it unconditionally fades the last pill of a set that fits, which says
     "truncated" about a complete strip — caught by rendering the real
     stylesheet, where the map's three layers fit easily and ARTISTS looked cut
     off. CSS cannot ask whether a box overflows, so the component measures and
     the stylesheet keys on the answer. Re-measured on resize because a desktop
     window is dragged and the map's three segments fit at every width while
     MUSIC's five stop fitting somewhere around 500px. */
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const node = stripRef.current;
    if (!node) return undefined;
    const measure = () => setOverflowing(node.scrollWidth - node.clientWidth > 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [stations]);

  if (stations.length < 2) return null;

  return (
    <div
      aria-label={label}
      className="mmm-strip"
      data-overflow={overflowing}
      data-variant={variant}
      ref={stripRef}
      role="tablist"
    >
      {stations.map((station) => {
        const on = station.id === active;
        /* Registered sets are STATE (a profile's `?tab=`, ME's panel) and get a
           button; the fallback sets are ROUTES and get a real link, so Back
           walks them. Same split the dial made, for the same reason. */
        if (registered) {
          return (
            <button
              aria-selected={on}
              className="mmm-strip-item"
              data-on={on}
              key={station.id}
              onClick={() => registered.onChange(station.id)}
              role="tab"
              type="button"
            >
              {station.label}
            </button>
          );
        }
        const href = (station as { href?: string }).href;
        return (
          <Link
            aria-selected={on}
            className="mmm-strip-item"
            data-on={on}
            href={href ?? pathname}
            key={station.id}
            role="tab"
          >
            {station.label}
          </Link>
        );
      })}
    </div>
  );
}
