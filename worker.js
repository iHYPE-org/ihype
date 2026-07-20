import { DurableObject } from 'cloudflare:workers';
import * as Sentry from '@sentry/cloudflare';
import openNextWorker from './.open-next/worker.js';

export { BucketCachePurge, DOQueueHandler, DOShardedTagCache } from './.open-next/worker.js';

/**
 * Atomic rate-limit counter. One object per bucket key (idFromName), so all
 * requests for a key serialize through the same instance — unlike KV, where
 * read-increment-write races undercount under concurrent load.
 * Consumed by src/lib/rate-limit.ts via the RATE_LIMITER_DO binding.
 */
export class RateLimiterDO extends DurableObject {
  async consume(limit, windowMs) {
    const now = Date.now();
    let record = await this.ctx.storage.get('bucket');
    if (!record || record.resetAt <= now) {
      record = { count: 0, resetAt: now + windowMs };
    }
    record.count += 1;
    await this.ctx.storage.put('bucket', record);
    // Wipe storage after the window so idle buckets don't accumulate.
    await this.ctx.storage.setAlarm(record.resetAt);
    return {
      allowed: record.count <= limit,
      remaining: Math.max(0, limit - record.count),
      retryAfterSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
    };
  }

  async alarm() {
    const record = await this.ctx.storage.get('bucket');
    if (!record || record.resetAt <= Date.now()) {
      await this.ctx.storage.deleteAll();
    }
  }
}

const handler = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname === 'www.ihype.org') {
      url.hostname = 'ihype.org';
      return Response.redirect(url.toString(), 308);
    }
    const response = await openNextWorker.fetch(request, env, ctx);
    // Service worker scripts must never be served from a CDN edge cache.
    // Cloudflare Static Assets can cache /sw.js with a long max-age, which
    // prevents browsers from picking up the updated worker after a deploy.
    // Force revalidation on every request so the cache-busted CACHE_VERSION
    // inside sw.js is always visible to the browser's SW update check.
    if (url.pathname === '/sw.js') {
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-cache');
      return new Response(response.body, { status: response.status, headers });
    }
    return response;
  },
  scheduled(event, env, ctx) {
    return openNextWorker.scheduled?.(event, env, ctx);
  }
};

// Sentry's Cloudflare-native SDK — NOT @sentry/nextjs's server config, which
// crashes the Worker via an unresolved AsyncLocalStorage cross-request bug
// (@sentry/nextjs's Node-oriented instrumentation.ts init assumes Node server
// request-scoping semantics that don't hold on Workers; see
// https://github.com/getsentry/sentry-javascript/issues/18842). withSentry()
// wraps `fetch` using Cloudflare's own request-context primitives instead.
export default Sentry.withSentry(
  (env) => env.SENTRY_DSN ? {
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampler(ctx) {
      if (ctx.parentSampled !== undefined) return ctx.parentSampled;
      const name = ctx.name ?? '';
      if (name.includes('/api/auth') || name.includes('/api/register') || name.includes('/api/shows')) {
        return 0.5;
      }
      return 0.05;
    },
    ignoreErrors: [
      'Non-Error promise rejection captured',
      'AbortError',
    ],
  } : undefined,
  handler,
);
