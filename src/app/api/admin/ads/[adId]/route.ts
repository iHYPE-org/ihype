import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { requireRecentAdminReauth } from '@/lib/admin-confirmation';

export const dynamic = 'force-dynamic';

// Housekeeping transitions only. This route writes Ad.status directly, with
// none of the billing flow that PATCH /api/admin/ads runs — so it used to be
// able to set a campaign APPROVED (live and servable by
// src/lib/ad-clip-selection.ts, spending budget) without any Stripe
// authorization ever happening, and REJECTED without releasing the pre-auth
// hold or notifying the advertiser. Both decisions belong to the canonical
// route; only the states with no money attached stay here.
const ALLOWED_STATUSES = ['PENDING', 'PAUSED'];
const BILLING_STATUSES = ['APPROVED', 'REJECTED'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ adId: string }> }
) {
  const session = await auth();
  if (!isAdminSession(session) || !session?.user?.id) {
    return NextResponse.json({ error: 'Admin required.' }, { status: 403 });
  }

  const reauthed = await requireRecentAdminReauth(session.user.id);
  if (!reauthed) {
    return NextResponse.json({ requiresReauth: true }, { status: 401 });
  }

  const { adId } = await params;
  let body: { status?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const status = typeof body.status === 'string' ? body.status : '';

  if (BILLING_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Use PATCH /api/admin/ads to ${status.toLowerCase()} a campaign — that route runs the Stripe authorization and advertiser notification this one does not.` },
      { status: 400 },
    );
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` }, { status: 400 });
  }

  const ad = await db.ad.update({ where: { id: adId }, data: { status } });
  return NextResponse.json({ ad });
}
