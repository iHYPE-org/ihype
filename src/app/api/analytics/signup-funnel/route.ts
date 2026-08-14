import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { trackRequest } from '@/lib/analytics';

const schema = z.object({
  event: z.string().min(1).max(80),
  role: z.enum(['FAN', 'ARTIST', 'VENUE']).optional(),
  method: z.enum(['email', 'passkey']).optional(),
  step: z.string().trim().max(80).optional(),
  reason: z.string().trim().max(240).optional(),
  browser: z.string().trim().max(80).optional(),
  platform: z.string().trim().max(80).optional(),
  webauthn: z.string().trim().max(40).optional(),
  errorName: z.string().trim().max(80).optional(),
  variant: z.string().trim().max(40).optional(),
  viewport: z.string().trim().max(40).optional()
});

export async function POST(request: Request) {
  const clientAddress = readClientAddress(request);
  const rateLimit = await consumeRateLimit(`signup-funnel:${clientAddress}`, {
    limit: 60,
    windowMs: 15 * 60 * 1000,
    /**
     * KV on purpose, exactly as `/api/analytics/track` is — and this bucket is
     * the stronger case of the two.
     *
     * Sentry JAVASCRIPT-NEXTJS-3: "DO rate limit timed out after 750ms" on this
     * route, 139 times in 25 days and still firing. The cause is the shape of
     * the bucket, not a fault: it is keyed per client IP on an endpoint one
     * person touches a handful of times while signing up, so its Durable
     * Object is evicted between uses and nearly every call pays a cold start.
     * That is the same reasoning that put `timeoutMs: 2500` on the auth
     * buckets — but this one does not need atomicity at all, so the cheaper
     * answer is the right one.
     *
     * What the timeout actually cost: a DO failure falls back to KV at HALF
     * the configured limit, so this route has been quietly enforcing 30 per
     * 15 minutes rather than 60 — and dropping signup-funnel telemetry during
     * signup, which is the one funnel an invite-only alpha needs to see. An
     * opted-out bucket keeps its full limit and logs nothing.
     *
     * Safe because the only consequence of an over-count here is a dropped
     * analytics event: this route already answers ok on refusal.
     */
    atomic: false
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: true });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: true });
  }

  await recordAuditEvent({
    action: `signup_funnel:${body.event}`,
    entityType: 'signup_funnel',
    ipAddress: clientAddress,
    metadata: {
      role: body.role ?? null,
      method: body.method ?? null,
      step: body.step ?? null,
      reason: body.reason ?? null,
      browser: body.browser ?? null,
      platform: body.platform ?? null,
      webauthn: body.webauthn ?? null,
      errorName: body.errorName ?? null,
      variant: body.variant ?? null,
      viewport: body.viewport ?? null
    }
  });

  trackRequest(`/funnel/${body.event}`, 200, 0);

  return NextResponse.json({ ok: true });
}
