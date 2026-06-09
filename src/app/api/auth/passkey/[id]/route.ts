import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const passkey = await db.passkey.findUnique({ where: { id }, select: { userId: true } });
    if (!passkey) return NextResponse.json({ error: 'Passkey not found.' }, { status: 404 });
    if (passkey.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

    const body = await request.json().catch(() => ({})) as { name?: string };
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) || null : undefined;
    if (name === undefined) return NextResponse.json({ error: 'name is required.' }, { status: 400 });

    await db.passkey.update({ where: { id }, data: { name } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/auth/passkey/[id]] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const passkey = await db.passkey.findUnique({ where: { id }, select: { userId: true } });
    if (!passkey) return NextResponse.json({ error: 'Passkey not found.' }, { status: 404 });
    if (passkey.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

    await db.passkey.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/auth/passkey/[id]] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
