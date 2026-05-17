import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Admin only.' }, { status: 403 });
  }

  const reports = await db.report.findMany({
    where: { status: 'open' },
    orderBy: { createdAt: 'desc' },
    take: 200
  });

  return NextResponse.json({ reports });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Admin only.' }, { status: 403 });
  }

  let body: { reportId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // ignore
  }

  const reportId = typeof body.reportId === 'string' ? body.reportId : '';
  if (!reportId) return NextResponse.json({ error: 'reportId required.' }, { status: 400 });

  await db.report.update({ where: { id: reportId }, data: { status: 'closed' } });

  return NextResponse.json({ ok: true });
}
