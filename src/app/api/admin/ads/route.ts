import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!isAdminSession(session)) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;

    const ads = await db.adSubmission.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ads });
  } catch (err) {
    console.error('[api/admin/ads] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!isAdminSession(session)) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const { id, status } = await request.json();
    if (!id || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const ad = await db.adSubmission.update({
      where: { id },
      data: { status, reviewedAt: new Date(), reviewedBy: session?.user?.id ?? null },
    });

    return NextResponse.json({ ad });
  } catch (err) {
    console.error('[api/admin/ads] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
