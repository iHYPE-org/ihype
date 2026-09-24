/**
 * THE ONE PLACE THE BROWSER SENTRY SDK IS IMPORTED (2026-09-24, DESIGN_SYNC
 * row 512).
 *
 * Three files reach the SDK — the client entry (`instrumentation-client.ts`),
 * the Web Vitals reporter and the root error boundary — and each used to
 * `import('@sentry/browser')` on its own. The entry waited for `load` and an
 * idle callback (row 511); the reporter did not, and its first metric (TTFB)
 * arrives right at `load`, so on two of four measured screens the 323 KB
 * chunk was requested BEFORE the load event and sat in the pre-hydration set
 * again. One loader, one schedule: whoever asks first gets a promise that
 * resolves after the document has loaded and the main thread is idle (with a
 * ceiling, so a page that is never idle still gets its SDK), and everybody
 * else gets the same promise.
 *
 * `sentry-client-wiring.test.ts` refuses a second `import('@sentry/browser')`
 * anywhere under `src/`.
 */
export type BrowserSentry = typeof import('@sentry/browser');

let pending: Promise<BrowserSentry> | null = null;

function afterLoadAndIdle(): Promise<void> {
  return new Promise((resolve) => {
    const whenIdle = () => {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => resolve(), { timeout: 2500 });
      } else {
        window.setTimeout(resolve, 1500);
      }
    };
    if (document.readyState === 'complete') whenIdle();
    else window.addEventListener('load', whenIdle, { once: true });
  });
}

/**
 * Resolves with the SDK module once the page is up. Never rejects twice for
 * the same page: a chunk that failed to load is retried on the next call,
 * because the next navigation is a new document anyway.
 */
export function loadBrowserSentry(): Promise<BrowserSentry> {
  if (typeof window === 'undefined') return Promise.reject(new Error('browser only'));
  if (!pending) {
    pending = afterLoadAndIdle()
      .then(() => import('@sentry/browser'))
      .catch((error: unknown) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}
