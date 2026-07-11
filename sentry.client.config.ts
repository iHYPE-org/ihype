import * as Sentry from '@sentry/nextjs';

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
