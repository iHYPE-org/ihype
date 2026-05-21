import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const { action } = await request.json() as { action: 'approve' | 'dismiss' };
  await db.contentReport.update({ where: { id }, data: { status: action === 'approve' ? 'ACTIONED' : 'DISMISSED' } });
  return NextResponse.json({ ok: true });
}
