import { NextRequest, NextResponse } from 'next/server';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const clientAddress = readClientAddress(request);
    const rateLimit = await consumeRateLimit(`referral-click:${clientAddress}`, {
      limit: 30,
      windowMs: 60_000
    });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = (await request.json().catch(() => null)) as { ref?: string } | null;
    const ref = body?.ref?.trim();
    if (!ref || ref.length > 80) {
      return NextResponse.json({ error: 'Invalid ref' }, { status: 400 });
    }

    await recordAuditEvent({
      action: 'referral_click',
      entityType: 'referral',
      entityId: ref,
      ipAddress: clientAddress
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/referral/click] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
