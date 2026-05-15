import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const passkey = await db.passkey.findUnique({
    where: { id },
    select: { userId: true }
  });

  if (!passkey) return NextResponse.json({ error: 'Passkey not found.' }, { status: 404 });
  if (passkey.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  await db.passkey.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
