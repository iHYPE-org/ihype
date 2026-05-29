import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ adId: string }> }
) {
  const session = await auth();
  if (!isAdminSession(session)) return NextResponse.json({ error: 'Admin required.' }, { status: 403 });

  const { adId } = await params;
  let body: { status?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const status = typeof body.status === 'string' ? body.status : '';
  const allowed = ['APPROVED', 'REJECTED', 'PENDING', 'PAUSED'];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${allowed.join(', ')}` }, { status: 400 });
  }

  const ad = await db.ad.update({ where: { id: adId }, data: { status } });
  return NextResponse.json({ ad });
}
