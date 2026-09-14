import * as Sentry from '@sentry/nextjs';

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
 * `connect-src` carried no ingest origin. Every event this project has ever
 * recorded is server-side; a hydration error, a player fault or a blank map in
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
 * Sampling is unchanged from the original file: errors always, traces at 5%
 * with the auth, registration and show routes at 50%. Browser events count
 * against the Sentry quota, which is the cost of finally seeing them.
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
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
  });
}

/* Next calls this on every App Router navigation; Sentry turns it into a
   navigation span. Harmless when the SDK is not initialised. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
