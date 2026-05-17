import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const clientAddress = readClientAddress(request);
  const session = await auth();

  const rateKey = `report:ip:${clientAddress ?? 'unknown'}`;
  const rate = await consumeRateLimit(rateKey, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many reports. Try later.' }, { status: 429 });
  }

  let body: { entityType?: string; entityId?: string; reason?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // ignore
  }

  const entityType = typeof body.entityType === 'string' ? body.entityType.trim() : '';
  const entityId = typeof body.entityId === 'string' ? body.entityId.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';

  if (!entityType || !entityId || !reason) {
    return NextResponse.json({ error: 'entityType, entityId, and reason are required.' }, { status: 400 });
  }

  await db.report.create({
    data: {
      reporterId: session?.user?.id ?? null,
      entityType,
      entityId,
      reason,
      status: 'open'
    }
  });

  return NextResponse.json({ ok: true });
}
