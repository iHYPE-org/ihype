import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(
  _req: Request,
  { params }: { params: { id: string; action: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  const action = params.action;
  if (!['save', 'skip', 'hype'].includes(action)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await db.seed.create({
    data: { userId: session.user.id, mediaId: params.id, action },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
