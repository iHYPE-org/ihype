import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ showId: string }> }
) {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  }

  const { showId } = await params;
  const show = await db.show.findUnique({ where: { id: showId }, select: { featured: true } });
  if (!show) return NextResponse.json({ error: 'Show not found' }, { status: 404 });

  const updated = await db.show.update({
    where: { id: showId },
    data: { featured: !show.featured },
    select: { featured: true },
  });

  return NextResponse.json({ featured: updated.featured });
}
