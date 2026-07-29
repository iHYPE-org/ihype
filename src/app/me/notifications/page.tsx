import { redirect } from 'next/navigation';

/**
 * Notifications were merged into the fan dashboard — they are a section of
 * /me/dashboard now rather than a page of their own.
 *
 * This stays as a redirect rather than being deleted: the link ships inside
 * real notification emails and push payloads that are already in people's
 * inboxes and on their lock screens, so removing the route would 404 anyone
 * tapping a notification sent before this change.
 *
 * The API is untouched — `/api/me/notifications` (GET feed, POST mark-read)
 * still backs the list component in its new home.
 */
export default function NotificationsRedirect() {
  redirect('/me/dashboard');
}
