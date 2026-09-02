import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { log } from '@/lib/logger';

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

    /* WHICH rows carry a document, asked as a second id-only query. Selecting
       `verificationProofUrl` itself would pull every applicant's inline
       document (up to 8 MB base64 each, REJECTED rows kept forever) into a
       128 MB isolate to compute a boolean. The bytes are served one at a time
       by GET /api/admin/verifications/[profileId]/proof. */
    const withProof = new Set(
      (await db.profile.findMany({
        where: { id: { in: profiles.map((profile) => profile.id) }, verificationProofUrl: { not: null } },
        select: { id: true },
      })).map((row) => row.id),
    );

    return NextResponse.json({
      profiles: profiles.map((profile) => ({ ...profile, hasProof: withProof.has(profile.id) })),
    });
  } catch (err) {
    log.error('[api/admin/verifications]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
