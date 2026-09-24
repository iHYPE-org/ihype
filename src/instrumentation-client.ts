/**
 * The BROWSER half of error monitoring — and until 2026-09-14 it had never run.
 *
 * This file used to live at the repository root as `sentry.client.config.ts`,
 * the name the Sentry wizard wrote in 2025. That file is not an entry point on
 * its own: it is only ever bundled by `withSentryConfig`'s build plugin, which
 * `next.config.mjs` does not use (the Node-oriented server half crashed the
 * Worker, so `worker.js` wraps the Workers handler with `@sentry/cloudflare`
 * instead — see that file). So the init below was never in any client chunk,
 * `NEXT_PUBLIC_SENTRY_DSN` was never inlined by the deploy, and the live CSP's
 * `connect-src` carried no ingest origin. Every event this project had
 * recorded was server-side; a hydration error, a player fault or a blank map in
 * a member's browser reached nobody.
 *
 * Next 15.3+ loads `instrumentation-client.ts` natively, before the app
 * hydrates, with no plugin — which is the only client entry point available to
 * a build that deliberately does not use `withSentryConfig`. The DSN is public
 * (the same value `wrangler.toml` carries for the server) and is inlined at
 * build by `deploy-production.yml`; `src/middleware.ts` reads the same
 * variable to put the ingest origin into `connect-src`, so the SDK and the
 * policy cannot disagree about where reports go.
 *
 * THE SDK IS LOADED AFTER THE PAGE IS INTERACTIVE, NOT WITH IT (2026-09-24,
 * DESIGN_SYNC row 511). A static `import * as Sentry from '@sentry/nextjs'`
 * here put the whole browser SDK — 564 KB of JavaScript, measured in the
 * built bundle — into the chunk every page downloads and evaluates BEFORE
 * hydration, so a member paid for error reporting ahead of the screen they
 * came for. The dynamic import below moves it into its own chunk, fetched
 * once the document has loaded and the main thread is idle. What it costs,
 * stated: an error thrown in the first second or two of a cold load reaches
 * Sentry only through the queue below, which holds `error` and
 * `unhandledrejection` events until the SDK is up and then replays them —
 * so the window is covered for exceptions, and not for the breadcrumbs or
 * the navigation span that would have surrounded them. A navigation that
 * starts before the SDK loads gets no span at all; that is a sampled trace,
 * not a lost error.
 *
 * Sampling is unchanged from the original file: errors always, traces at 5%
 * with the auth, registration and show routes at 50%. Browser events count
 * against the Sentry quota, which is the cost of finally seeing them.
 */
type SentryModule = typeof import('@sentry/nextjs');

let sentry: SentryModule | null = null;
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

/* Exceptions that happen before the SDK is loaded. Bounded, because a page
   throwing in a loop must not grow this without limit. */
const heldErrors: unknown[] = [];
const HELD_ERRORS_MAX = 20;
function hold(error: unknown) {
  if (heldErrors.length < HELD_ERRORS_MAX) heldErrors.push(error);
}
const onError = (event: ErrorEvent) => hold(event.error ?? event.message);
const onRejection = (event: PromiseRejectionEvent) => hold(event.reason);

function init(mod: SentryModule) {
  mod.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_APP_VERSION,
    sendDefaultPii: false,
    tracesSampler(ctx) {
      // Always sample requests that produced an error
      if (ctx.parentSampled !== undefined) return ctx.parentSampled;
      // Sample auth, registration, and show routes at 50%; everything else at 5%
      const url = ctx.name ?? '';
      if (url.includes('/api/auth') || url.includes('/api/register') || url.includes('/api/shows')) {
        return 0.5;
      }
      return 0.05;
    },
    ignoreErrors: [
      // Browser extension noise
      'Non-Error promise rejection captured',
      // User-initiated aborts
      'AbortError',
    ],
    beforeSend(event) {
      // URLs may carry search terms, email addresses, or one-time callback
      // tokens. Route-level grouping needs the path, never the query/hash.
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url, window.location.origin);
          event.request.url = `${url.origin}${url.pathname}`;
        } catch {
          delete event.request.url;
        }
      }
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.data;
      }
      if (event.user) {
        event.user = event.user.id ? { id: event.user.id } : undefined;
      }
      return event;
    },
  });
  sentry = mod;
  window.removeEventListener('error', onError);
  window.removeEventListener('unhandledrejection', onRejection);
  for (const error of heldErrors.splice(0)) mod.captureException(error);
}

function load() {
  void import('@sentry/nextjs').then(init).catch(() => {
    /* The SDK chunk failing to load is not an error worth a second attempt
       on this page: the next navigation is a new document and tries again. */
  });
}

function scheduleLoad() {
  /* After `load`, then when the main thread is idle — with a ceiling, so a
     page that is never idle (the map, the player) still gets its SDK. */
  const whenIdle = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(load, { timeout: 2500 });
    } else {
      window.setTimeout(load, 1500);
    }
  };
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
}

if (dsn && typeof window !== 'undefined') {
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  scheduleLoad();
}

/* Next calls this on every App Router navigation; Sentry turns it into a
   navigation span. Harmless when the SDK is not initialised or not yet
   loaded. */
export function onRouterTransitionStart(href: string, navigationType: string) {
  sentry?.captureRouterTransitionStart(href, navigationType);
}
