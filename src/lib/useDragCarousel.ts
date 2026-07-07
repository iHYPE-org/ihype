'use client';

import { useEffect, useRef, useState } from 'react';
import { resolveDragCommit } from '@/lib/mobileShell';

/**
 * Real-time drag-follow for MobileAppShell's 3-section carousel: tracks
 * horizontal finger movement continuously (not just start/end deltas like
 * useSwipeRouteNav, which this replaces) so the track visibly slides with
 * the touch, then on release either commits to the neighboring section
 * (with wraparound handled by the caller) or snaps back.
 */
export function useDragCarousel(enabled: boolean, onCommit: (direction: 'next' | 'prev') => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragPx, setDragPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragPxRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!enabled || !el) return;

    let startX: number | null = null;
    let startY: number | null = null;
    let axis: 'x' | 'y' | null = null;

    function onTouchStart(e: TouchEvent) {
      // Only arm the cross-section swipe while a section's quick-access grid
      // is showing. Once a sub-tab is open (e.g. Listen > Charts), leave
      // touch handling to that tab's own content — most just scroll, and
      // Seeds' card deck already owns a horizontal drag gesture of its own
      // (via Pointer Events + touch-action:none, unaffected by this either
      // way) that a competing section-swipe would otherwise fight with.
      const target = e.target as HTMLElement | null;
      if (target?.closest('.mqg-content:not(.is-hidden)')) {
        startX = null;
        startY = null;
        axis = null;
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      axis = null;
      setDragging(true);
    }
    function onTouchMove(e: TouchEvent) {
      if (startX === null || startY === null) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (axis === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (axis === 'x') {
        e.preventDefault();
        dragPxRef.current = dx;
        setDragPx(dx);
      }
    }
    function onTouchEnd() {
      if (startX === null) return;
      const finalDx = dragPxRef.current;
      const width = el?.getBoundingClientRect().width ?? 0;
      const commit = axis === 'x' ? resolveDragCommit(finalDx, width) : null;
      startX = null;
      startY = null;
      axis = null;
      dragPxRef.current = 0;
      setDragging(false);
      setDragPx(0);
      if (commit) onCommit(commit);
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, onCommit]);

  return { containerRef, dragPx, dragging };
}
