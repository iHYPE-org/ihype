import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { requireRecentAdminReauth } from '@/lib/admin-confirmation';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!isAdminSession(session) || !session?.user?.id) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  }

  const reauthed = await requireRecentAdminReauth(session.user.id);
  if (!reauthed) {
    return NextResponse.json({ requiresReauth: true }, { status: 401 });
  }

  let body: { ids?: string[]; action?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { ids, action } = body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 });
  }

  if (ids.length > 100) {
    return NextResponse.json({ error: 'Max 100 IDs per request' }, { status: 400 });
  }

  switch (action) {
    case 'verify_profiles': {
      const result = await db.profile.updateMany({
        where: { id: { in: ids } },
        data: { verificationStatus: 'VERIFIED', isVerified: true, verified: true },
      });
      return NextResponse.json({ ok: true, updated: result.count });
    }

    case 'feature_shows': {
      const result = await db.show.updateMany({
        where: { id: { in: ids } },
        data: { featured: true },
      });
      return NextResponse.json({ ok: true, updated: result.count });
    }

    case 'unfeature_shows': {
      const result = await db.show.updateMany({
        where: { id: { in: ids } },
        data: { featured: false },
      });
      return NextResponse.json({ ok: true, updated: result.count });
    }

    /* `resolve_reports` is GONE (2026-09-14, DESIGN_SYNC row 458): it flipped a
       page of reports to RESOLVED and removed nothing, so a queue could be
       cleared without a single piece of content going anywhere. Removing
       content is a per-report decision through PATCH /api/admin/moderation/[id];
       dismissing a page of spam is the bulk case and stays. */
    case 'dismiss_reports': {
      const result = await db.contentReport.updateMany({
        where: { id: { in: ids }, status: 'OPEN' },
        data: { status: 'DISMISSED' },
      });
      return NextResponse.json({ ok: true, updated: result.count });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
