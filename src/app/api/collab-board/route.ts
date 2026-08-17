import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const posts = await db.collabBoardPost.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, type: true, role: true, body: true, contact: true, createdAt: true, userId: true },
  });

  return NextResponse.json({
    posts: posts.map(p => ({ ...p, createdAt: p.createdAt.toISOString(), isOwn: p.userId === session.user.id })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { type, role, body: text, contact } = body ?? {};
  if (!type || !role || !text) return NextResponse.json({ error: 'type, role, and body are required' }, { status: 400 });
  if (!['looking-for', 'available'].includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  const validRoles = ['drummer', 'venue', 'vocalist', 'producer', 'guitarist', 'bassist', 'other'];
  if (!validRoles.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

  const post = await db.collabBoardPost.create({
    data: { userId: session.user.id, type, role, body: String(text).slice(0, 500), contact: contact ? String(contact).slice(0, 100) : null },
    select: { id: true, type: true, role: true, body: true, contact: true, createdAt: true, userId: true },
  });

  return NextResponse.json({ post: { ...post, createdAt: post.createdAt.toISOString(), isOwn: true } }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const post = await db.collabBoardPost.findUnique({ where: { id }, select: { userId: true } });
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (post.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await db.collabBoardPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
