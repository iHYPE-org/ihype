import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { NotificationsList } from '@/components/NotificationsList';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Notifications · iHYPE',
  robots: { index: false, follow: false },
};

/**
 * The notifications feed, back where a link can reach it.
 *
 * WHY THIS EXISTS. `NotificationsList` and `/api/me/notifications` both kept
 * working the whole time, and nothing mounted the component: the feed had been
 * a section of `/me/dashboard`, that page went with the legacy shell, and
 * `/me/notifications` was left redirecting to it — so every notification email
 * and push payload already sitting in people's inboxes pointed at a page with
 * no feed on it. That redirect's own comment explains it was KEPT because those
 * links are already sent. They now arrive somewhere that answers them.
 *
 * A route rather than a fifth card in ME. ME has exactly four sections and the
 * dial is what selects them (Profiles, My Tickets, Info, Settings, on the
 * owner's own instruction); a fifth card with no station would be a card
 * nothing could reach. It is a row inside Settings, alongside the other
 * destinations that are not profiles.
 *
 * The list is a client component that takes its first page as a prop and then
 * owns its own state — it marks rows read through the same endpoint. Serving
 * the first page here rather than fetching it on mount means the feed is on
 * screen in the first paint, which for a surface reached by tapping a
 * notification is the whole point.
 */
export default async function MmmNotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/app/me/notifications');

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, type: true, body: true, read: true, link: true, createdAt: true },
  }).catch(() => []);

  return (
    <article className="mmm-info-report">
      <Link className="mmm-charter-back" href="/app/me?panel=settings">‹ Settings</Link>
      <header className="mmm-info-report-head">
        <p className="mmm-eyebrow mmm-eyebrow-accent">Me · Settings</p>
        <h1>Notifications</h1>
      </header>
      <NotificationsList
        initialNotifications={notifications.map((row) => ({
          ...row,
          // The component's own type takes a string: it renders through
          // `timeAgo`, and a Date does not survive the server/client boundary
          // as one.
          createdAt: row.createdAt.toISOString(),
        }))}
      />
    </article>
  );
}
