export async function register() {
  if (process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      integrations(defaults) {
        // ContextLines (readline) and LocalVariables (child_process) are Node.js-only.
        // Cloudflare Workers doesn't support these even with nodejs_compat.
        return defaults.filter(
          i => i.name !== 'ContextLines' && i.name !== 'LocalVariables'
        );
      },
      tracesSampler(ctx) {
        if (ctx.parentSampled !== undefined) return ctx.parentSampled;
        const url = ctx.name ?? '';
        if (url.includes('/api/auth') || url.includes('/api/register') || url.includes('/api/shows')) {
          return 0.5;
        }
        return 0.05;
      },
      ignoreErrors: [
        'Non-Error promise rejection captured',
        'AbortError',
      ],
    });
  }
}
