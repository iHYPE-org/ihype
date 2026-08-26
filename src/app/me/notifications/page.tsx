import { redirect } from 'next/navigation';

/**
 * Notifications live in the app shell now, at `/app/me/notifications`.
 *
 * This stays a redirect rather than being deleted: the link ships inside real
 * notification emails and push payloads already in people's inboxes and on
 * their lock screens, so removing the route would 404 anyone tapping a
 * notification sent before any of this moved.
 *
 * It pointed at `/me/dashboard` until 2026-08-25, which by then forwarded into
 * `/app/me` — a surface with no feed on it. A redirect is only as good as what
 * it lands on.
 */
export default function NotificationsRedirect() {
  redirect('/app/me/notifications');
}
