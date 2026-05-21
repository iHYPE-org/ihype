import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? undefined;
  const posts = await db.collabPost.findMany({
    where: { active: true, ...(type ? { type } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { profile: { select: { name: true, slug: true, type: true, avatarImage: true } } }
  });
  return NextResponse.json({ posts }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const ip = readClientAddress(request);
  const rl = await consumeRateLimit(`collab:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  let parsed: { profileId?: string; type?: string; description?: string };
  try { parsed = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  const { profileId, type, description } = parsed;
  if (!profileId || !type || !description?.trim()) return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  const profile = await db.profile.findUnique({ where: { id: profileId, ownerId: session.user.id }, select: { id: true } });
  if (!profile) return NextResponse.json({ error: 'Profile not found or not yours.' }, { status: 403 });
  const post = await db.collabPost.create({ data: { profileId, type, description: description.trim() } });
  return NextResponse.json({ ok: true, post }, { status: 201 });
}
