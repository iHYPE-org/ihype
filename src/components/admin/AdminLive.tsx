'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { PulseSnapshot } from '@/lib/admin-pulse';

/**
 * MAKES EVERY ADMIN PAGE LIVE, WITHOUT REWRITING ANY OF THEM (2026-08-14).
 *
 * `/admin` got a self-refreshing board. The other seventeen `/admin/*` pages
 * are plain server renders: the verification queue you are looking at is the
 * queue as it was when you opened the tab, and nothing on screen says so. For
 * a console someone runs an organisation from, "the number is old and does not
 * admit it" is the same defect the board's age line exists to prevent.
 *
 * Mounted once in `src/app/admin/layout.tsx`, so it covers every admin page
 * including ones added later — the alternative was a hook call added by hand
 * to seventeen pages, which is seventeen chances to forget and no way to
 * notice. It renders no layout of its own.
 *
 * ## Why `router.refresh()` and not a fetch
 *
 * These pages have no JSON endpoints; their data only exists inside their own
 * server render. `router.refresh()` re-runs exactly that and reconciles the
 * result into the live DOM — scroll position, focus and open form state all
 * survive, which a full navigation would not. It is the only mechanism that
 * makes a page live without first giving it an API.
 *
 * ## Three things it deliberately does not do
 *
 * 1. **It skips `/admin`.** That page is the 1063-line console — a refresh
 *    there is 67 queries, and its board already polls its own endpoint every
 *    20s. Refreshing it would re-run all of that to update figures that are
 *    already live.
 * 2. **It stops when the tab is hidden.** Same reasoning as the board: a
 *    console left open overnight would otherwise re-run every query on the
 *    page all night for nobody, and each of these refreshes is heavier than a
 *    pulse poll.
 * 3. **It never refreshes while a form is being filled.** `router.refresh()`
 *    preserves DOM state, but a re-render arriving mid-typing is still a real
 *    risk on pages like `/admin/broadcast`, where the operator is composing an
 *    email to every member. If focus is inside an input, textarea, select or
 *    anything contenteditable, the tick is skipped rather than queued.
 */

const REFRESH_MS = 45_000;

function isEditing() {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export function AdminLiveRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  // The console has its own, cheaper live loop. Anything under it does not.
  const enabled = pathname !== '/admin' && pathname !== '/admin/';

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(() => {
      if (document.hidden || isEditing()) return;
      router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [enabled, router]);

  return null;
}

/**
 * The counts on the rail.
 *
 * The console has eight sections and seventeen pages under them, and until now
 * the only way to learn that four verifications were waiting was to open the
 * page and look. That is the scroll problem again, one level up: the operator
 * has to walk the console to find the work.
 *
 * Reads the SAME `/api/admin/pulse` the board polls, so a badge and the board
 * cannot disagree, and mapping is by section rather than by page because the
 * rail is sections. `null` never renders — a badge showing 0 and a badge whose
 * count could not be read look identical, and only one of them means "nothing
 * to do".
 */
export function useAdminBadges(): Record<string, number> {
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;

    const read = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch('/api/admin/pulse', { cache: 'no-store' });
        if (!response.ok) return;
        const snapshot = (await response.json()) as PulseSnapshot;
        if (cancelled) return;
        const next: Record<string, number> = {};
        for (const section of snapshot.sections) {
          if (section.badge === null || section.badge <= 0) continue;
          // Pulse sections are not rail sections: the rail is navigation, the
          // pulse is subject matter. This is the one mapping between them, and
          // it lives here rather than in the data so the board stays a
          // description of the platform rather than of this menu.
          const rail = {
            attention: 'users',
            comms: 'users',
            money: 'payments',
            live: 'users',
            growth: 'stats',
            system: 'system',
          }[section.id];
          if (rail) next[rail] = (next[rail] ?? 0) + section.badge;
        }
        setBadges(next);
      } catch {
        // A failed read leaves the previous badges rather than clearing them:
        // clearing would silently claim the queues had emptied.
      }
    };

    void read();
    const timer = setInterval(() => void read(), 30_000);
    const onVisible = () => void read();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return badges;
}
