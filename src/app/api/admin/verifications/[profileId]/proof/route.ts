import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { recordAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/verifications/[profileId]/proof
 *
 * The ONLY reader of `Profile.verificationProofUrl` (security sweep,
 * 2026-09-02). `/api/verify` has required a document or a link since
 * 2026-07-29 and stored the document inline, deliberately off R2 — and then
 * nothing anywhere read it back: the admin queue selected `contactInfo` and
 * `verificationNotes` and decided on a name and a link, while an applicant's
 * licence or passport page sat in the row unseen. Evidence nobody can open is
 * PII collected for nothing.
 *
 * Admin only; every read is audited, because this is someone's identity
 * document. Served as an attachment with `nosniff` and never cached, so the
 * browser downloads it rather than rendering it in the admin origin.
 */
const ALLOWED = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const EXTENSION: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const session = await auth();
  if (!isAdminSession(session) || !session?.user?.id) {
    return NextResponse.json({ error: 'Admin only.' }, { status: 403 });
  }
  const { profileId } = await params;

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, slug: true, verificationProofUrl: true },
  });
  if (!profile?.verificationProofUrl) return NextResponse.json({ error: 'No document on file.' }, { status: 404 });

  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/is.exec(profile.verificationProofUrl);
  if (!match || !ALLOWED.has(match[1].toLowerCase())) {
    return NextResponse.json({ error: 'The stored document is not in a form this route serves.' }, { status: 415 });
  }
  const contentType = match[1].toLowerCase();
  const bytes = Buffer.from(match[2], 'base64');

  await recordAuditEvent({
    action: 'verification_proof_viewed',
    entityType: 'profile',
    entityId: profile.id,
    actorUserId: session.user.id,
  });

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': `attachment; filename="verification-${profile.slug}.${EXTENSION[contentType] ?? 'bin'}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
