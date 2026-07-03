import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

const ALLOWED_STATUSES = ['open', 'planned', 'shipped', 'declined'] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const { status } = await request.json() as { status?: string };
    if (!status || !ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    await db.featureRequest.update({ where: { id }, data: { status } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/admin/feedback] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
