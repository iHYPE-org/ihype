// On Cloudflare Workers, a promise that is neither awaited nor registered
// with ctx.waitUntil can be cancelled the moment the response returns —
// wrangler.toml's `no_handle_cross_request_promise_resolution` flag makes
// that a hard guarantee. Every fire-and-forget (alert emails, Sentry
// reports, metrics writes) must go through this helper or it may silently
// never run.
export function deferWork(work: Promise<unknown>, label = 'defer-work'): void {
  const safe = work.catch((error: unknown) => {
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
