'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  ARC,
  ARC_NARROW_MAX_WIDTH,
  MMM_NAV,
  arcTransform,
  type MmmModuleId,
} from '@/lib/mmm-nav';

/**
 * The radial arc nav, from the app-shell redesign.
 *
 * The logo and every fan item share one origin — a zero-size anchor at the
 * frame's lower left — and are moved into place by `transform` alone. Closed,
 * every item sits tucked behind the logo at `translate(14px,-6px) scale(.55)`
 * with `opacity: 0` and `pointer-events: none`; open, each animates to its slot
 * on the arc. Because nothing here changes layout, the whole fan-out is a
 * compositor animation.
 *
 * Three things are load-bearing:
 *
 *   - **Only MUSIC has a submenu.** MAP and ME navigate directly. The earlier
 *     seven-item ME fan-out is gone, which also retires
 *     `FRONTEND_GOTCHAS.md` §4 (a wrapping submenu clipped by an ancestor's
 *     overflow) — there is no wrapping submenu left to clip.
 *   - **The transform and delay are computed per index** from the ARC table and
 *     passed inline. §5 is the reason: the prototype routed the delay through an
 *     `--nd` custom property that was never declared, and an undefined custom
 *     property invalidates the whole declaration silently, so every item
 *     animated at once with no warning.
 *   - **A closed item is not tabbable.** `pointer-events: none` hides it from
 *     the mouse but not from the keyboard, so `tabIndex`/`aria-hidden` do the
 *     rest — otherwise five invisible buttons sit in the tab order.
 */
export function MmmNav({
  activeItemId,
  activeModule,
  onClose,
  onSection,
  open,
  section,
}: {
  activeItemId: string | null;
  activeModule: MmmModuleId;
  onClose: () => void;
  onSection: (section: MmmModuleId | 'root') => void;
  open: boolean;
  /** 'root' shows level 1; 'music' shows its five-item arc. */
  section: MmmModuleId | 'root';
}) {
  const router = useRouter();
  const arc = useArcBreakpoint();

  // Escape steps back a level, then closes — matching the back-chip behaviour
  // the earlier design had a visible chip for.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (section === 'root') onClose();
      else onSection('root');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, onSection, open, section]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const subOpen = open && section === 'music';
  const level1 = ARC[arc].level1;
  const level2 = ARC[arc].level2;
  const musicItems = MMM_NAV.find((module) => module.id === 'music')!.items;

  return (
    <>
      {open && <button aria-label="Close navigation" className="mmm-nav-scrim" onClick={onClose} type="button" />}

      <div className="mmm-nav-anchor" data-open={open} data-sub={subOpen}>
        {/* Level 2 renders under level 1 in the DOM so the logo and the primary
            pills stay on top when both are mid-transition. */}
        {musicItems.map((item, index) => {
          const slot = level2[index];
          if (!slot) return null;
          const shown = subOpen;
          return (
            <button
              aria-current={item.id === activeItemId && activeModule === 'music' ? 'page' : undefined}
              aria-hidden={!shown}
              className="mmm-ray mmm-nav-item"
              key={item.id}
              onClick={() => go(item.href)}
              style={{
                ...(shown ? { transform: arcTransform(slot), opacity: 1, pointerEvents: 'auto' } : null),
                transitionDelay: shown ? `${slot.delayMs}ms` : '0ms',
              } as CSSProperties}
              tabIndex={shown ? 0 : -1}
              type="button"
            >
              {item.label}
            </button>
          );
        })}

        {MMM_NAV.map((module, index) => {
          const slot = level1[index];
          // Level 1 hides while the MUSIC submenu is out, so the two fans never
          // occupy the frame together.
          const shown = open && !subOpen;
          return (
            <button
              aria-current={module.id === activeModule ? 'page' : undefined}
              aria-expanded={module.items.length ? subOpen && module.id === 'music' : undefined}
              aria-hidden={!shown}
              className="mmm-ray mmm-nav-pill"
              key={module.id}
              onClick={() => (module.items.length ? onSection(module.id) : go(module.href))}
              style={{
                ...(shown ? { transform: arcTransform(slot), opacity: 1, pointerEvents: 'auto' } : null),
                transitionDelay: shown ? `${slot.delayMs}ms` : '0ms',
              } as CSSProperties}
              tabIndex={shown ? 0 : -1}
              type="button"
            >
              {module.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

/**
 * Which arc table to use. The design switches coordinates at 720px, and the
 * two tables are not a scale of one another — they are separately hand-placed —
 * so this has to be a real media-query subscription rather than a CSS override.
 * Starts at 'wide' and corrects after mount: server and first client render
 * must agree, and there is no viewport width on the server.
 */
function useArcBreakpoint(): 'wide' | 'narrow' {
  const [arc, setArc] = useState<'wide' | 'narrow'>('wide');
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${ARC_NARROW_MAX_WIDTH}px)`);
    const update = () => setArc(query.matches ? 'narrow' : 'wide');
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return arc;
}
