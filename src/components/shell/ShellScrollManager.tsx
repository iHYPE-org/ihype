'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Scroll position across navigation, for the shell's content region.
 *
 * The chrome contract makes `.shell-content` the only scroll container, but
 * Next's scroll handling moves the *window* — which no longer scrolls. Without
 * this, scrolling halfway down Charts and opening Near Me lands you halfway
 * down a page you have never seen, on every navigation.
 *
 * It keys on the FULL url, not just the pathname. The context strip's siblings
 * — Discover/Radio/Charts/Playlists, Near Me/Recommended/My Tickets — differ
 * only by `?tab=`, so a pathname-keyed effect never fires for the most common
 * navigation in the whole shell. That was a real bug, caught by the e2e test
 * rather than by reading the code: the assertion expected 0 and got 141.
 *
 * Forward navigation goes to the top, or to the `#hash` target — the bell's
 * `/me/dashboard#notifications` depends on that. Back/Forward restores the
 * remembered offset, because losing your place on Back is the same bug in the
 * other direction.
 *
 * Lives in its own component because `useSearchParams()` requires a Suspense
 * boundary, and the shared chrome state must not sit inside one.
 */
export function ShellScrollManager({ contentRef }: { contentRef: RefObject<HTMLElement | null> }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = `${pathname}?${searchParams.toString()}`;

  const scrollMemory = useRef(new Map<string, number>());
  const previousUrlRef = useRef<string | null>(null);
  /** URL a Back/Forward restore is in flight for, so the effect stands aside. */
  const restorePendingRef = useRef<string | null>(null);
  /** The url the scroll listener attributes positions to. */
  const currentUrlRef = useRef(url);
  currentUrlRef.current = url;

  // Record the position continuously rather than reading it when navigation
  // happens. Measured: by the time the route-change effect runs, the browser
  // has already moved the region, so capturing there stored 77 instead of the
  // 900 the reader was actually at — and Back then faithfully restored 77.
  // The last position observed while the URL was current is the true one.
  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (restorePendingRef.current) return; // don't record our own restore
        scrollMemory.current.set(currentUrlRef.current, node.scrollTop);
      });
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      node.removeEventListener('scroll', onScroll);
    };
  }, [contentRef]);

  // Restoring happens IN the popstate handler, not from a flag it sets.
  // Measured ordering on a real Back in this app: the router re-renders and
  // this component's effect has already run (and scrolled to top) before
  // `popstate` reaches any listener — `["set:900","set:0","set:0","popstate"]`.
  // So a "was this a pop?" flag is always read too early. Correcting the
  // position once the event does arrive is the ordering that actually holds.
  useEffect(() => {
    const onPopState = () => {
      const target = `${window.location.pathname}?${window.location.search.replace(/^\?/, '')}`;
      const remembered = scrollMemory.current.get(target);
      restorePendingRef.current = target;
      if (typeof remembered !== 'number') return;

      // Retry across a few frames instead of restoring once. The routed page
      // re-renders after the pop, so on the first frame the region is often
      // still short and the browser clamps the assignment — measured: asking
      // for 900 landed at 77. Keep trying until the position sticks or the
      // budget runs out, which is the same reason browsers defer their own
      // scroll restoration until layout settles.
      const deadline = performance.now() + 600;
      const attempt = () => {
        if (restorePendingRef.current !== target) return;
        const node = contentRef.current;
        if (!node) return;
        node.scrollTop = remembered;
        if (Math.abs(node.scrollTop - remembered) < 1 || performance.now() > deadline) {
          restorePendingRef.current = null;
          return;
        }
        requestAnimationFrame(attempt);
      };
      requestAnimationFrame(attempt);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [contentRef]);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;

    const previousUrl = previousUrlRef.current;
    if (previousUrl === url) return;
    previousUrlRef.current = url;

    // A restore for this URL is already in flight; don't fight it.
    if (restorePendingRef.current === url) return;

    const hash = window.location.hash.slice(1);
    const target = hash ? node.querySelector(`#${CSS.escape(hash)}`) : null;
    if (target) {
      target.scrollIntoView({ block: 'start' });
      return;
    }

    // Runs after the routed page's own effects (React flushes children before
    // parents), which matters: Listen/Events/Pages each call
    // `contentTopRef.scrollIntoView()` when their tab changes, and that would
    // otherwise leave the region parked below the page heading.
    node.scrollTop = 0;
  }, [url, contentRef]);

  return null;
}
