import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { consumeRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const rate = await consumeRateLimit(`media-reorder:${session.user.id}`, { limit: 60, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) return NextResponse.json({ error: 'Too many updates.' }, { status: 429 });

  let body: { mediaIds?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // ignore
  }
  const ids = Array.isArray(body.mediaIds)
    ? body.mediaIds.filter((v) => typeof v === 'string').slice(0, 500) as string[]
    : [];
  if (ids.length === 0) return NextResponse.json({ error: 'mediaIds required' }, { status: 400 });

  const assets = await db.artistMediaAsset.findMany({
    where: { id: { in: ids } },
    select: { id: true, profile: { select: { ownerId: true } } }
  });
  const allMine = assets.every((a) => a.profile.ownerId === session.user!.id || isAdminSession(session));
  if (!allMine) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await db.$transaction(
    ids.map((id, idx) =>
      db.artistMediaAsset.update({ where: { id }, data: { sortOrder: idx } })
    )
  );

  return NextResponse.json({ ok: true });
}
