'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMobileShell } from '@/lib/MobileShellContext';
import { useDragCarousel } from '@/lib/useDragCarousel';
import { acquireScrollLock } from '@/lib/scrollLock';
import { SHELL_SECTIONS, relativeSlotPosition } from '@/lib/mobileShell';
import { ListenHome } from '@/components/ListenHome';
import { EventsHome } from '@/components/EventsHome';
import { PagesHome } from '@/components/PagesHome';

const SLOT_COMPONENTS = {
  listen: ListenHome,
  shows: EventsHome,
  pages: PagesHome,
} as const;

/**
 * Persistent mobile "app shell": Listen/Events/Pages are always mounted
 * together (never unmounted on navigation, so each keeps its own scroll
 * position and in-progress state — search text, open playlist, seed deck
 * position, etc.) and swiping between them is a real-time drag-follow
 * transform, not a route change. Desktop is untouched (this whole
 * component renders display:none there via .mas-root's base CSS); on
 * mobile it visually replaces the routed page content for /listen,
 * /shows, /pages — see RouteShellSlot, which each of those 3 routes uses
 * to suppress its own copy while this shell is active.
 */
export function MobileAppShell() {
  const shell = useMobileShell();

  const handleCommit = useCallback(
    (direction: 'next' | 'prev') => {
      if (!shell) return;
      const idx = SHELL_SECTIONS.indexOf(shell.section);
      const len = SHELL_SECTIONS.length;
      const nextIdx = (idx + (direction === 'next' ? 1 : -1) + len) % len;
      shell.setSection(SHELL_SECTIONS[nextIdx]);
    },
    [shell]
  );

  const { containerRef, dragPx, dragging } = useDragCarousel(!!shell?.active, handleCommit);

  useEffect(() => {
    if (!shell?.active) return;
    return acquireScrollLock();
  }, [shell?.active]);

  // One-way latch: don't mount (and fetch-on-mount) Listen/Events/Pages until
  // the shell is actually needed, on ANY page of the site this component is
  // always present via the root layout. Once activated, keep them mounted
  // even after navigating away, so state/scroll position survives — only
  // reset by a hard reload.
  const [hasActivated, setHasActivated] = useState(false);
  useEffect(() => {
    if (shell?.active && !hasActivated) setHasActivated(true);
  }, [shell?.active, hasActivated]);

  if (!shell) return null;

  const activeIdx = SHELL_SECTIONS.indexOf(shell.section);

  return (
    <div className={`mas-root${shell.active ? ' is-active' : ''}`}>
      <div className="mas-track" ref={containerRef}>
        {hasActivated && SHELL_SECTIONS.map((section, i) => {
          const rel = relativeSlotPosition(i, activeIdx, SHELL_SECTIONS.length);
          const Component = SLOT_COMPONENTS[section];
          return (
            <div
              className="mas-slot"
              key={section}
              style={{
                transform: `translateX(calc(${rel * 100}% + ${dragPx}px))`,
                transition: dragging ? 'none' : 'transform .32s cubic-bezier(.22,1,.36,1)',
              }}
            >
              {/* Only the foreground section's own quick-access grid should ever be interactive/visible — see isForeground plumbing in each *Home component. */}
              <Component isShellForeground={section === shell.section} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
