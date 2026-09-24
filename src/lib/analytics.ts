import { sanitizeTelemetryEvent } from '@/lib/telemetry';

// Emits data points to Cloudflare Analytics Engine.
// Binding: AE (AnalyticsEngineDataset) from getCloudflareContext()
// Falls back silently if binding not available (local dev).

type AEDataset = {
  writeDataPoint(data: {
    blobs?: string[];
    doubles?: number[];
    indexes?: string[];
  }): void;
};

async function getAEDataset(): Promise<AEDataset | undefined> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    return (getCloudflareContext().env as Record<string, unknown>).AE as AEDataset | undefined;
  } catch {
    // Plain Next development and unit tests do not initialize a Workerd
    // context. Telemetry is optional there and must never reject globally.
    return undefined;
  }
}

// Client-side: best-effort, aggregate-only telemetry. The sanitizer removes
// arbitrary caller data before it leaves the browser. Events are deliberately
// not retained in localStorage: a device should not accumulate a readable
// history of searches, playback, or navigation merely to support metrics.
export function track(event: string, props?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const safe = sanitizeTelemetryEvent(event, props);
  if (!safe) return;
  try {
    void fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safe),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // best-effort — e.g. fetch unavailable in some embedded contexts
  }
}

/* Client-side, batched: queued in memory and sent as ONE request when the page
   is hidden or unloaded (2026-09-24, DESIGN_SYNC row 513). For events that
   arrive in a burst and are not needed until later, Web Vitals above all: one
   POST per metric was five Worker invocations and five KV rate-limit writes
   per page view, the first two landing at `load` beside the hydration
   fetches. `sendBeacon` survives the unload a keepalive fetch sometimes does
   not; the fetch is the fallback where it is missing or refuses. */
const MAX_TRACK_BATCH = 10;
let trackQueue: Array<{ event: string; props?: Record<string, unknown> }> = [];
let flushArmed = false;

function flushTrackQueue(): void {
  if (!trackQueue.length) return;
  const events = trackQueue.slice(0, MAX_TRACK_BATCH);
  trackQueue = trackQueue.slice(MAX_TRACK_BATCH);
  const body = JSON.stringify({ events });
  try {
    const sent = typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
      && navigator.sendBeacon('/api/analytics/track', new Blob([body], { type: 'application/json' }));
    if (!sent) {
      void fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // best-effort
  }
  if (trackQueue.length) flushTrackQueue();
}

export function trackBatched(event: string, props?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const safe = sanitizeTelemetryEvent(event, props);
  if (!safe) return;
  trackQueue.push(safe);
  if (!flushArmed) {
    flushArmed = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushTrackQueue();
    });
    window.addEventListener('pagehide', flushTrackQueue);
  }
  if (trackQueue.length >= MAX_TRACK_BATCH) flushTrackQueue();
}

// Server-side: records one named product event (Seeds swipe, checkout,
// referral click, etc.) with its props JSON-encoded into a blob.
export function trackEvent(event: string, props?: Record<string, unknown>): void {
  try {
    void (async () => {
      const ae = await getAEDataset();
      if (!ae) return;
      const propsJson = props ? JSON.stringify(props).slice(0, 4000) : '';
      ae.writeDataPoint({
        blobs: [event, propsJson],
        indexes: [event],
      });
    })().catch(() => {});
  } catch {
    // Never throw — analytics is best-effort
  }
}

export function trackRequest(
  pathname: string,
  status: number,
  durationMs: number
): void {
  try {
    void (async () => {
      const ae = await getAEDataset();
      if (!ae) return;
      ae.writeDataPoint({
        blobs: [pathname],
        doubles: [status, durationMs],
        indexes: [pathname],
      });
    })().catch(() => {});
  } catch {
    // Never throw — analytics is best-effort
  }
}
