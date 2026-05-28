import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const posts = await db.collabBoardPost.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  }).catch(() => []);
  return NextResponse.json({ posts });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { type, role, body, contact } = await request.json();
  if (!type || !role || !body?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const post = await db.collabBoardPost.create({
    data: { userId: session.user.id, type, role, body: body.trim().slice(0, 500), contact: contact?.slice(0, 100) },
  });
  return NextResponse.json({ post }, { status: 201 });
}
