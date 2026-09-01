import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * The signed-in member's own ticket orders as JSON. It was written for the
 * Events home's "Tickets" tab (`EventsHome.tsx`), which was deleted on
 * 2026-09-01 as dead code, so as of that date NOTHING in the app calls this
 * route; it is kept because it is the only list-form of "my tickets" the API
 * offers and `/tickets` may want it back. Same ownership rule as the page:
 * the session's own orders and nothing else.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') === 'archive' ? 'archive' : 'active';
  const now = new Date();

  const orders = await db.ticketOrder.findMany({
    where: view === 'active'
      ? { buyerUserId: session.user.id, status: { not: 'VOID' }, show: { startsAt: { gte: now } } }
      : { buyerUserId: session.user.id, OR: [{ status: 'VOID' }, { show: { startsAt: { lt: now } } }] },
    orderBy: { show: { startsAt: view === 'active' ? 'asc' : 'desc' } },
    take: 50,
    select: {
      id: true,
      quantity: true,
      status: true,
      subtotalCents: true,
      totalChargeCents: true,
      show: { select: { slug: true, title: true, startsAt: true } },
      tickets: { select: { id: true, serializedId: true, status: true } },
    },
  });

  return NextResponse.json({ orders });
}
