import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { requireRecentAdminReauth } from '@/lib/admin-confirmation';
import { log } from '@/lib/logger';
import { notifyUser } from '@/lib/notify';
import { sendGenericEmail } from '@/lib/mailer';
import { escapeHtml } from '@/lib/html-escape';

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
  if (!isAdminSession(session) || !session?.user?.id) {
    return NextResponse.json({ error: 'Admin only.' }, { status: 403 });
  }

  const reauthed = await requireRecentAdminReauth(session.user.id);
  if (!reauthed) {
    return NextResponse.json({ requiresReauth: true }, { status: 401 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    log.error('[admin/verifications/[profileId]', err instanceof Error ? err : { error: String(err) }, ']');
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { profileId } = await params;

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      verificationStatus: true,
      verificationNotes: true,
      slug: true,
      ownerId: true,
      owner: { select: { email: true } },
    }
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
        /* APPENDED, never overwritten. `verificationNotes` holds what the
           APPLICANT wrote when they submitted (api/verify/route.ts), and
           replacing it with the reviewer's note destroyed the only record of
           what was actually claimed — while the reviewer's note is the one
           thing a rejected applicant most needs kept. */
        ...(body.adminNote
          ? {
              verificationNotes: profile.verificationNotes
                ? `${profile.verificationNotes}\n\n— Reviewer: ${body.adminNote}`
                : `— Reviewer: ${body.adminNote}`,
            }
          : {})
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

  /* THE DECISION HAS TO REACH THE APPLICANT, AND UNTIL NOW IT REACHED NOBODY.
     `/verify` and the venue wizard both promise "we'll review your
     application within 48 hours and email you", the workbench tracks that
     48h against a queue, and this handler wrote a profile row and an audit
     row and stopped. A rejected venue was never told, never learned why, and
     went on waiting on a promise with no sender behind it.

     Both halves are best-effort and neither can fail the decision: the review
     is recorded above and a failed send must not roll it back or answer the
     administrator an error for work that succeeded. */
  const approved = body.decision === 'VERIFIED';
  const title = approved ? 'Your profile is verified' : 'We could not verify your profile';
  const reviewerNote = body.adminNote?.trim();
  const bodyText = approved
    ? `${updated.name} is verified on iHYPE.${reviewerNote ? ` ${reviewerNote}` : ''}`
    : `We could not verify ${updated.name} from what was sent.${reviewerNote ? ` ${reviewerNote}` : ''} You can send new evidence from the verification page.`;
  const link = approved ? `/app/me/profiles` : `/verify`;

  if (profile.ownerId) {
    await notifyUser(profile.ownerId, { type: `verification-${body.decision.toLowerCase()}`, title, body: bodyText, link })
      .catch((err) => log.error('[admin/verifications]', err instanceof Error ? err : { error: String(err) }, 'decision recorded but the in-app notice failed'));
  }

  if (profile.owner?.email) {
    await sendGenericEmail({
      to: profile.owner.email,
      subject: `[iHYPE] ${title}`,
      text: `${bodyText}\n\nhttps://ihype.org${link}`,
      html: `<p>${escapeHtml(bodyText)}</p><p><a href="https://ihype.org${link}">https://ihype.org${link}</a></p>`,
      deliveryType: `verification-${body.decision.toLowerCase()}`,
    }).catch((err) => log.error('[admin/verifications]', err instanceof Error ? err : { error: String(err) }, 'decision recorded but the email failed'));
  }

  return NextResponse.json(updated);
}
