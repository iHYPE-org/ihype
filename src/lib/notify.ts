import { db } from '@/lib/db';
import { sendPushNotification } from '@/lib/push-notify';
import { sendNativePushNotification } from '@/lib/native-push';

/**
 * Records an in-app Notification and best-effort sends both a web push and a
 * native (iOS/Android) push for it. All three are wrapped so a notification
 * never breaks the caller's flow — notifications are always a side effect,
 * never load-bearing. Every existing and future call site gets native push
 * for free through this one fan-in point.
 */
export async function notifyUser(
  userId: string,
  opts: { type: string; title: string; body: string; link?: string | null },
): Promise<void> {
  await db.notification.create({
    data: { userId, type: opts.type, body: opts.body, link: opts.link ?? null },
  }).catch(() => {});
  await sendPushNotification(userId, {
    title: opts.title,
    body: opts.body,
    url: opts.link ?? undefined,
  }).catch(() => {});
  await sendNativePushNotification(userId, {
    title: opts.title,
    body: opts.body,
    link: opts.link ?? undefined,
  }).catch(() => {});
}
