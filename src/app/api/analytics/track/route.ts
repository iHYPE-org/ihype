import { NextResponse } from 'next/server';
import { z } from 'zod';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { trackEvent } from '@/lib/analytics';
import { sanitizeTelemetryEvent } from '@/lib/telemetry';
import { exceedsDeclaredRequestSize } from '@/lib/request-size';

// Generic product-event ingest — Seeds swipes, checkout steps, referral
// clicks, etc. Writes to Cloudflare Analytics Engine via trackEvent().
// Deliberately not authenticated (anonymous/pre-login events matter too,
// e.g. landing-page interactions) and deliberately not written to the
// audit log — that's for accountable security/moderation actions, not
// high-volume product analytics.

const schema = z.object({
  event: z.string().trim().min(1).max(80),
  props: z.record(z.string().max(60), z.union([z.string().max(200), z.number(), z.boolean(), z.null()])).optional()
});

export async function POST(request: Request) {
  const clientAddress = readClientAddress(request);
  const rateLimit = await consumeRateLimit(`analytics-track:${clientAddress}`, {
    limit: 120,
    windowMs: 60 * 1000,
    // Highest-volume bucket on the site, and the only consequence of an
    // over-count is a dropped analytics event (this route already returns
    // ok on refusal). Not worth a serialized Durable Object round-trip in
    // front of every page interaction — KV's approximate counter is the
    // right tool here.
    atomic: false
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: true });
  }

  let body: z.infer<typeof schema>;
  try {
    // A telemetry event is a few hundred bytes; refuse anything that is not
    // before the isolate parses it (second security scan, 2026-09-02).
    if (exceedsDeclaredRequestSize(request, 4 * 1024)) {
      return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });
    }
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: true });
  }

  const safe = sanitizeTelemetryEvent(body.event, body.props);
  if (safe) trackEvent(safe.event, safe.props);

  return NextResponse.json({ ok: true });
}
