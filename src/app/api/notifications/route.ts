import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const notifications = await db.notification.findMany({
    where: { userId: session.user.id, read: false },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, type: true, body: true, link: true, createdAt: true }
  });
  return NextResponse.json({ notifications });
}

export async function POST(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  await db.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (id) {
    await db.notification.deleteMany({ where: { id, userId: session.user.id } });
  } else {
    await db.notification.deleteMany({ where: { userId: session.user.id, read: true } });
  }
  return NextResponse.json({ ok: true });
}
