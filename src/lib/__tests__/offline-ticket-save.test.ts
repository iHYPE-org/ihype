import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import { clearPrivateCaches, warmTicketCache } from '@/lib/private-cache';

/**
 * The fan's half of "my ticket opens at a door with no signal".
 *
 * Both invariants here are defects that shipped, and both were invisible: a
 * warm that quietly did nothing and a control that would have said it worked.
 */

type FakeWorker = { postMessage: ReturnType<typeof vi.fn> };

function installServiceWorker(options: {
  /** null models a browser with no service worker support at all. */
  ready?: Promise<{ active: FakeWorker | null }> | null;
  controller?: FakeWorker | null;
}): FakeWorker | null {
  const worker = options.controller ?? null;
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: options.ready === null ? undefined : { ready: options.ready, controller: worker },
  });
  return worker;
}

function replyingWorker(reply: { stored: number; failed: number }): FakeWorker {
  return {
    postMessage: vi.fn((message: unknown, transfer?: unknown[]) => {
      const port = (transfer?.[0] ?? null) as MessagePort | null;
      const data = message as { type?: string };
      if (port && data.type === 'WARM_TICKETS') {
        port.postMessage({ type: 'WARM_RESULT', ...reply });
      }
    }),
  };
}

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('warming waits for the worker rather than reading the controller', () => {
  /* THE BUG THIS PINS (2026-09-10): it read `navigator.serviceWorker.controller`,
     which is NULL on the first load of a session — the worker claims a page on
     activate, after that navigation has already been served. So a fan who
     opened the wallet once and went to the venue had cached nothing, silently.
     `warmDoorCache` had always awaited `serviceWorker.ready` for exactly this
     reason and the fan path never got the fix. */
  it('stores tickets even when there is no controller yet', async () => {
    const worker = replyingWorker({ stored: 2, failed: 0 });
    installServiceWorker({ ready: Promise.resolve({ active: worker }), controller: null });

    const outcome = await warmTicketCache(['/app/me/tickets/a', '/app/me/tickets/b']);

    expect(outcome).toEqual({ ok: true, stored: 2, failed: 0 });
    const warm = worker.postMessage.mock.calls.find(([m]) => (m as { type: string }).type === 'WARM_TICKETS');
    expect(warm?.[0]).toMatchObject({ paths: ['/app/me/tickets/a', '/app/me/tickets/b'] });
  });

  it('reports no-worker rather than success when the browser has none', async () => {
    installServiceWorker({ ready: null });
    await expect(warmTicketCache(['/app/me/tickets/a'])).resolves.toEqual({ ok: false, reason: 'no-worker' });
  });

  it('reports no-worker when the registration never resolves an active worker', async () => {
    installServiceWorker({ ready: Promise.resolve({ active: null }), controller: null });
    await expect(warmTicketCache(['/app/me/tickets/a'])).resolves.toEqual({ ok: false, reason: 'no-worker' });
  });
});

describe('the control is told what was actually stored', () => {
  /* A "Save my tickets" button cannot report success from the fact that a
     postMessage was sent. An older worker, a transferred ticket that now 404s,
     and full storage all look identical from the page — and a tick over an
     empty cache is worse than no control, because the fan stops worrying. */
  it('passes the failure count through so partial saves are not called clean', async () => {
    const worker = replyingWorker({ stored: 1, failed: 2 });
    installServiceWorker({ ready: Promise.resolve({ active: worker }), controller: worker });

    await expect(warmTicketCache(['/a', '/b', '/c'])).resolves.toEqual({ ok: true, stored: 1, failed: 2 });
  });

  it('resolves no-answer when a worker too old to reply says nothing', async () => {
    vi.useFakeTimers();
    const silent: FakeWorker = { postMessage: vi.fn() };
    installServiceWorker({ ready: Promise.resolve({ active: silent }), controller: silent });

    const pending = warmTicketCache(['/app/me/tickets/a']);
    await vi.advanceTimersByTimeAsync(20_000);

    await expect(pending).resolves.toEqual({ ok: false, reason: 'no-answer' });
  });

  it('does nothing and claims nothing for a member with no tickets', async () => {
    installServiceWorker({ ready: null });
    await expect(warmTicketCache([])).resolves.toEqual({ ok: true, stored: 0, failed: 0 });
  });
});

describe('signing out clears the tickets even before the worker has claimed the page', () => {
  /* THE SAME READ, WITH WORSE CONSEQUENCES (found 2026-09-10 by scanning for
     siblings of the warm bug, not by anything failing). `clearPrivateCaches`
     also read `controller`, and `sw.js` calls `clients.claim()` on activate —
     so on a first load the page is uncontrolled and the message went nowhere.
     What stays behind is the previous account's ticket QR pages, in the one
     cache that is deliberately version-independent so nothing else ever wipes
     it. That is the exact risk the function's own docstring describes. */
  it('sends through the controller when the page already has one', async () => {
    const worker: FakeWorker = { postMessage: vi.fn() };
    installServiceWorker({ ready: Promise.resolve({ active: worker }), controller: worker });

    await expect(clearPrivateCaches()).resolves.toBe(true);
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'CLEAR_PRIVATE' });
  });

  it('falls back to the registration when there is no controller yet', async () => {
    const worker: FakeWorker = { postMessage: vi.fn() };
    installServiceWorker({ ready: Promise.resolve({ active: worker }), controller: null });

    await expect(clearPrivateCaches()).resolves.toBe(true);
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'CLEAR_PRIVATE' });
  });

  /* Sign-out must never be held by a cache operation. The callers navigate in
     a `finally`, and this is the half that makes that safe: it resolves. */
  it('resolves false rather than hanging when there is no worker at all', async () => {
    installServiceWorker({ ready: null });
    await expect(clearPrivateCaches()).resolves.toBe(false);
  });

  it('gives up on a registration that never resolves', async () => {
    vi.useFakeTimers();
    installServiceWorker({ ready: new Promise(() => {}), controller: null });

    const pending = clearPrivateCaches();
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(pending).resolves.toBe(false);
  });
});

describe('the service worker answers the page', () => {
  /* Guarded against the source because the reply is the whole basis for what
     the member is told, and nothing else in the suite loads sw.js. */
  const sw = readFileSync('public/sw.js', 'utf8');

  it('posts a WARM_RESULT back on the port the page supplied', () => {
    expect(sw).toContain('WARM_RESULT');
    expect(sw, 'the worker must read the MessageChannel port the page transfers').toContain('event.ports');
  });

  it('still works for a caller that supplies no port', () => {
    // The port is optional on purpose: a page served by an older bundle keeps
    // warming exactly as before rather than throwing inside the worker.
    expect(sw).toMatch(/if \(port\)/);
  });
});
