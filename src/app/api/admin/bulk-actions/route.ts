import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
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

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
