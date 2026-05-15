import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const layoutSchema = z.array(z.string().max(64)).max(50);

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
  const parsed = layoutSchema.safeParse((await req.json())?.layout);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const layout = parsed.data;
  await db.user.update({
    where: { id: session.user.id },
    data: { pageLayout: layout },
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
