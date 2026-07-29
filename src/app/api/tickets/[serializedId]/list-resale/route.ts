import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { log } from '@/lib/logger';

const schema = z.object({
  resalePriceCents: z.coerce.number().int().positive(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ serializedId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rl = await consumeRateLimit(
      rateLimitKey('ticket-resale-list', session.user.id, readClientAddress(request)),
      { limit: 10, windowMs: 60 * 60 * 1000 },
    );
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many resale requests. Try again later.' }, { status: 429 });
    }

    const { serializedId } = await params;
    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(await request.json());
    } catch {
      return NextResponse.json({ error: 'Enter a valid resale price.' }, { status: 400 });
    }
    const { resalePriceCents } = body;

    const [user, ticket] = await Promise.all([
      db.user.findUnique({
        where: { id: session.user.id },
        select: { isEighteenOrOlder: true },
      }),
      db.ticket.findUnique({
        where: { serializedId },
        select: { id: true, status: true, ticketOrder: { select: { buyerUserId: true } }, show: { select: { ticketPriceCents: true } } }
      }),
    ]);
    if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    if (ticket.ticketOrder.buyerUserId !== session.user.id) return NextResponse.json({ error: 'Not your ticket.' }, { status: 403 });
    // Same 18+ rule as purchasing — selling a ticket is a financial transaction.
    if (!user?.isEighteenOrOlder) {
      return NextResponse.json(
        {
          error: 'Ticket resale requires you to be 18 or older. Confirm your age in Settings first.',
          code: 'AGE_18_REQUIRED',
        },
        { status: 403 },
      );
    }
    if (ticket.status !== 'VALID') return NextResponse.json({ error: 'Ticket is not eligible for resale.' }, { status: 400 });
    if (resalePriceCents > (ticket.show?.ticketPriceCents ?? 0) * 1.1) {
      return NextResponse.json({ error: 'Resale price cannot exceed 110% of original price.' }, { status: 400 });
    }

    await db.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: 'TICKET_RESALE_LISTED',
        entityType: 'Ticket',
        entityId: ticket.id,
        metadata: { serializedId, resalePriceCents }
      }
    });

    return NextResponse.json({ ok: true, message: 'Ticket listed for resale. Buyers will be notified.' });
  } catch (err) {
    log.error('[api/tickets/[serializedId]', err instanceof Error ? err : { error: String(err) }, '/list-resale] error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
