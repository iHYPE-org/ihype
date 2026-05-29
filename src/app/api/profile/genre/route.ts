import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const GENRE_RE = /^[a-zA-Z0-9 ,]{0,50}$/;

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: { profileId?: string; genre?: string; genres?: string[] } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const profileId = typeof body.profileId === 'string' ? body.profileId : '';
  const genre = typeof body.genre === 'string' ? body.genre.trim().slice(0, 50) : '';

  if (!profileId) {
    return NextResponse.json({ error: 'profileId required.' }, { status: 400 });
  }

  if (!GENRE_RE.test(genre)) {
    return NextResponse.json(
      { error: 'Genre may only contain letters, numbers, spaces, and commas (max 50 chars).' },
      { status: 400 }
    );
  }

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, ownerId: true }
  });
  if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });

  if (!isAdminSession(session) && session.user.id !== profile.ownerId) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  await db.profile.update({
    where: { id: profileId },
    data: { genre: genre || null }
  });

  if (Array.isArray(body.genres)) {
    const cleaned = body.genres.slice(0, 10).map((g: string) => String(g).trim().slice(0, 30));
    await db.profile.update({ where: { id: profileId }, data: { genres: cleaned } });
  }

  return NextResponse.json({ ok: true, genre: genre || null });
}
