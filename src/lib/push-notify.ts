import webpush from 'web-push';
import { db } from '@/lib/db';

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

function initVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:hello@ihype.org';
  if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return true;
  }
  return false;
}

export async function sendPushNotification(userId: string, payload: PushPayload): Promise<void> {
  if (!initVapid()) {
    console.warn('[push-notify] VAPID keys not configured — skipping push for user', userId);
    return;
  }

  const subscriptions = await db.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, auth: true, p256dh: true },
  });

  if (subscriptions.length === 0) return;

  const message = JSON.stringify(payload);
  const staleIds: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
          message,
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          staleIds.push(sub.id);
        } else {
          console.warn('[push-notify] send failed:', err);
        }
      }
    }),
  );

  if (staleIds.length > 0) {
    await db.pushSubscription.deleteMany({ where: { id: { in: staleIds } } }).catch(() => null);
  }
}
