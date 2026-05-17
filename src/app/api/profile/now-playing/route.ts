import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

const schema = z.object({
  profileId: z.string().cuid(),
  nowPlaying: z.string().max(100).nullable(),
});

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { profileId, nowPlaying } = parsed.data;

  const profile = await db.profile.findUnique({ where: { id: profileId }, select: { ownerId: true } });
  if (!profile || profile.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db.profile.update({
    where: { id: profileId },
    data: { nowPlaying: nowPlaying ?? null },
  });

  return NextResponse.json({ ok: true });
}
