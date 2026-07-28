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
    const newWindow = !record || record.resetAt <= now;
    if (newWindow) {
      record = { count: 0, resetAt: now + windowMs };
    }
    record.count += 1;
    // Wipe storage after the window so idle buckets don't accumulate. Only
    // worth writing when the window actually opens: the alarm time doesn't
    // change within a window, so re-setting it on every call was a third
    // storage op per request that always wrote the value already stored.
    // Under a burst on one key — every request for that key serializes
    // through this single instance — that overhead is what pushed calls past
    // the caller's deadline.
    if (newWindow) {
      this.ctx.storage.setAlarm(record.resetAt);
    }
    await this.ctx.storage.put('bucket', record);
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
    // A local `wrangler dev` run loads this same wrangler.toml, so it picks up
    // the real SENTRY_DSN and reports itself as environment "production" (the
    // built Worker's NODE_ENV) — two issues in the production project turned
    // out to be one developer's miniflare session on 127.0.0.1:8787, not the
    // live site. Drop anything whose request never left a local machine.
    beforeSend(event) {
      const url = event.request?.url ?? '';
      if (!url) return event;
      try {
        const { hostname } = new URL(url);
        const local = hostname === 'localhost'
          || hostname === '127.0.0.1'
          || hostname === '0.0.0.0'
          || hostname === '[::1]'
          || hostname.endsWith('.localhost');
        return local ? null : event;
      } catch {
        return event;
      }
    },
  } : undefined,
  handler,
);
