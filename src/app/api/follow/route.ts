import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to follow.' }, { status: 401 });
  }
  const clientAddress = readClientAddress(request);
  const rate = await consumeRateLimit(`follow:${session.user.id}:${clientAddress ?? 'anon'}`, {
    limit: 60,
    windowMs: 60 * 1000
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  let body: { profileId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // ignore
  }
  const profileId = typeof body.profileId === 'string' ? body.profileId : '';
  if (!profileId) {
    return NextResponse.json({ error: 'profileId required.' }, { status: 400 });
  }

  const profile = await db.profile.findUnique({ where: { id: profileId }, select: { id: true } });
  if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.follow.findUnique({
      where: { followerId_followeeProfileId: { followerId: session.user.id, followeeProfileId: profileId } }
    });
    if (existing) {
      await tx.follow.delete({ where: { id: existing.id } });
      const count = await tx.follow.count({ where: { followeeProfileId: profileId } });
      return { following: false, count };
    } else {
      await tx.follow.create({ data: { followerId: session.user.id, followeeProfileId: profileId } });
      const count = await tx.follow.count({ where: { followeeProfileId: profileId } });
      return { following: true, count };
    }
  });
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  const profileId = new URL(request.url).searchParams.get('profileId');
  if (!profileId) return NextResponse.json({ error: 'profileId required.' }, { status: 400 });
  const count = await db.follow.count({ where: { followeeProfileId: profileId } });
  const session = await auth();
  let following = false;
  if (session?.user?.id) {
    const existing = await db.follow.findUnique({
      where: { followerId_followeeProfileId: { followerId: session.user.id, followeeProfileId: profileId } }
    });
    following = Boolean(existing);
  }
  return NextResponse.json({ count, following });
}
