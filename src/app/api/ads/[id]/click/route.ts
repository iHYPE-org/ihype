import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const ad = await db.adSubmission.findUnique({ where: { id }, select: { campaignWebsite: true } });
    if (!ad) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.adSubmission.update({ where: { id }, data: { clicks: { increment: 1 } } });

    return NextResponse.redirect(ad.campaignWebsite, 302);
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
