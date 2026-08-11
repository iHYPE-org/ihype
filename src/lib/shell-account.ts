import { cache } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { canPromoteWithHypeLink } from '@/lib/role-capabilities';
import type { ShellAccount } from '@/lib/app-nav';

export type ShellViewer = {
  account: ShellAccount | null;
  unreadCount: number;
};

const SIGNED_OUT: ShellViewer = { account: null, unreadCount: 0 };

/**
 * Everything the app shell needs about the viewer, resolved once in the root
 * layout instead of through a new API route — the shell renders on the server
 * already, and a fetch would only add a round trip and a loading flash to
 * chrome that is supposed to be there before anything else.
 *
 * Wrapped in React's `cache()` so the root layout's three queries run once per
 * request rather than once per render pass — this is on the hot path for every
 * signed-in page view, and the layout re-renders on every navigation.
 *
 * Every query is independently caught, following the AdminWorkbench precedent:
 * one failing count must degrade a badge, never the whole navigation. A count
 * that could not be read comes back undefined (badge hidden) rather than 0,
 * because "no tickets" and "we could not check" are different claims.
 */
export const getShellViewer = cache(async function getShellViewer(): Promise<ShellViewer> {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  if (!userId) return SIGNED_OUT;

  const [profiles, upcomingTicketCount, unreadCount] = await Promise.all([
    db.profile
      .findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, slug: true, type: true },
      })
      .catch((error) => {
        log.error('shell-account: owned profile lookup failed', error);
        return [] as { id: string; slug: string; type: string }[];
      }),
    db.ticketOrder
      .count({
        where: {
          buyerUserId: userId,
          status: { not: 'VOID' },
          show: { startsAt: { gte: new Date() } },
        },
      })
      .catch((error) => {
        log.error('shell-account: upcoming ticket count failed', error);
        return undefined;
      }),
    db.notification
      .count({ where: { userId, read: false } })
      .catch((error) => {
        log.error('shell-account: unread notification count failed', error);
        return 0;
      }),
  ]);

  const artist = profiles.find((profile) => profile.type === 'ARTIST');
  const venue = profiles.find((profile) => profile.type === 'VENUE');

  return {
    account: {
      name: session.user?.name || session.user?.email?.split('@')[0] || 'Account',
      artistProfileId: artist?.id,
      venueProfileId: venue?.id,
      isAdvertiser: session.user?.role === 'ADVERTISER',
      canPromote: canPromoteWithHypeLink(session.user?.role),
      upcomingTicketCount,
    },
    unreadCount,
  };
});
