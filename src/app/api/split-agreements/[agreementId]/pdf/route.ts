import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { agreementFilename, agreementPdf } from '@/lib/split-agreement-copy';

export const dynamic = 'force-dynamic';

/**
 * GET — the signed Show Revenue Split Agreement as a PDF (Agreement 11.1:
 * "Each party may download a PDF copy at any time"). Only the two parties and
 * an administrator; anyone else reads 404, the way the lineup page does.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ agreementId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });
  const { agreementId } = await params;
  const agreement = await db.showSplitAgreement.findUnique({
    where: { id: agreementId },
    select: {
      id: true, text: true, textHash: true, version: true, guarantorName: true,
      venueSignerName: true, venueSignedAt: true, artistSignerName: true, artistSignedAt: true, supersededAt: true,
      show: { select: { slug: true } },
      venueProfile: { select: { ownerId: true } },
      artistProfile: { select: { ownerId: true, name: true } },
    },
  });
  const allowed = agreement && (
    agreement.venueProfile.ownerId === session.user.id ||
    agreement.artistProfile.ownerId === session.user.id ||
    isAdminSession(session)
  );
  if (!agreement || !allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const pdf = agreementPdf(agreement);
  return new NextResponse(pdf.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${agreementFilename(agreement.show.slug, agreement.artistProfile.name)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
