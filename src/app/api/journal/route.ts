import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { checkForSpam } from '@/lib/spam-detection';

export const dynamic = 'force-dynamic';

const MAX_TITLE = 140;
const MAX_CONTENT = 5000;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to post.' }, { status: 401 });
  }
  const clientAddress = readClientAddress(request);
  const rate = await consumeRateLimit(`journal:${session.user.id}`, {
    limit: 20,
    windowMs: 60 * 60 * 1000
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many posts. Try later.' }, { status: 429 });
  }

  let body: { profileId?: string; title?: string; content?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // ignore
  }

  const profileId = typeof body.profileId === 'string' ? body.profileId : '';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, MAX_TITLE) : '';
  const content = typeof body.content === 'string' ? body.content.trim().slice(0, MAX_CONTENT) : '';
  if (!profileId || !title || !content) {
    return NextResponse.json({ error: 'profileId, title, and content are required.' }, { status: 400 });
  }

  // Spam detection
  const spamResult = await checkForSpam(`${title}\n${content}`, 'journal post');
  if (spamResult.isSpam && spamResult.confidence > 0.8) {
    return NextResponse.json({ error: 'Content flagged as spam.' }, { status: 403 });
  }

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, ownerId: true }
  });
  if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  if (profile.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const post = await db.artistJournalPost.create({
    data: { profileId: profile.id, title, content },
    select: { id: true, createdAt: true, title: true, content: true }
  });

  return NextResponse.json({ ok: true, post });
}

export async function GET(request: NextRequest) {
  const profileId = new URL(request.url).searchParams.get('profileId');
  if (!profileId) {
    return NextResponse.json({ error: 'profileId required' }, { status: 400 });
  }
  const rows = await db.artistJournalPost.findMany({
    where: { profileId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, createdAt: true, title: true, content: true }
  });
  const entries = rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    title: r.title,
    content: r.content
  }));
  return NextResponse.json({ entries });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to delete.' }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const post = await db.artistJournalPost.findUnique({
    where: { id },
    select: { id: true, profile: { select: { ownerId: true } } }
  });
  if (!post) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (post.profile.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  await db.artistJournalPost.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to edit.' }, { status: 401 });
  }

  let body: { id?: string; title?: string; content?: string } = {};
  try { body = (await request.json()) as typeof body; } catch { /* ignore */ }

  const { id, title, content } = body;
  if (!id || !title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'id, title, and content are required.' }, { status: 400 });
  }

  const post = await db.artistJournalPost.findUnique({
    where: { id },
    select: { id: true, profile: { select: { ownerId: true } } }
  });
  if (!post) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (post.profile.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const updated = await db.artistJournalPost.update({
    where: { id },
    data: { title: title.trim().slice(0, 140), content: content.trim().slice(0, 5000) },
    select: { id: true, createdAt: true, updatedAt: true, title: true, content: true }
  });
  return NextResponse.json({ ok: true, post: updated });
}
