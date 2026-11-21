import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const preference = await db.notificationPreference.findUnique({
    where: { userId: session.user.id }, select: { musicQuizzes: true },
  });
  return NextResponse.json({ enabled: preference?.musicQuizzes ?? false });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || typeof (body as { enabled?: unknown }).enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
  }
  const enabled = (body as { enabled: boolean }).enabled;
  await db.notificationPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, musicQuizzes: enabled },
    update: { musicQuizzes: enabled },
  });
  return NextResponse.json({ enabled });
}
