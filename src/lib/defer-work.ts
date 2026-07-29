// On Cloudflare Workers, a promise that is neither awaited nor registered
// with ctx.waitUntil can be cancelled the moment the response returns —
// wrangler.toml's `no_handle_cross_request_promise_resolution` flag makes
// that a hard guarantee. Every fire-and-forget (alert emails, Sentry
// reports, metrics writes) must go through this helper or it may silently
// never run.
export function deferWork(work: Promise<unknown>, label = 'defer-work'): void {
  const safe = work.catch((error: unknown) => {
    // console.error, not log.error, and deliberately so: logger.ts imports
    // this module to defer its own Sentry capture, so importing the logger
    // back would be a cycle — and a failure here can be the Sentry report
    // itself, which cannot be reported through Sentry. This is one of exactly
    // two places in server code where console.error is the right call; the
    // other is the logger's own stdout emit.
    console.error(`[${label}] deferred work failed`, error);
  });

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const { ctx } = getCloudflareContext();
    ctx.waitUntil(safe);
    return;
  } catch {
    // Not on Workers (local dev, build, scripts) — the Node event loop
    // keeps the promise alive on its own.
  }

  void safe;
}
