import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const count = await db.profile.count().catch(() => 0);
    if (count < 2) return NextResponse.json({ battle: null });

    const skip1 = Math.floor(Math.random() * count);
    let skip2 = Math.floor(Math.random() * Math.max(1, count - 1));
    if (skip2 >= skip1) skip2 = (skip2 + 1) % count;

    const [a, b] = await Promise.all([
      db.profile.findFirst({ skip: skip1, select: { id: true, name: true, type: true, slug: true } }),
      db.profile.findFirst({ skip: skip2, select: { id: true, name: true, type: true, slug: true } }),
    ]);
    if (!a || !b || a.id === b.id) return NextResponse.json({ battle: null });

    const toCard = (p: { id: string; name: string; type: string; slug: string }) => ({
      id: p.id,
      title: p.name,
      artistName: p.type,
      hypeCount: 0,
      color: '#b983ff',
    });

    return NextResponse.json({
      battle: { a: toCard(a), b: toCard(b), endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
    });
  } catch (err) {
    console.error('[api/discover/battle] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
