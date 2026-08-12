import { db } from '@/lib/db';

/**
 * RSVP and setlist state for a show.
 *
 * Both are audit-log driven — there is no `Rsvp` or `Setlist` table, and both
 * were derived inline in `/shows/[slug]`'s page body. Moving the show into the
 * MMM shell needed the same two derivations, and a second copy of a
 * "latest row per user wins" reduction is the kind of duplication that drifts
 * silently: one page would keep counting a cancelled RSVP long after the other
 * stopped. So they live here once, and both pages call them.
 *
 * When the legacy page is deleted these stay, which is the point.
 */

export type ShowRsvpState = {
  /** How many distinct accounts are currently going. */
  count: number;
  /** Whether this viewer is one of them. */
  viewerGoing: boolean;
};

/**
 * The newest row per account wins, and only `going` counts. A member who RSVPs,
 * cancels and RSVPs again appears once — reading every row and summing would
 * count them three times.
 */
export async function loadShowRsvpState(showId: string, viewerId?: string | null): Promise<ShowRsvpState> {
  const rows = await db.auditLog.findMany({
    where: { action: 'show_rsvp', entityType: 'show', entityId: showId },
    orderBy: { createdAt: 'desc' },
    select: { actorUserId: true, metadata: true, createdAt: true },
  });

  const latestByUser = new Map<string, 'going' | 'cancelled'>();
  for (const row of rows) {
    if (!row.actorUserId) continue;
    // Rows arrive newest-first, so the first one seen for an account is its
    // current state and every later row is history.
    if (latestByUser.has(row.actorUserId)) continue;
    const meta = (row.metadata ?? {}) as { state?: string };
    latestByUser.set(row.actorUserId, meta.state === 'cancelled' ? 'cancelled' : 'going');
  }

  let count = 0;
  for (const state of latestByUser.values()) if (state === 'going') count += 1;

  return {
    count,
    viewerGoing: viewerId ? latestByUser.get(viewerId) === 'going' : false,
  };
}

/** The setlist as last saved by the show's owner, or an empty list. */
export async function loadShowSetlist(showId: string): Promise<string[]> {
  const last = await db.auditLog.findFirst({
    where: { action: 'show_setlist', entityType: 'show', entityId: showId },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  });
  const meta = (last?.metadata ?? {}) as { tracks?: unknown };
  return Array.isArray(meta.tracks) ? (meta.tracks.filter((track) => typeof track === 'string') as string[]) : [];
}
