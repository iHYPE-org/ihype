import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest, { params }: { params: Promise<{ showId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const { showId: id } = await params;
  const show = await db.show.findUnique({ where: { id }, select: { id: true, creatorId: true, setlistProgress: true } });
  if (!show) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (show.creatorId !== session.user.id) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const { trackIndex } = await request.json() as { trackIndex?: number };
  if (typeof trackIndex !== 'number') return NextResponse.json({ error: 'trackIndex required.' }, { status: 400 });
  const current = (show.setlistProgress as number[] | null) ?? [];
  const updated = Array.from(new Set([...current, trackIndex])).sort((a, b) => a - b);
  await db.show.update({ where: { id }, data: { setlistProgress: updated } });
  return NextResponse.json({ ok: true, progress: updated });
}
