import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { notifyAdvertiser } from '@/lib/ad-campaign-notify';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!isAdminSession(session)) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;

    const ads = await db.ad.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { advertiser: { select: { name: true, email: true } }, slot: { select: { name: true } } },
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
    if (!id || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const ad = await db.ad.update({
      where: { id },
      data: { status },
      include: { advertiser: { select: { id: true, email: true } } },
    });

    notifyAdvertiser(ad.advertiser.id, ad.advertiser.email, ad.title, status as 'APPROVED' | 'REJECTED', 'Reviewed by an iHYPE admin.');

    return NextResponse.json({ ad });
  } catch (err) {
    console.error('[api/admin/ads] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
