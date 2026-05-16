import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

const schema = z.object({
  event: z.string().trim().min(1).max(80),
  role: z.enum(['FAN', 'ARTIST', 'DJ', 'VENUE']).optional(),
  method: z.enum(['email', 'passkey']).optional(),
  step: z.string().trim().max(80).optional(),
  reason: z.string().trim().max(240).optional()
});

export async function POST(request: Request) {
  const clientAddress = readClientAddress(request);
  const rateLimit = await consumeRateLimit(`signup-funnel:${clientAddress}`, {
    limit: 60,
    windowMs: 15 * 60 * 1000
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
      reason: body.reason ?? null
    }
  });

  return NextResponse.json({ ok: true });
}
