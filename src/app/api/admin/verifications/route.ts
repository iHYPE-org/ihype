import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

/**
 * GET /api/admin/verifications
 *
 * Returns all profiles in PENDING or REJECTED verification status,
 * ordered by submission date ascending (oldest claim first).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Admin only.' }, { status: 403 });
    }

    const profiles = await db.profile.findMany({
      where: {
        verificationStatus: { in: ['PENDING', 'REJECTED'] }
      },
      select: {
        id: true,
        slug: true,
        hexId: true,
        name: true,
        type: true,
        city: true,
        stateRegion: true,
        country: true,
        contactInfo: true,
        verificationNotes: true,
        verificationStatus: true,
        verificationSubmittedAt: true,
        verificationReviewedAt: true,
        verified: true,
        hypeCount: true,
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            createdAt: true
          }
        }
      },
      orderBy: [{ verificationSubmittedAt: 'asc' }, { createdAt: 'asc' }]
    });

    return NextResponse.json({ profiles });
  } catch (err) {
    console.error('[api/admin/verifications] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
