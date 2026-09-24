import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ showId: string }> }
) {
  const { session, response } = await requireAdminApi(request);
  if (!session) return response;

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
