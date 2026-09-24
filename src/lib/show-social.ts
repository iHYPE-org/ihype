import { db } from '@/lib/db';

/**
 * RSVP and setlist state for a show.
 *
 * RSVPs read `ShowRsvp`; the setlist is still audit-log driven (there is no
 * `Setlist` table). Both were derived inline in `/shows/[slug]`'s page body. Moving the show into the
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
 * READ FROM `ShowRsvp`, WHICH IS WHAT THE RSVP ROUTE WRITES (2026-09-24,
 * DESIGN_SYNC row 513). This used to reduce `show_rsvp` audit rows, an action
 * nothing has written since RSVPs moved to their own table — so the page that
 * sells the ticket rendered "0 going" until the client refetched. One row per
 * account (`@@unique([showId, userId])`), so a count is a headcount.
 */
export async function loadShowRsvpState(showId: string, viewerId?: string | null): Promise<ShowRsvpState> {
  const [count, mine] = await Promise.all([
    db.showRsvp.count({ where: { showId } }),
    viewerId
      ? db.showRsvp.findUnique({ where: { showId_userId: { showId, userId: viewerId } }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  return { count, viewerGoing: Boolean(mine) };
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
