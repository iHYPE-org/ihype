'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export const SWIPE_ROUTE_ORDER = ['/listen', '/shows', '/pages'];

/**
 * Pure decision logic, split out so it's unit-testable without a DOM —
 * given the current path and a completed swipe's delta, returns the route
 * to navigate to, or null if the swipe shouldn't trigger navigation
 * (too short, more vertical than horizontal, off the end of the list, or
 * not currently on one of the three swipeable pages).
 */
export function resolveSwipeTarget(pathname: string, dx: number, dy: number): string | null {
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  const idx = SWIPE_ROUTE_ORDER.indexOf(pathname);
  if (idx === -1) return null;
  const nextIdx = dx < 0 ? idx + 1 : idx - 1;
  if (nextIdx < 0 || nextIdx >= SWIPE_ROUTE_ORDER.length) return null;
  return SWIPE_ROUTE_ORDER[nextIdx];
}

/**
 * Swipe left/right to move between the three main mobile nav destinations,
 * mirroring the bottom nav order. Only wired up while `enabled` (the quick
 * -access grid, not a tab's own content — several tabs, like Seeds, already
 * use a horizontal drag gesture of their own).
 */
export function useSwipeRouteNav(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;

    let startX: number | null = null;
    let startY: number | null = null;

    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
    function onTouchEnd(e: TouchEvent) {
      if (startX === null || startY === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      startX = null;
      startY = null;
      const target = resolveSwipeTarget(pathname, dx, dy);
      if (target) router.push(target);
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled, pathname, router]);

  return ref;
}
