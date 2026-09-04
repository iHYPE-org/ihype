import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { MmmTickets } from '@/components/mmm/MmmTickets';
import { loadMmmMe } from '@/lib/mmm-me';

/**
 * The wallet, promoted to a top-level destination by the MIDDLE ROAD
 * (2026-09-04). It was a SECTION inside ME, reachable by tuning the dock's dial
 * to "My Tickets" — a drag on a knurled drum, on the one surface in the product
 * with the least tolerance for being hard to find, because the member using it
 * is standing at a door.
 *
 * It renders the same `MmmTickets` ME always rendered, from the same loader, so
 * there is exactly one implementation of a ticket list and one
 * `OfflineTicketWarmer`. What changed is the address.
 *
 * Note this is `/app/tickets` while a single ticket stays `/app/me/tickets/<id>`
 * — the detail page is unmoved on purpose: that URL is in sent email and in
 * already-installed service-worker caches, and `isTicketDetail()` in
 * `public/sw.js` matches it. `moduleForPath` tests this route BEFORE `/app/me`
 * and asserts both directions.
 */
export const dynamic = 'force-dynamic';

export default async function MmmTicketsPage() {
  const session = await auth();
  // The layout already gated this, but every destination keeps its own
  // server-side check — the same rule every other MMM route follows.
  if (!session?.user?.id) redirect('/login?callbackUrl=/app/tickets');
  const data = await loadMmmMe(session.user.id, undefined, isAdminSession(session));
  return (
    <>
      <h1 className="sr-only">Tickets</h1>
      <MmmTickets tickets={data.tickets} />
    </>
  );
}
