'use client';

import { useEffect } from 'react';
import { warmTicketCache } from '@/lib/private-cache';

/**
 * Makes the design's promise true: "Venues are basements … the wallet opens in
 * airplane mode."
 *
 * It was only conditionally true. `sw.js` serves `/tickets/<id>` network-first
 * with a cache fallback, so a ticket the holder had already opened worked
 * offline — and one they had not did not. Buying on the bus and opening it for
 * the first time at the door is precisely the case that strands someone.
 *
 * Mounted by `/tickets`, which is the one page that knows every ticket the
 * member holds. Renders nothing: this is a side effect on a surface they were
 * visiting anyway, not a control.
 */
export function OfflineTicketWarmer({ paths }: { paths: readonly string[] }) {
  useEffect(() => {
    if (!paths.length) return;
    // Deferred to idle so warming never competes with painting the list the
    // member is actually looking at. `requestIdleCallback` is not in Safari
    // until 17, hence the timeout fallback.
    const supportsIdle = 'requestIdleCallback' in window;
    const idle = supportsIdle
      ? window.requestIdleCallback(() => warmTicketCache(paths))
      : window.setTimeout(() => warmTicketCache(paths), 1200);

    return () => {
      if (supportsIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [paths]);

  return null;
}
