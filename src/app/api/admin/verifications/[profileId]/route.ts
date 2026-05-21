import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

const schema = z.object({
  decision: z.enum(['VERIFIED', 'REJECTED']),
  adminNote: z.string().trim().max(1000).optional()
});

/**
 * PATCH /api/admin/verifications/[profileId]
 *
 * Admin approves or rejects an ownership verification claim.
 * Sets verified=true only on VERIFIED decisions.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Admin only.' }, { status: 403 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    console.error('[admin/verifications/[profileId]]', err);
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { profileId } = await params;

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, verificationStatus: true }
  });

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  if (!['PENDING', 'REJECTED'].includes(profile.verificationStatus)) {
    return NextResponse.json(
      { error: 'Only PENDING or REJECTED profiles can be reviewed.' },
      { status: 409 }
    );
  }

  const [updated] = await db.$transaction([
    db.profile.update({
      where: { id: profileId },
      data: {
        verificationStatus: body.decision,
        verified: body.decision === 'VERIFIED',
        verificationReviewedAt: new Date(),
        ...(body.adminNote ? { verificationNotes: body.adminNote } : {})
      },
      select: {
        id: true,
        name: true,
        type: true,
        verificationStatus: true,
        verified: true,
        verificationReviewedAt: true
      }
    }),
    db.adminAuditLog.create({
      data: {
        actorId: session!.user!.id!,
        action: `verification.${body.decision.toLowerCase()}`,
        targetType: 'Profile',
        targetId: profileId,
        meta: body.adminNote ? { adminNote: body.adminNote } : undefined
      }
    })
  ]);

  return NextResponse.json(updated);
}
