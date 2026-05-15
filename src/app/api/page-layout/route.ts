import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ layout: null });
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { pageLayout: true },
  });
  return NextResponse.json({ layout: user?.pageLayout ?? null });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const { layout } = await req.json() as { layout: string[] };
  await db.user.update({
    where: { id: session.user.id },
    data: { pageLayout: layout },
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
