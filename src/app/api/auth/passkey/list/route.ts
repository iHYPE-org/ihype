import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const passkeys = await db.passkey.findMany({
      where: { userId: session.user.id },
      select: { id: true, deviceType: true, createdAt: true, backedUp: true, name: true },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({ passkeys });
  } catch (err) {
    console.error('[api/auth/passkey/list] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
