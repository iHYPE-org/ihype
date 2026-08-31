import { NextResponse } from 'next/server';
import { renderSVG } from 'uqr';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildTicketVerificationUrl } from '@/lib/tickets';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ serializedId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { serializedId } = await params;

  const ticket = await db.ticket.findFirst({
    where: { serializedId, ticketOrder: { buyerUserId: session.user.id } },
    select: { serializedId: true },
  });

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  /* The PAGE, not the API endpoint — and this is what a phone camera needs.
     A QR is opened by a camera, which issues a GET; `/api/tickets/:id/scan`
     is POST-only, so scanning this code answered 405 Method Not Allowed and
     the QR on every ticket was decorative (measured 2026-08-31). The
     verification URL redirects to the ticket page, which already draws the
     working "Mark as scanned" button for venue staff and shows the holder,
     show and status to anyone else. `buildTicketVerificationUrl` is the same
     helper the emailed QR uses, so the two ticket QRs in this codebase can no
     longer disagree — they did, and only this one was wrong. It also carries
     the real base URL instead of the hardcoded production host this line used
     to paste in, which made every non-production QR point at ihype.org. */
  const target = buildTicketVerificationUrl(serializedId);
  const svg = renderSVG(target, { ecc: 'M', border: 2 });

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
