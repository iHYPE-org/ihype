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

function isLocalHostname(hostname) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || hostname === '[::1]'
    || hostname === '::1'
    || hostname.endsWith('.localhost');
}

/**
 * Set on the first request of a `wrangler dev` session and never cleared.
 *
 * beforeSend can only inspect event.request.url, and a great many events do
 * not have one: anything captured by src/lib/logger.ts's log.error from
 * library code arrives with culprit "?(worker)" and no request attached, so
 * the hostname check below has nothing to test and lets it through. That was
 * tolerable when 14 routes used log.error. As of the sweep that moved all 98
 * server error sites onto it, most captured events take that path.
 *
 * A local run loads this same wrangler.toml, so it has the real SENTRY_DSN
 * and reports itself as environment "production" — which is exactly how a
 * developer's miniflare session previously showed up as two production
 * issues. Remembering that we have seen a local request lets the filter work
 * on events that carry no URL of their own.
 *
 * Module scope is deliberate: it lives as long as the isolate, which for a
 * local session is the session. In production it is only ever set by a
 * request that genuinely arrived on localhost, which cannot happen through
 * Cloudflare's edge.
 */
let sawLocalRequest = false;

const handler = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (isLocalHostname(url.hostname)) {
      sawLocalRequest = true;
    }
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
      // No request URL to judge by — which is the common case for anything
      // log.error captured from library code. Fall back to whether this
      // isolate has ever served a local request. Without this the filter only
      // caught events that happened to carry a URL, and every other local
      // error still shipped as production.
      if (!url) return sawLocalRequest ? null : event;
      try {
        return isLocalHostname(new URL(url).hostname) ? null : event;
      } catch {
        return event;
      }
    },
  } : undefined,
  handler,
);
