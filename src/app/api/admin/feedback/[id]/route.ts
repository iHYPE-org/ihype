import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-api';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';

const ALLOWED_STATUSES = ['open', 'planned', 'shipped', 'declined'] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, response } = await requireAdminApi(request);
    if (!session) return response;
    const { id } = await params;
    const { status } = await request.json() as { status?: string };
    if (!status || !ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    await db.featureRequest.update({ where: { id }, data: { status } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error('[api/admin/feedback]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
