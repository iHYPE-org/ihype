import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isShowOrganizer, ORGANIZER_SHOW_SELECT } from '@/lib/show-organizer';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ showId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const { showId: id } = await params;
  const show = await db.show.findUnique({ where: { id }, select: { id: true, status: true, ...ORGANIZER_SHOW_SELECT } });
  if (!show) return NextResponse.json({ error: 'Show not found' }, { status: 404 });

  // The organiser rule the show page draws the recap form under (row 513).
  if (!isShowOrganizer(session, show)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { recapText?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const recapText = typeof body.recapText === 'string' ? body.recapText.slice(0, 5000) : null;
  const updated = await db.show.update({ where: { id }, data: { recapText } });

  return NextResponse.json({ ok: true, recapText: updated.recapText });
}
