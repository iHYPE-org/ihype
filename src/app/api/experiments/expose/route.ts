import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  let body: { key?: string; variant?: string; userId?: string | null } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // ignore
  }
  const key = typeof body.key === 'string' ? body.key.slice(0, 100) : '';
  const variant = typeof body.variant === 'string' ? body.variant.slice(0, 100) : '';
  if (!key || !variant) return NextResponse.json({ ok: false }, { status: 400 });

  await recordAuditEvent({
    actorUserId: session?.user?.id ?? null,
    action: 'experiment_exposure',
    entityType: 'experiment',
    entityId: key,
    ipAddress: readClientAddress(request),
    metadata: { key, variant, userId: session?.user?.id ?? body.userId ?? null }
  });

  return NextResponse.json({ ok: true });
}
