'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { warmTicketCache } from '@/lib/private-cache';
import { useI18n } from '@/components/I18nProvider';

/**
 * Makes the design's promise true: "Venues are basements … the wallet opens in
 * airplane mode."
 *
 * It was only conditionally true. `sw.js` serves `/tickets/<id>` network-first
 * with a cache fallback, so a ticket the holder had already opened worked
 * offline — and one they had not did not. Buying on the bus and opening it for
 * the first time at the door is precisely the case that strands someone.
 *
 * Mounted by the wallet, which is the one page that knows every ticket the
 * member holds.
 *
 * IT RENDERS A CONTROL NOW, AND THAT IS THE POINT (2026-09-10). Warming was a
 * silent side effect, which left a fan three ways short:
 *
 *   - they could not ASK for it, so there was no recovery when the browser
 *     evicted the cache — Safari clears unused site storage after seven days,
 *     and a ticket bought a month ahead is exactly that;
 *   - they could not SEE whether it had worked, so "will my ticket open in the
 *     basement" had no answer but faith;
 *   - a transfer REISSUES every serializedId in the order, so the page cached
 *     under the old id is a dead link and the new one was never fetched.
 *
 * The automatic warm on mount stays — most members should never need to press
 * anything — and the button is what makes it recoverable.
 *
 * The wording never claims more than happened: the worker reports what it
 * actually stored (see `warmTicketCache`), and a worker too old to answer, or
 * a browser with no service worker at all, says so rather than showing a tick.
 */

const LAST_SAVED_KEY = 'ihype-tickets-saved-at';

type State =
  | { phase: 'idle' }
  | { phase: 'saving' }
  | { phase: 'saved'; stored: number; failed: number }
  | { phase: 'unavailable' };

function readLastSaved(): number | null {
  try {
    const raw = window.localStorage.getItem(LAST_SAVED_KEY);
    const at = raw ? Number(raw) : NaN;
    return Number.isFinite(at) ? at : null;
  } catch {
    // Private mode, or storage disabled. The control still works.
    return null;
  }
}

function writeLastSaved(at: number): void {
  try {
    window.localStorage.setItem(LAST_SAVED_KEY, String(at));
  } catch {
    /* Nothing to do — the save itself succeeded, only the note about it did not. */
  }
}

export function OfflineTicketWarmer({ paths }: { paths: readonly string[] }) {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  /* The automatic warm runs once per mount. Without this an interactive save
     followed by any re-render of the list would fight it. */
  const autoRan = useRef(false);

  useEffect(() => {
    setLastSaved(readLastSaved());
  }, []);

  const save = useCallback(async (announce: boolean) => {
    if (!paths.length) return;
    if (announce) setState({ phase: 'saving' });
    const outcome = await warmTicketCache(paths);
    if (outcome.ok) {
      const at = Date.now();
      writeLastSaved(at);
      setLastSaved(at);
      if (announce) setState({ phase: 'saved', stored: outcome.stored, failed: outcome.failed });
      return;
    }
    /* `no-worker` and `no-answer` are different causes and the same outcome
       for the member: the tickets are not saved on this device. One sentence
       covers both, and neither is dressed up as success. */
    if (announce) setState({ phase: 'unavailable' });
  }, [paths]);

  useEffect(() => {
    if (!paths.length || autoRan.current) return;
    autoRan.current = true;
    // Deferred to idle so warming never competes with painting the list the
    // member is actually looking at. `requestIdleCallback` is not in Safari
    // until 17, hence the timeout fallback.
    const supportsIdle = 'requestIdleCallback' in window;
    const idle = supportsIdle
      ? window.requestIdleCallback(() => void save(false))
      : window.setTimeout(() => void save(false), 1200);

    return () => {
      if (supportsIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [paths, save]);

  if (!paths.length) return null;

  const busy = state.phase === 'saving';

  return (
    <div className="mmm-offline-save">
      <button
        className="mmm-btn-ghost"
        disabled={busy}
        onClick={() => void save(true)}
        type="button"
      >
        {busy
          ? t('offlineTickets.saving', 'Saving…')
          : t('offlineTickets.save', 'Save tickets to this phone')}
      </button>
      <p className="meta" aria-live="polite">
        {state.phase === 'saved' && (
          state.stored > 0
            ? `${state.stored} ${state.stored === 1
                ? t('offlineTickets.savedOne', 'ticket will open with no signal')
                : t('offlineTickets.savedMany', 'tickets will open with no signal')}${
                state.failed > 0 ? ` · ${state.failed} ${t('offlineTickets.couldNotSave', 'could not be saved')}` : ''}`
            : t('offlineTickets.savedNone', 'Nothing could be saved. Check your connection and try again.')
        )}
        {state.phase === 'unavailable' && t('offlineTickets.unavailable', 'This browser cannot keep tickets for offline use. Take a screenshot of each QR before you travel.')}
        {state.phase !== 'saved' && state.phase !== 'unavailable' && (
          lastSaved
            ? `${t('offlineTickets.lastSaved', 'Saved to this phone')} ${new Date(lastSaved).toLocaleDateString()}`
            : t('offlineTickets.explain', 'Keeps your QR codes on this phone so they open at the door with no signal.')
        )}
      </p>
    </div>
  );
}
